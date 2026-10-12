import ProgressMonthlyChart from '@/features/dashboard/components/progress-monthly-chart';
import { NextIntlClientProvider } from 'next-intl';
import { createElement } from 'react';
import { jsx } from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarChart, ResponsiveContainer } from 'recharts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { monthlyChartLabelFits } from './monthly-chart-label-fits';

afterEach(() => vi.restoreAllMocks());

describe('monthly chart label visibility', () => {
    it('shows values above wide bars, including zero counts', () => {
        for (const value of ['1,234', '5,678', '0']) {
            expect(monthlyChartLabelFits(value, 64)).toBe(true);
        }
    });

    it('hides every value on narrow long-range bars instead of sampling labels', () => {
        const values = Object.freeze(
            Array.from({ length: 24 }, (_, index) =>
                index % 3 === 0 ? '0' : '1,234',
            ),
        );
        expect(values.some(value => monthlyChartLabelFits(value, 8))).toBe(
            false,
        );
        expect(values).toHaveLength(24);
        expect(values.filter(value => value === '0')).toHaveLength(8);
    });

    it('checks each exact value against its own bar width without abbreviating it', () => {
        expect(monthlyChartLabelFits('12', 32)).toBe(true);
        expect(monthlyChartLabelFits('123,456,789', 32)).toBe(false);
        expect(monthlyChartLabelFits('123,456,789', 104)).toBe(true);
    });

    it('responds to resized bars and hides labels until their width is known', () => {
        expect(monthlyChartLabelFits('1,234', 34)).toBe(false);
        expect(monthlyChartLabelFits('1,234', 56)).toBe(true);
        expect(monthlyChartLabelFits('1,234', 0)).toBe(false);
        expect(monthlyChartLabelFits('1,234', Number.NaN)).toBe(false);
        expect(monthlyChartLabelFits('', 64)).toBe(false);
    });
});

describe('monthly chart initial sizing', () => {
    it('detects the installed ResponsiveContainer negative-size warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        renderToStaticMarkup(
            jsx(ResponsiveContainer, {
                width: '100%',
                height: '100%',
                children: createElement(BarChart, { data: [] }),
            }),
        );
        expect(
            warn.mock.calls.some(([message]) =>
                String(message).includes('width(-1)'),
            ),
        ).toBe(true);
    });

    it.each([3, 24, 120])(
        'prerenders %i months without invalid-size warnings',
        count => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const months = Array.from({ length: count }, (_, index) => ({
                month: `${2024 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`,
                uniqueScans: index % 4 === 0 ? 0 : (index + 1) * 100,
            }));
            const markup = renderToStaticMarkup(
                jsx(NextIntlClientProvider, {
                    locale: 'en',
                    timeZone: 'UTC',
                    messages: {},
                    children: createElement(ProgressMonthlyChart, { months }),
                }),
            );
            expect(markup).toContain('role="region"');
            expect(markup).toContain('tabindex="0"');
            expect(markup).not.toContain('recharts-responsive-container');
            expect(markup).not.toContain('min-width:');
            expect(markup).not.toContain('Scroll horizontally');
            expect(
                warn.mock.calls.some(([message]) =>
                    String(message).includes('width('),
                ),
            ).toBe(false);
        },
    );
});
