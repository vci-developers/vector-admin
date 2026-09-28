import {
    dashboardKeys,
    type DashboardParams,
} from '@/api/dashboard/dashboard-keys';
import {
    getDashboardResponseSchema,
    type Dashboard,
} from '@/api/dashboard/validation/dashboard-schema';
import type { NetworkError } from '@/lib/network/network-error';
import { err, type Result } from '@/lib/result/result';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

async function fetchDashboard(
    params: DashboardParams,
): Promise<Result<Dashboard, NetworkError>> {
    const searchParams = new URLSearchParams({
        exclude: params.exclude.join(','),
        to: params.to,
        month: params.month,
        ...(params.from ? { from: params.from } : {}),
    });

    const response = await fetch(`/api/dashboard?${searchParams}`, {
        credentials: 'include',
    }).catch(() => null);
    if (!response) return err({ kind: 'network' });

    const body = getDashboardResponseSchema.safeParse(
        await response.json().catch(() => null),
    );
    return body.success
        ? body.data
        : err({ kind: 'client', status: response.status });
}

export function useGetDashboard(params: DashboardParams) {
    return useQuery({
        queryKey: dashboardKeys.dashboard(params),
        queryFn: () => fetchDashboard(params),
        // Keep the old tables on screen while a filter change loads.
        placeholderData: keepPreviousData,
    });
}
