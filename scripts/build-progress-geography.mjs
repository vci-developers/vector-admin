// Build the donor map's display-only geometry from the committed originals
// and curated public boundary extract. No network access is performed.
// No downloads: node scripts/build-progress-geography.mjs
// Verify the committed output: node scripts/build-progress-geography.mjs --check
// All polygons and rings remain; retained coordinates are original vertices.
// Each removed vertex is at most 0.003 degrees from its replacement segment.
// Unsafe simplifications retain the original ring/polygon. Shared geography
// remains unchanged and remains the source for reporting district positions.

import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
const countriesPath = new URL(
    'src/api/coverage/boundaries/countries.json',
    root,
);
const districtsPath = new URL('src/api/coverage/boundaries/uganda.json', root);
const reportingAreasPath = new URL(
    'src/features/dashboard/data/progress-reporting-area-source.json.gz',
    root,
);
const provenancePath = new URL(
    'src/features/dashboard/data/progress-reporting-area-sources.json',
    root,
);
const outputPath = new URL(
    'src/features/dashboard/data/progress-geography.json',
    root,
);
const TOLERANCE = 0.003;
const EPSILON = 1e-12;

const [countriesBytes, districtsBytes, reportingAreasBytes, provenanceBytes] =
    await Promise.all([
        readFile(countriesPath),
        readFile(districtsPath),
        readFile(reportingAreasPath),
        readFile(provenancePath),
    ]);
const countries = JSON.parse(countriesBytes);
const districts = JSON.parse(districtsBytes);
const reportingAreas = JSON.parse(gunzipSync(reportingAreasBytes));
const provenance = JSON.parse(provenanceBytes);
assert.equal(reportingAreas.schemaVersion, 1);
assert.equal(provenance.schemaVersion, 1);
for (const areas of reportingAreas.reportingAreas) {
    const source = provenance.sources.find(
        source => source.country === areas.country,
    );
    assert(source, 'Every reporting-area country must have source provenance');
    assert.equal(areas.features.length, source.includedFeatureCount);
    assert.equal(areas.level, source.boundaryLevel);
    assert.equal(
        new Set(areas.features.map(feature => feature.properties.sourceId))
            .size,
        areas.features.length,
    );
}
const stats = {
    rings: 0,
    polygons: 0,
    inputVertices: 0,
    outputVertices: 0,
    maxDeviation: 0,
};

function distanceSquared([x, y], [ax, ay], [bx, by]) {
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const fraction =
        length === 0
            ? 0
            : Math.max(
                  0,
                  Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length),
              );
    return (x - ax - fraction * dx) ** 2 + (y - ay - fraction * dy) ** 2;
}

function signedArea(ring) {
    let area = 0;
    for (let index = 1; index < ring.length; index++) {
        area +=
            ring[index - 1][0] * ring[index][1] -
            ring[index][0] * ring[index - 1][1];
    }
    return area / 2;
}

const cross = ([ax, ay], [bx, by], [cx, cy]) =>
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

function crosses(a, b, c, d) {
    if (
        Math.max(a[0], b[0]) < Math.min(c[0], d[0]) ||
        Math.max(c[0], d[0]) < Math.min(a[0], b[0]) ||
        Math.max(a[1], b[1]) < Math.min(c[1], d[1]) ||
        Math.max(c[1], d[1]) < Math.min(a[1], b[1])
    )
        return false;
    return (
        cross(a, b, c) * cross(a, b, d) < -EPSILON &&
        cross(c, d, a) * cross(c, d, b) < -EPSILON
    );
}

function selfCrosses(ring) {
    const last = ring.length - 2;
    for (let first = 0; first <= last; first++) {
        for (let second = first + 2; second <= last; second++) {
            if (first === 0 && second === last) continue;
            if (
                crosses(
                    ring[first],
                    ring[first + 1],
                    ring[second],
                    ring[second + 1],
                )
            )
                return true;
        }
    }
    return false;
}

function contains(ring, [x, y]) {
    let inside = false;
    for (let index = 1; index < ring.length; index++) {
        const a = ring[index - 1];
        const b = ring[index];
        if (distanceSquared([x, y], a, b) <= EPSILON) return true;
        if (
            a[1] > y !== b[1] > y &&
            x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
        )
            inside = !inside;
    }
    return inside;
}

