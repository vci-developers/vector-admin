import { describe, expect, it } from 'vitest';
import { placeDistrictNames } from './place-district-names';
import type { LabelBox } from './place-labels';

const districtNames = [
    'Arua',
    'Gulu',
    'Hoima',
    'Jinja',
    'Kampala',
    'Kasese',
    'Lira',
    'Masaka',
    'Mbale',
    'Mbarara',
    'Wakiso',
    'Accra',
    'Kumasi',
    'Tamale',
    'Cape Coast',
];

function label(key: string, x: number, y: number, width = 90): LabelBox {
    return { key, x, y, width, height: 24 };
}

function overlaps(a: LabelBox, b: LabelBox) {
    return (
        Math.abs(a.x - b.x) * 2 < a.width + b.width + 8 &&
        Math.abs(a.y - b.y) * 2 < a.height + b.height + 8
    );
}

function expectWithinViewport(
    box: LabelBox,
    viewport: { width: number; height: number },
) {
    expect(box.x - box.width / 2).toBeGreaterThanOrEqual(14);
    expect(box.x + box.width / 2).toBeLessThanOrEqual(viewport.width - 14);
    expect(box.y - box.height / 2).toBeGreaterThanOrEqual(14);
    expect(box.y + box.height / 2).toBeLessThanOrEqual(viewport.height - 28);
}

describe('placeDistrictNames', () => {
    it.each([
        { width: 390, height: 520 },
        { width: 1392, height: 760 },
    ])(
        'keeps every district clear of its neighbours and map controls at $width × $height',
        viewport => {
            // At a continental zoom level, many district anchors share a pixel.
            const names = districtNames.map(name =>
                label(
                    name,
                    viewport.width / 2,
                    viewport.height / 2,
                    name.length * 7 + 18,
                ),
            );
            const obstacles = [
                { key: 'zoom-controls', x: 35, y: 55, width: 42, height: 76 },
                {
                    key: 'uganda-card',
                    x: viewport.width / 2 - 65,
                    y: viewport.height / 2 - 40,
                    width: 110,
                    height: 48,
                },
                {
                    key: 'ghana-card',
                    x: viewport.width / 2 + 65,
                    y: viewport.height / 2 + 40,
                    width: 110,
                    height: 48,
                },
            ];
            const placed = placeDistrictNames(names, viewport, obstacles);
            const boxes = [...placed.values()];

            expect([...placed.keys()]).toEqual(districtNames);
            for (const [index, box] of boxes.entries()) {
                expectWithinViewport(box, viewport);
                for (const other of [...boxes.slice(index + 1), ...obstacles])
                    expect(
                        overlaps(box, other),
                        `${box.key} overlaps ${other.key}`,
                    ).toBe(false);
            }
        },
    );

    it('keeps separate district labels at their geographic anchors when room is available', () => {
        const names = [label('Arua', 150, 150), label('Gulu', 600, 400)];

        expect([
            ...placeDistrictNames(
                names,
                { width: 800, height: 600 },
                [],
            ).values(),
        ]).toEqual(names);
    });

    it('keeps names visible when their requested anchors are outside the viewport', () => {
        const viewport = { width: 390, height: 520 };
        const names = [label('west', -100, -100), label('east', 900, 900)];
        const placed = placeDistrictNames(names, viewport, []);

        expect([...placed.keys()]).toEqual(['west', 'east']);
        for (const box of placed.values()) expectWithinViewport(box, viewport);
    });

    it('keeps a long district name on one row within a narrow map', () => {
        const viewport = { width: 390, height: 520 };
        const placed = placeDistrictNames(
            [label('long-name', 195, 260, 700)],
            viewport,
            [],
        );
        const singleRow = placed.get('long-name')!;

        expect(singleRow.width).toBeLessThan(700);
        expect(singleRow.height).toBe(24);
        expectWithinViewport(singleRow, viewport);
    });

    it('retains every name even when the viewport cannot fit them without overlap', () => {
        const viewport = { width: 160, height: 100 };
        const names = districtNames.map(name => label(name, 80, 50));
        const obstacles = [
            { key: 'blocked', x: 80, y: 50, width: 160, height: 100 },
        ];
        const before = structuredClone({ names, obstacles });
        const placed = placeDistrictNames(names, viewport, obstacles);

        expect([...placed.keys()]).toEqual(districtNames);
        for (const box of placed.values()) expectWithinViewport(box, viewport);
        expect({ names, obstacles }).toEqual(before);
    });
});
