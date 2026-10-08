import { coverageKeys } from '@/api/coverage/coverage-keys';
import {
    getCoverageResponseSchema,
    type CoverageResponse,
} from '@/api/coverage/validation/coverage-schema';
import type { NetworkError } from '@/lib/network/network-error';
import { err, type Result } from '@/lib/result/result';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

async function fetchCoverage(
    exclude: number[],
): Promise<Result<CoverageResponse, NetworkError>> {
    const searchParams = new URLSearchParams({ exclude: exclude.join(',') });
    const response = await fetch(`/api/coverage?${searchParams}`, {
        credentials: 'include',
    }).catch(() => null);
    if (!response) return err({ kind: 'network' });

    const body = getCoverageResponseSchema.safeParse(
        await response.json().catch(() => null),
    );
    return body.success
        ? body.data
        : err({ kind: 'client', status: response.status });
}

export function useGetCoverage(exclude: number[]) {
    return useQuery({
        queryKey: coverageKeys.coverage(exclude),
        queryFn: () => fetchCoverage(exclude),
        placeholderData: keepPreviousData,
    });
}
