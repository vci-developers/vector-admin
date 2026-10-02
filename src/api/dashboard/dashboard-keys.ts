import type { SessionScope } from '@/features/dashboard/utils/counted-sessions';

export type DashboardParams = SessionScope & {
    exclude: number[];
    from?: string;
    to: string;
};

export const dashboardKeys = {
    root: ['dashboard'] as const,
    dashboard: (params: DashboardParams) => ['dashboard', params] as const,
};
