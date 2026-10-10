import type { Program } from '@/api/program/validation/program-schema';
import type { ProgressLocationCoverage } from '@/api/progress/validation/progress-schema';
import { NextIntlClientProvider } from 'next-intl';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsx } from 'react/jsx-runtime';
import { describe, expect, it } from 'vitest';
import ProgressCoverageHeadline from './progress-coverage-headline';
import ProgressScansHeadline from './progress-scans-headline';

const programs: Program[] = [
    { programId: 1, name: 'Uganda reporting', country: 'Uganda' },
    { programId: 2, name: 'Colombia reporting', country: 'Colombia' },
    { programId: 3, name: 'Ghana reporting', country: 'Ghana' },
    { programId: 4, name: 'Kenya reporting', country: 'Kenya' },
    { programId: 6, name: 'Cameroon reporting', country: 'Cameroon' },
    { programId: 7, name: 'Uganda partner reporting', country: 'Uganda' },
];

function renderCoverage(coverage: readonly ProgressLocationCoverage[]) {
    return renderToStaticMarkup(
        jsx(NextIntlClientProvider, {
            locale: 'en',
            timeZone: 'UTC',
            messages: {},
            children: createElement(ProgressCoverageHeadline, {
                coverage,
                programs,
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

    it('keeps separate programs in the same country visible below their combined total', () => {
        const markup = renderCoverage([
            { programId: 1, unit: 'household', count: 2 },
            { programId: 7, unit: 'household', count: 3 },
        ]);

        expect(markup).toContain('>5</span>');
        expect(markup.match(/>Uganda<\/p>/g)).toHaveLength(2);
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

    it('keeps a missing shared-unit total unavailable while retaining real zero and unavailable rows', () => {
        const markup = renderCoverage([
            { programId: 1, unit: 'household', count: 0 },
            { programId: 3, unit: 'household', count: null },
        ]);

        expect(markup).toContain('>—</span>');
        expect(markup).toContain('households unavailable');
        expect(markup).toContain('>0</span>');
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
                        programs,
                    }),
                    createElement(ProgressScansHeadline, {
                        total: 926,
                        scansByProgram: coverage.map(row => ({
                            programId: row.programId,
                            scans:
                                row.programId === 1
                                    ? 909
                                    : row.programId === 6
                                      ? 17
                                      : 0,
                        })),
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

    it('keeps incomplete mixed coverage unavailable instead of showing a partial total', () => {
        const markup = renderCoverage([
            { programId: 1, unit: 'household', count: 0 },
            { programId: 2, unit: 'municipality', count: null },
            { programId: 6, unit: 'health-district', count: 1 },
        ]);

        expect(markup).toContain('>—</span>');
        expect(markup).toContain('reporting locations unavailable');
        expect(markup).toContain('>0</span>');
        expect(markup).toContain('>1</span>');
        expect(markup).toContain('>Unavailable</span>');
        expect(coverageFigures(markup)).toEqual([
            '0 households',
            'Unavailable municipalities',
            '1 health district',
        ]);
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
});
