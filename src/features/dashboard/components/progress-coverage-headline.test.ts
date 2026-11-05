import type { Program } from '@/api/program/validation/program-schema';
import type {
    ProgressLocationCoverage,
    ProgressSentinelSites,
} from '@/api/progress/validation/progress-schema';
import { NextIntlClientProvider } from 'next-intl';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsx } from 'react/jsx-runtime';
import { describe, expect, it } from 'vitest';
import ProgressCoverageHeadline from './progress-coverage-headline';
import { ScanLine } from 'lucide-react';
import ProgressCountHeadline from './progress-count-headline';

const programs: Program[] = [
    { programId: 1, name: 'Uganda reporting', country: 'Uganda' },
    { programId: 2, name: 'Colombia reporting', country: 'Colombia' },
    { programId: 3, name: 'Ghana reporting', country: 'Ghana' },
    { programId: 4, name: 'Kenya reporting', country: 'Kenya' },
    { programId: 6, name: 'Cameroon reporting', country: 'Cameroon' },
    { programId: 7, name: 'Uganda partner reporting', country: 'Uganda' },
];

/** Each Program's Sentinel Sites, matching its coverage count by default. */
const sentinelFor = (
    coverage: readonly ProgressLocationCoverage[],
): ProgressSentinelSites[] =>
    coverage.map(({ programId, count }) => ({ programId, count }));

function renderCoverage(
    coverage: readonly ProgressLocationCoverage[],
    sentinelSites: readonly ProgressSentinelSites[] = sentinelFor(coverage),
) {
    return renderToStaticMarkup(
        jsx(NextIntlClientProvider, {
            locale: 'en',
            timeZone: 'UTC',
            messages: {},
            children: createElement(ProgressCoverageHeadline, {
                coverage,
                sentinelSites,
                programs,
                expanded: true,
                onToggle: () => {},
            }),
        }),
    ).replace(/<!--.*?-->/g, '');
}

function coverageFigures(markup: string): string[] {
    return [
        ...markup.matchAll(
            /<p[^>]*><span[^>]*>([^<]*)<\/span> <span[^>]*>([^<]*)<\/span><\/p>/g,
        ),
    ].map(match => `${match[1]} ${match[2]}`);
}

