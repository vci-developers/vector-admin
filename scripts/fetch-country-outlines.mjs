// Pulls Program Countries' outlines and commits them, simplified, for the
// map's selected-country outline: landlocked countries from OpenStreetMap,
// coastal ones from Natural Earth (1:10m admin-0, land only). 1:50m is too
// coarse: at country zoom its border visibly cuts across the District shapes.
// Usage: node scripts/fetch-country-outlines.mjs <Program Country>...
//   e.g. node scripts/fetch-country-outlines.mjs Uganda Kenya Ghana
// Natural Earth is public domain; OSM data © OpenStreetMap contributors, ODbL.
import { writeFile } from 'node:fs/promises';
import { relationPolygons, round, simplify } from './geometry.mjs';

const countries = process.argv.slice(2);
if (countries.length === 0) {
    console.error(
        'Usage: node scripts/fetch-country-outlines.mjs <Program Country>...',
    );
    process.exit(1);
}

const SOURCE =
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';
const response = await fetch(SOURCE);
if (!response.ok) {
    console.error(`Natural Earth answered ${response.status}`);
    process.exit(1);
}
const { features } = await response.json();

// About 100 m, as for the District shapes, so the two simplify alike.
const TOLERANCE = 0.001;

// Landlocked Program Countries come from OpenStreetMap instead, the source of
// the District shapes, so the outline meets them exactly (Natural Earth's
// border is kilometres off in places). OSM can't serve coastal countries: its
// country boundary runs out to sea.
const OSM_ISO = { Uganda: 'UG' };

async function osmOutline(iso) {
    const query = `[out:json][timeout:180];
rel["ISO3166-1"="${iso}"]["boundary"="administrative"]["admin_level"="2"];
out geom;`;
    const answer = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'User-Agent': 'vector-admin boundary script' },
        body: new URLSearchParams({ data: query }),
    });
    if (!answer.ok) throw new Error(`Overpass answered ${answer.status}`);
    const [relation] = (await answer.json()).elements;
    return relation ? relationPolygons(relation) : null;
}

function naturalEarthOutline(country) {
    const feature = features.find(f => f.properties.ADMIN === country);
    if (!feature) return null;
    const { type, coordinates } = feature.geometry;
    return type === 'Polygon' ? [coordinates] : coordinates;
}

const outlines = [];
for (const country of countries) {
    const polygons = OSM_ISO[country]
        ? await osmOutline(OSM_ISO[country])
        : // Spelled as the API spells it, which matches Natural Earth's ADMIN
          // name ("United States of America").
          naturalEarthOutline(country);
    if (!polygons) {
        console.warn(`Skipped ${country}: no outline found`);
        continue;
    }
    outlines.push({
        country,
        source: OSM_ISO[country] ? 'osm' : 'naturalEarth',
        geometry: {
            type: 'MultiPolygon',
            coordinates: polygons.map(rings =>
                rings.map(ring => simplify(ring, TOLERANCE).map(round)),
            ),
        },
    });
}
const target = new URL(
    '../src/api/coverage/boundaries/countries.json',
    import.meta.url,
);
await writeFile(
    target,
    JSON.stringify({
        sources: {
            osm: 'OpenStreetMap admin_level=2, © OpenStreetMap contributors (ODbL)',
            naturalEarth:
                'Natural Earth 1:10m admin-0 countries (public domain)',
        },
        fetchedAt: new Date().toISOString().slice(0, 10),
        outlines,
    }) + '\n',
);
console.log(`Wrote ${outlines.length} outlines to ${target.pathname}`);
