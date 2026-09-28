export type DashboardParams = {
    exclude: number[];
    from?: string;
    to: string;
    month: string;
};

export const dashboardKeys = {
    root: ['dashboard'] as const,
    dashboard: (params: DashboardParams) => ['dashboard', params] as const,
};
