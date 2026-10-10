import ProgressMonthlyChart from '@/features/dashboard/components/progress-monthly-chart';
import { NextIntlClientProvider } from 'next-intl';
import { createElement } from 'react';
import { jsx } from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarChart, ResponsiveContainer } from 'recharts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { monthlyChartMinimumWidth } from './monthly-chart-minimum-width';

afterEach(() => vi.restoreAllMocks());

describe('monthly chart label spacing', () => {
    it('fits the default three months into a narrow sidebar', () => {
        const labels = [
            { month: 'Jan', value: '1,234' },
            { month: 'Feb', value: '5,678' },
            { month: 'Mar', value: '0' },
        ];
        expect(monthlyChartMinimumWidth(labels)).toBeLessThanOrEqual(300);
        expect(
            (monthlyChartMinimumWidth(labels) - 52) / 3,
        ).toBeGreaterThanOrEqual(76);
    });

    it('reserves a full readable column for every all-time month, including zeros', () => {
        const labels = Array.from({ length: 24 }, (_, index) => ({
            month: `${index % 2 ? 'Jan' : 'Dec'} ${2024 + Math.floor(index / 12)}`,
            value: index % 3 === 0 ? '0' : '1,234',
        }));
        const width = monthlyChartMinimumWidth(labels);
        expect(width).toBeGreaterThan(1800);
        expect((width - 52) / labels.length).toBeGreaterThanOrEqual(80);
    });

    it('widens columns for long exact scan totals instead of abbreviating them', () => {
        const ordinary = [
            { month: 'Jan', value: '12' },
            { month: 'Feb', value: '34' },
        ];
        const large = [
            { month: 'Jan', value: '123,456,789' },
            { month: 'Feb', value: '34' },
        ];
        expect(monthlyChartMinimumWidth(large)).toBeGreaterThan(
            monthlyChartMinimumWidth(ordinary),
        );
        expect(
            (monthlyChartMinimumWidth(large) - 52) / 2,
        ).toBeGreaterThanOrEqual(104);
    });

    it('accounts for longer localized month labels without changing the data', () => {
        const labels = Object.freeze([
            Object.freeze({ month: 'September 2026', value: '0' }),
            Object.freeze({ month: 'October 2026', value: '42' }),
        ]);
        expect(
            (monthlyChartMinimumWidth(labels) - 52) / 2,
        ).toBeGreaterThanOrEqual(122);
        expect(labels[0]).toEqual({ month: 'September 2026', value: '0' });
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

    it.each([3, 24])(
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
            expect(
                warn.mock.calls.some(([message]) =>
                    String(message).includes('width('),
                ),
            ).toBe(false);
        },
    );
});