describe('progress coverage headline', () => {
    it('shows sentinel sites above the households, in total and per Program', () => {
        const text = renderCoverage(
            [
                { programId: 1, unit: 'household', count: 250 },
                { programId: 4, unit: 'household', count: 9 },
            ],
            [
                { programId: 1, count: 33 },
                { programId: 4, count: 1 },
            ],
        ).replace(/<[^>]+>/g, ' ');
        expect(text).toMatch(
            /34\s+active sentinel sites\s+259 active households/,
        );
        expect(text.match(/Sentinel sites/g)).toHaveLength(1);
        expect(text).toMatch(/33\s+250\s+households/);
        expect(text).toMatch(/1\s+9\s+households/);
    });

    it('shows a shared-unit total before the individual Uganda, Ghana and Kenya counts', () => {
        const coverage = Object.freeze([
            Object.freeze({
                programId: 1,
                unit: 'household' as const,
                count: 250,
            }),
            Object.freeze({
                programId: 3,
                unit: 'household' as const,
                count: 153,
            }),
            Object.freeze({
                programId: 4,
                unit: 'household' as const,
                count: 30,
            }),
        ]);
        const markup = renderCoverage(coverage);

        expect(markup).toContain('>433</span>');
        expect(markup).toContain('active households');
        expect(markup.indexOf('>433</span>')).toBeLessThan(
            markup.indexOf('aria-label="Coverage by program"'),
        );
        for (const country of ['Uganda', 'Ghana', 'Kenya']) {
            expect(markup).toContain(`>${country}</p>`);
            expect(markup).toContain(`${country} reporting`);
        }
        for (const count of [250, 153, 30]) {
            expect(markup).toContain(`>${count}</span>`);
        }
        expect(coverageFigures(markup)).toEqual([
            '250 households',
            '153 households',
            '30 households',
        ]);
        expect(markup).not.toContain('Colombia');
        expect(coverage.map(entry => entry.count)).toEqual([250, 153, 30]);
    });

    it('nests separate programs in the same country under its subtotal', () => {
        const markup = renderCoverage([
            { programId: 1, unit: 'household', count: 2 },
            { programId: 7, unit: 'household', count: 3 },
        ]);

        expect(markup).toContain('>5</span>');
        expect(markup.match(/>Uganda<\/p>/g)).toHaveLength(1);
        expect(markup).toContain('2 programs');
        expect(markup).toContain('Uganda reporting');
        expect(markup).toContain('Uganda partner reporting');
        expect(markup).toContain('>2</span>');
        expect(markup).toContain('>3</span>');
    });

    it('combines mixed reporting units only under a generic location label, retaining each program’s unit', () => {
        const markup = renderCoverage([
            { programId: 1, unit: 'household', count: 2 },
            { programId: 2, unit: 'municipality', count: 3 },
        ]);

        expect(markup).toContain('>5</span>');
        expect(markup).toContain('active reporting locations');
        expect(markup).not.toContain('active households');
        expect(coverageFigures(markup)).toEqual([
            '2 households',
            '3 municipalities',
        ]);
        expect(markup).toContain('Uganda reporting');
        expect(markup).toContain('Colombia reporting');
        expect(markup).toContain('>2</span>');
        expect(markup).toContain('>3</span>');
    });

    it('totals the available shared-unit counts while retaining the unavailable row', () => {
        const markup = renderCoverage([
            { programId: 1, unit: 'household', count: 4 },
            { programId: 3, unit: 'household', count: null },
        ]);

        expect(markup).not.toContain('>—</span>');
        expect(markup).toContain('active households');
        expect(markup.match(/>4<\/span>/g)).toHaveLength(3);
        expect(markup).toContain('Coverage unavailable for some programs');
        expect(markup).toContain('>Unavailable</span>');
        expect(markup).toContain('Uganda reporting');
        expect(markup).toContain('Ghana reporting');
    });

    it('keeps a headline total and five matching program rows in both cards when all programs are selected', () => {
        const coverage: ProgressLocationCoverage[] = [
            { programId: 1, unit: 'household', count: 206 },
            { programId: 2, unit: 'municipality', count: 0 },
            { programId: 3, unit: 'household', count: 0 },
            { programId: 4, unit: 'household', count: 0 },
            { programId: 6, unit: 'health-district', count: 1 },
        ];
        const markup = renderToStaticMarkup(
            jsx(NextIntlClientProvider, {
                locale: 'en',
                timeZone: 'UTC',
                messages: {},
                children: createElement(
                    'div',
                    null,
                    createElement(ProgressCoverageHeadline, {
                        coverage,
                        sentinelSites: sentinelFor(coverage),
                        programs,
                        expanded: true,
                        onToggle: () => {},
                    }),
                    createElement(ProgressCountHeadline, {
                        title: 'Total scans',
                        expanded: true,
                        onToggle: () => {},
                        icon: ScanLine,
                        tone: 'mid',
                        total: 926,
                        byProgram: coverage.map(row => ({
                            programId: row.programId,
                            count:
                                row.programId === 1
                                    ? 909
                                    : row.programId === 6
                                      ? 17
                                      : 0,
                        })),
                        totalUnit: 'total scans',
                        singleUnit: 'images captured with VectorCam',
                        description: 'One image is one scan.',
                        programs,
                    }),
                ),
            }),
        ).replace(/<!--.*?-->/g, '');
        const cards = markup.match(/<article\b.*?<\/article>/g)!;

        expect(cards).toHaveLength(2);
        expect(cards[0]).toContain('>207</span>');
        expect(cards[0]).toContain('active reporting locations');
        expect(coverageFigures(cards[0])).toEqual([
            '206 households',
            '0 municipalities',
            '0 households',
            '0 households',
            '1 health district',
        ]);
        expect(cards[0]).not.toContain('· households');
        expect(cards[0]).not.toContain('· municipalities');
        expect(cards[0]).not.toContain('· health district');
        expect(cards[0]).not.toContain('active households');
        expect(cards[1]).toContain('>926</span>');
        expect(cards[1]).toContain('total scans');
        expect(cards[0].indexOf('>207</span>')).toBeLessThan(
            cards[0].indexOf('<ul'),
        );
        expect(cards[1].indexOf('>926</span>')).toBeLessThan(
            cards[1].indexOf('<ul'),
        );
        for (const card of cards) {
            expect(card.match(/<li\b/g)).toHaveLength(5);
            const countries = [...card.matchAll(/title="([^"]+)"/g)]
                .map(match => match[1])
                .filter(value => !value.includes('reporting'));
            expect(countries).toEqual([
                'Uganda',
                'Colombia',
                'Ghana',
                'Kenya',
                'Cameroon',
            ]);
            expect(card).toContain('Uganda reporting');
            expect(card).toContain('Cameroon reporting');
        }
    });

    it('totals incomplete mixed coverage from the programs that have a count', () => {
        const markup = renderCoverage([
            { programId: 1, unit: 'household', count: 0 },
            { programId: 2, unit: 'municipality', count: null },
            { programId: 6, unit: 'health-district', count: 1 },
        ]);

        expect(markup).not.toContain('>—</span>');
        expect(markup).toContain('active reporting location');
        expect(markup).toContain('>0</span>');
        expect(markup).toContain('>1</span>');
        expect(markup).toContain('>Unavailable</span>');
        expect(coverageFigures(markup)).toEqual([
            '0 households',
            'Unavailable municipalities',
            '1 health district',
        ]);
    });

    it('keeps the total unavailable when no program has a count', () => {
        const markup = renderCoverage([
            { programId: 1, unit: 'household', count: null },
            { programId: 3, unit: 'household', count: null },
        ]);

        expect(markup).toContain('>—</span>');
        expect(markup).toContain('households unavailable');
    });

    it('distinguishes zero mixed coverage, a single reporting location and no program selection', () => {
        const zero = renderCoverage([
            { programId: 1, unit: 'household', count: 0 },
            { programId: 2, unit: 'municipality', count: 0 },
        ]);
        expect(zero).toContain('>0</span>');
        expect(zero).toContain('active reporting locations');
        expect(zero).not.toContain('unavailable');

        const single = renderCoverage([
            { programId: 1, unit: 'household', count: 0 },
            { programId: 6, unit: 'health-district', count: 1 },
        ]);
        expect(single).toContain('>1</span>');
        expect(single).toContain('active reporting location</span>');

        const empty = renderCoverage([]);
        expect(empty).toContain('>—</span>');
        expect(empty).toContain('Choose a program');
        expect(empty).not.toContain('active reporting locations');
    });

    it('shows only the total until the tiles are opened', () => {
        const markup = renderToStaticMarkup(
            jsx(NextIntlClientProvider, {
                locale: 'en',
                timeZone: 'UTC',
                messages: {},
                children: createElement(ProgressCoverageHeadline, {
                    coverage: [
                        { programId: 1, unit: 'household', count: 206 },
                        { programId: 3, unit: 'household', count: 4 },
                    ],
                    sentinelSites: [
                        { programId: 1, count: 206 },
                        { programId: 3, count: 4 },
                    ],
                    programs,
                    expanded: false,
                    onToggle: () => {},
                }),
            }),
        );

        expect(markup).toContain('>210</span>');
        expect(markup).toContain('aria-expanded="false"');
        expect(markup).not.toContain('<li');
        expect(markup).not.toContain('Locations reporting');
    });
});
