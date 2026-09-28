'use client';

import type { MetricFormat } from '@/features/dashboard/utils/metric-definitions';
import { useFormatter, useTranslations } from 'next-intl';

export function useFormatMetric() {
    const formatter = useFormatter();
    return (value: number, format: MetricFormat) =>
        format === 'percent'
            ? formatter.number(value, {
                  style: 'percent',
                  maximumFractionDigits: 0,
              })
            : formatter.number(value, {
                  maximumFractionDigits: format === 'decimal' ? 1 : 0,
              });
}

export default function MetricValue({
    value,
    format,
}: {
    value: number | null;
    format: MetricFormat;
}) {
    const t = useTranslations('MetricTable');
    const formatMetric = useFormatMetric();

    if (value === null) {
        return (
            <span className="text-muted-foreground">
                <span aria-hidden="true">—</span>
                <span className="sr-only">{t('noValue')}</span>
            </span>
        );
    }
    return formatMetric(value, format);
}
