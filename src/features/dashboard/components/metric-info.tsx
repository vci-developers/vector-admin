'use client';

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MetricKey } from '@/features/dashboard/utils/metric-definitions';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** An info icon whose tooltip says how the metric is derived. */
export default function MetricInfo({ metric }: { metric: MetricKey }) {
    const t = useTranslations('Metrics');
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
                    {t(`${metric}.description`)}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
