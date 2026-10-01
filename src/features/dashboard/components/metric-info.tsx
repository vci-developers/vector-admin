'use client';

import type { PeriodMetricsDto } from '@/api/dashboard/validation/dashboard-schema';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    METRICS,
    type CalculationTerm,
    type MetricKey,
} from '@/features/dashboard/utils/metric-definitions';
import { Info } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import MetricValue from './metric-value';

/** "94 Certified Sessions + 70 Submitted Sessions", bracketed when summed. */
function Terms({
    terms,
    bracketed,
}: {
    terms: CalculationTerm[];
    bracketed: boolean;
}) {
    const t = useTranslations('Metrics.terms');
    const formatter = useFormatter();
    const text = terms
        .map(({ term, value }) => `${formatter.number(value)} ${t(term)}`)
        .join(' + ');
    return bracketed && terms.length > 1 ? `(${text})` : text;
}

/**
 * An info icon whose tooltip says how the metric is derived and, given the
 * period's metrics, the ratio worked out with its real numbers.
 */
export default function MetricInfo({
    metric,
    metrics,
}: {
    metric: MetricKey;
    metrics?: PeriodMetricsDto;
}) {
    const t = useTranslations('Metrics');
    const definition = METRICS.find(m => m.key === metric);
    const calculation = metrics && definition?.calculation?.(metrics);
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label={t('howDerived', {
                            metric: t(`${metric}.title`),
                        })}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex shrink-0 rounded-full align-middle outline-none focus-visible:ring-[3px]"
                    >
                        <Info className="size-3.5" aria-hidden="true" />
                    </button>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    className="max-w-72 text-left font-normal"
                >
                    <p>{t(`${metric}.description`)}</p>
                    {calculation && definition && metrics && (
                        <p className="mt-2 border-t border-current/20 pt-2 tabular-nums">
                            <Terms
                                terms={calculation.numerator}
                                bracketed={false}
                            />
                            <br />
                            {'÷ '}
                            <Terms terms={calculation.denominator} bracketed />
                            <br />
                            {'= '}
                            <span className="font-semibold">
                                <MetricValue
                                    value={definition.value(metrics)}
                                    format={definition.format}
                                />
                            </span>
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
