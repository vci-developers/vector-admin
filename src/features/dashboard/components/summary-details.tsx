'use client';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { Card } from '@/components/ui/card';
import type { DisplayPeriod } from '@/features/dashboard/hooks/use-period-label';
import { buildSummaryGroups } from '@/features/dashboard/utils/summary-rows';
import { useMemo } from 'react';
import { panelClassName } from './panel-header';
import SessionPanel from './session-panel';
import SummaryTable from './summary-table';

/** Developers: the per-Program table and the Session panel, below the map. */
export default function SummaryDetails({
    dashboard,
    period,
}: {
    dashboard: Dashboard;
    period: DisplayPeriod;
}) {
    const groups = useMemo(() => buildSummaryGroups(dashboard), [dashboard]);
    const programs = useMemo(
        () => new Map(dashboard.programs.map(p => [p.programId, p])),
        [dashboard.programs],
    );
    const { total } = dashboard.metrics;
    if (!total) return null;
    return (
        <>
            <Card className={panelClassName}>
                <SummaryTable
                    groups={groups}
                    total={total}
                    totalIncomplete={dashboard.failedProgramIds.length > 0}
                />
            </Card>
            <SessionPanel programs={programs} period={period} />
        </>
    );
}