function simplifyRing(original) {
    assert(
        original.length >= 4,
        'A polygon ring must retain at least four coordinates',
    );
    assert.deepEqual(
        original[0],
        original.at(-1),
        'Source rings must be closed',
    );
    const retained = new Uint8Array(original.length);
    retained[0] = retained[original.length - 1] = 1;
    const pending = [[0, original.length - 1]];
    while (pending.length > 0) {
        const [first, last] = pending.pop();
        let maximum = TOLERANCE * TOLERANCE;
        let worst = -1;
        for (let index = first + 1; index < last; index++) {
            const distance = distanceSquared(
                original[index],
                original[first],
                original[last],
            );
            if (distance > maximum) {
                maximum = distance;
                worst = index;
            }
        }
        if (worst !== -1) {
            retained[worst] = 1;
            pending.push([first, worst], [worst, last]);
        }
    }
    const indices = Array.from(retained, (keep, index) =>
        keep ? index : -1,
    ).filter(index => index !== -1);
    const simplified = indices.map(index => original[index]);
    if (
        simplified.length < 4 ||
        signedArea(original) * signedArea(simplified) <= 0 ||
        selfCrosses(simplified)
    )
        return { ring: original, deviation: 0 };

    let deviation = 0;
    for (let segment = 1; segment < indices.length; segment++) {
        const first = indices[segment - 1];
        const last = indices[segment];
        for (let index = first + 1; index < last; index++) {
            deviation = Math.max(
                deviation,
                Math.sqrt(
                    distanceSquared(
                        original[index],
                        original[first],
                        original[last],
                    ),
                ),
            );
        }
    }
    assert(
        deviation <= TOLERANCE + EPSILON,
        'Simplification exceeded the display tolerance',
    );
    return { ring: simplified, deviation };
}

function simplifyPolygon(original) {
    let results = original.map(simplifyRing);
    // A hole must remain within its outer ring after simplification.
    if (
        results
            .slice(1)
            .some(hole =>
                hole.ring.some(point => !contains(results[0].ring, point)),
            )
    ) {
        results = original.map(ring => ({ ring, deviation: 0 }));
    }
    stats.polygons++;
    results.forEach((result, index) => {
        assert.deepEqual(
            result.ring[0],
            result.ring.at(-1),
            'Display rings must remain closed',
        );
        stats.rings++;
        stats.inputVertices += original[index].length;
        stats.outputVertices += result.ring.length;
        stats.maxDeviation = Math.max(stats.maxDeviation, result.deviation);
    });
    return results.map(result => result.ring);
}

function simplifyGeometry(geometry) {
    assert.equal(geometry.type, 'MultiPolygon');
    return {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.map(simplifyPolygon),
    };
}

const output = {
    toleranceDegrees: TOLERANCE,
    source: 'Derived locally from committed OpenStreetMap / Natural Earth geography and curated public reporting-area sources; display only',
    reportingAreaScope: provenance.scope,
    sourceDates: {
        countries: countries.fetchedAt,
        districts: districts.fetchedAt,
        reportingAreas: provenance.retrievedDate,
    },
    outlines: countries.outlines.map(country => ({
        country: country.country,
        geometry: simplifyGeometry(country.geometry),
    })),
    districts: {
        type: 'FeatureCollection',
        features: districts.features.map(feature => ({
            type: 'Feature',
            properties: { name: feature.properties.name },
            geometry: simplifyGeometry(feature.geometry),
        })),
    },
};
const reportingAreaOutputs = reportingAreas.reportingAreas.map(areas => {
    const source = provenance.sources.find(
        source => source.country === areas.country,
    );
    return {
        path: new URL(
            `src/features/dashboard/data/progress-areas-${areas.country.toLowerCase()}.json`,
            root,
        ),
        data: {
            country: areas.country,
            level: areas.level,
            toleranceDegrees: TOLERANCE,
            scope: provenance.scope,
            source,
            type: 'FeatureCollection',
            features: areas.features.map(feature => ({
                type: 'Feature',
                properties: feature.properties,
                geometry: simplifyGeometry(feature.geometry),
            })),
        },
    };
});
assert.deepEqual(
    output.outlines.map(country => country.country),
    countries.outlines.map(country => country.country),
);
assert.deepEqual(
    output.districts.features.map(feature => feature.properties.name),
    districts.features.map(feature => feature.properties.name),
);
const outputs = [
    { path: outputPath, data: output },
    ...reportingAreaOutputs,
].map(({ path, data }) => ({
    path,
    bytes: Buffer.from(JSON.stringify(data) + '\n'),
}));
for (const { path, bytes } of outputs) {
    if (process.argv.includes('--check')) {
        assert.deepEqual(
            await readFile(path),
            bytes,
            'Display geometry is stale; regenerate it with this script',
        );
    } else {
        await mkdir(new URL('./', path), { recursive: true });
        await writeFile(path, bytes);
    }
}
console.log(
    JSON.stringify(
        {
            output: fileURLToPath(outputPath),
            sourceBytes:
                countriesBytes.length +
                districtsBytes.length +
                reportingAreasBytes.length,
            sourceMinifiedBytes:
                JSON.stringify(countries).length +
                JSON.stringify(districts).length +
                JSON.stringify(reportingAreas).length,
            curatedReportingAreas: reportingAreas.reportingAreas.reduce(
                (total, areas) => total + areas.features.length,
                0,
            ),
            outputBytes: outputs.reduce(
                (total, output) => total + output.bytes.length,
                0,
            ),
            outputGzipBytes: outputs.reduce(
                (total, output) => total + gzipSync(output.bytes).length,
                0,
            ),
            files: outputs.map(({ path, bytes }) => ({
                path: fileURLToPath(path),
                bytes: bytes.length,
                gzipBytes: gzipSync(bytes).length,
            })),
            ...stats,
        },
        null,
        2,
    ),
);
