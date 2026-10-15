'use client';

import type { CoverageDto } from '@/api/coverage/validation/coverage-schema';
import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import type { DisplayPeriod } from '@/features/dashboard/hooks/use-period-label';
import type { MetricKey } from '@/features/dashboard/utils/metric-definitions';
import { programCode } from '@/features/dashboard/utils/program-title';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import CoverageTiles from './coverage-tiles';
import DeployedModelsTile from './deployed-models-tile';
import KpiTiles, { SUMMARY_ROW } from './kpi-tiles';

/** A Stakeholder's headline tiles, above the coverage figures. */
const STAKEHOLDER_TILES: MetricKey[] = [
    'uniqueSpecimens',
    'metadataCompleteness',
    'dhis2UploadRate',
];

export default function PeriodSummary({
    dashboard,
    coverage,
    period,
}: {
    dashboard: Dashboard;
    coverage: CoverageDto | null;
    period: DisplayPeriod;
}) {
    const t = useTranslations('Summary');

    const { total } = dashboard.metrics;
    const isDeveloper = dashboard.viewer === 'developer';
    // Each Program's figures for the headline tiles, in the page's order.
    const breakdown = useMemo(() => {
        const figures = new Map(
            dashboard.metrics.programs.map(row => [row.programId, row.metrics]),
        );
        return dashboard.programs.flatMap(program => {
            const metrics = figures.get(program.programId);
            return metrics
                ? [
                      {
                          programId: program.programId,
                          name: program.country || program.name,
                          code: programCode(program),
                          metrics,
                      },
                  ]
                : [];
        });
    }, [dashboard]);
    const incomplete = dashboard.failedProgramIds.length > 0;
    const countries = new Set(
        dashboard.programs
            .filter(p => dashboard.selectedProgramIds.includes(p.programId))
            .map(p => p.country),
    );
    const scope =
        countries.size === 1 ? [...countries][0] : t('allSelectedCountries');

    return (
        // A Stakeholder's heading is in the toolbar (DashboardView).
        <section
            aria-labelledby="summary-heading"
            className="flex flex-col gap-(--d-grid)"
        >
            {isDeveloper && (
                // Laid out like the Stakeholder page's line under its filters.
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h2
                        id="summary-heading"
                        className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-base sm:text-lg"
                    >
                        <span className="text-foreground font-semibold">
                            {scope}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium whitespace-nowrap">
                            {period.label}
                        </span>
                    </h2>
                    {period.inProgress && (
                        <span className="bg-primary/8 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium">
                            {t('currentMonthInProgress')}
                        </span>
                    )}
                </div>
            )}
            {isDeveloper ? (
                total && <KpiTiles current={total} incomplete={incomplete} />
            ) : (
                <div className={SUMMARY_ROW}>
                    {total && (
                        // No trend line: Stakeholders get the period's figures alone.
                        <KpiTiles
                            current={total}
                            incomplete={incomplete}
                            keys={STAKEHOLDER_TILES}
                            asCells
                            breakdown={breakdown}
                        />
                    )}
                    <CoverageTiles
                        coverage={coverage}
                        userCoverage={dashboard.userCoverage}
                        programs={dashboard.programs}
                        asCells
                    />
                    <DeployedModelsTile
                        programs={dashboard.programs.filter(program =>
                            dashboard.selectedProgramIds.includes(
                                program.programId,
                            ),
                        )}
                    />
                </div>
            )}
        </section>
    );
}
