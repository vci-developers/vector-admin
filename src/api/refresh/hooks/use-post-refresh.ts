import { dashboardKeys } from '@/api/dashboard/dashboard-keys';
import { programMonthSessionsKeys } from '@/api/program-month-sessions/program-month-sessions-keys';
import type { NetworkError } from '@/lib/network/network-error';
import { err, type Result } from '@/lib/result/result';
import { resultSchema } from '@/lib/result/result-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

const refreshResponseSchema = resultSchema(z.null());

async function postRefresh(
    programIds: number[],
): Promise<Result<null, NetworkError>> {
    const response = await fetch(
        `/api/refresh?programIds=${programIds.join(',')}`,
        { method: 'POST', credentials: 'include' },
    ).catch(() => null);
    if (!response) return err({ kind: 'network' });

    const body = refreshResponseSchema.safeParse(
        await response.json().catch(() => null),
    );
    return body.success
        ? body.data
        : err({ kind: 'client', status: response.status });
}

export function usePostRefresh() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: postRefresh,
        onSuccess: result => {
            if (result.ok) {
                queryClient.invalidateQueries({ queryKey: dashboardKeys.root });
                queryClient.invalidateQueries({
                    queryKey: programMonthSessionsKeys.root,
                });
            }
        },
    });
}
