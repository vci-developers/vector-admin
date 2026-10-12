// Pulls a country's boundaries from a pinned geoBoundaries release and commits
// them, simplified, as the Coverage layer's shapes. Use it where the reporting
// map already draws geoBoundaries areas, so the two outlines agree.
// Usage: node scripts/fetch-geoboundaries.mjs <ISO3> <ADM level> <Program Country> <commit>
//   e.g. node scripts/fetch-geoboundaries.mjs KEN ADM1 Kenya 9469f09
import { writeFile } from 'node:fs/promises';
import { round, simplify } from './geometry.mjs';

const [iso, level, country, commit] = process.argv.slice(2);
if (!iso || !level || !country || !commit) {
    console.error(
        'Usage: node scripts/fetch-geoboundaries.mjs <ISO3> <ADM level> <Program Country> <commit>',
    );
    process.exit(1);
}

// Same tolerance as fetch-boundaries.mjs: about 100 m.
const TOLERANCE = 0.001;
const url = `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/${commit}/releaseData/gbOpen/${iso}/${level}/geoBoundaries-${iso}-${level}.geojson`;
const response = await fetch(url);
if (!response.ok) {
    console.error(`geoBoundaries answered ${response.status} for ${url}`);
    process.exit(1);
}
const { features: source } = await response.json();

const features = source.flatMap(feature => {
    const { type, coordinates } = feature.geometry ?? {};
    const polygons =
        type === 'Polygon'
            ? [coordinates]
            : type === 'MultiPolygon'
              ? coordinates
              : null;
    if (!polygons) {
        console.warn(`Skipped ${feature.properties.shapeName}: ${type}`);
        return [];
    }
    return [
        {
            type: 'Feature',
            properties: { name: feature.properties.shapeName },
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
        source: `geoBoundaries gbOpen ${iso} ${level}, commit ${commit} (${url})`,
        fetchedAt: new Date().toISOString().slice(0, 10),
        features,
    }) + '\n',
);
console.log(`Wrote ${features.length} boundaries to ${target.pathname}`);
