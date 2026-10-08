// Pulls a country's administrative boundaries from OpenStreetMap (Overpass)
// and commits them, simplified, as the Coverage layer's shapes.
// Usage: node scripts/fetch-boundaries.mjs <ISO code> <admin level> <Program Country>
//   e.g. node scripts/fetch-boundaries.mjs UG 4 Uganda   (Districts and Cities)
// Data © OpenStreetMap contributors, ODbL.
import { writeFile } from 'node:fs/promises';
import { relationPolygons, round, simplify } from './geometry.mjs';

const [iso, level, country] = process.argv.slice(2);
if (!iso || !level || !country) {
    console.error(
        'Usage: node scripts/fetch-boundaries.mjs <ISO code> <admin level> <Program Country>',
    );
    process.exit(1);
}

// About 100 m; plenty for a District fill at country zoom.
const TOLERANCE = 0.001;

const query = `[out:json][timeout:180];
area["ISO3166-1"="${iso}"][admin_level=2]->.country;
rel(area.country)["boundary"="administrative"]["admin_level"="${level}"];
out geom;`;
const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'User-Agent': 'vector-admin boundary script' },
    body: new URLSearchParams({ data: query }),
});
if (!response.ok) {
    console.error(`Overpass answered ${response.status}`);
    process.exit(1);
}
const { elements } = await response.json();

const features = elements.flatMap(relation => {
    const polygons = relationPolygons(relation);
    if (!polygons) {
        console.warn(`Skipped ${relation.tags.name}: no closed outer ring`);
        return [];
    }
    return [
        {
            type: 'Feature',
            properties: { name: relation.tags.name },
            geometry: {
                type: 'MultiPolygon',
                coordinates: polygons.map(rings =>
                    rings.map(ring => simplify(ring, TOLERANCE).map(round)),
                ),
            },
        },
    ];
});

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
const target = new URL(
    `../src/api/coverage/boundaries/${country.toLowerCase().replace(/\s+/g, '-')}.json`,
    import.meta.url,
);
await writeFile(
    target,
    JSON.stringify({
        country,
        source: `OpenStreetMap admin_level=${level}, © OpenStreetMap contributors (ODbL)`,
        fetchedAt: new Date().toISOString().slice(0, 10),
        features,
    }) + '\n',
);
console.log(`Wrote ${features.length} boundaries to ${target.pathname}`);
