import {
    progressKeys,
    PROGRESS_SCAN_COUNT_VERSION,
    type ProgressParams,
} from '@/api/progress/progress-keys';
import {
    getProgressResponseSchema,
    type ProgressDashboard,
} from '@/api/progress/validation/progress-schema';
import type { NetworkError } from '@/lib/network/network-error';
import { err, type Result } from '@/lib/result/result';
import { useQuery } from '@tanstack/react-query';

async function fetchProgress(
    params: ProgressParams,
): Promise<Result<ProgressDashboard, NetworkError>> {
    const searchParams = new URLSearchParams({
        exclude: params.exclude.join(','),
        to: params.to,
        types: params.types.join(','),
        ...(params.from ? { from: params.from } : {}),
    });
    const response = await fetch(`/api/progress?${searchParams}`, {
        credentials: 'include',
    }).catch(() => null);
    if (!response) return err({ kind: 'network' });

    const body = getProgressResponseSchema.safeParse(
        await response.json().catch(() => null),
    );
    return body.success
        ? body.data
        : err({ kind: 'client', status: response.status });
}

export function useGetProgress(params: ProgressParams) {
    return useQuery({
        queryKey: progressKeys.dashboard(params),
        queryFn: () => fetchProgress(params),
        // Keep transitions between periods smooth, but never show an older
        // scan/location definition response under the new metric labels.
        placeholderData: (previous, previousQuery) =>
            previousQuery?.queryKey[1] === PROGRESS_SCAN_COUNT_VERSION
                ? previous
                : undefined,
    });
}
