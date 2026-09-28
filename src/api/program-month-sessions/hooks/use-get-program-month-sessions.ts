import {
    getProgramMonthSessionsResponseSchema,
    type ProgramMonthSessions,
} from '@/api/program-month-sessions/validation/program-month-sessions-schema';
import type { NetworkError } from '@/lib/network/network-error';
import { err, type Result } from '@/lib/result/result';
import { programMonthSessionsKeys } from '@/api/program-month-sessions/program-month-sessions-keys';
import { useQuery } from '@tanstack/react-query';

async function fetchProgramMonthSessions(
    programId: number,
    month: string,
): Promise<Result<ProgramMonthSessions, NetworkError>> {
    const searchParams = new URLSearchParams({
        programId: String(programId),
        month,
    });
    const response = await fetch(
        `/api/program-month-sessions?${searchParams}`,
        {
            credentials: 'include',
        },
    ).catch(() => null);
    if (!response) return err({ kind: 'network' });

    const body = getProgramMonthSessionsResponseSchema.safeParse(
        await response.json().catch(() => null),
    );
    return body.success
        ? body.data
        : err({ kind: 'client', status: response.status });
}

export function useGetProgramMonthSessions(
    programId: number | null,
    month: string,
) {
    return useQuery({
        queryKey: programMonthSessionsKeys.sessions(programId, month),
        queryFn: () => fetchProgramMonthSessions(programId ?? 0, month),
        enabled: programId !== null,
    });
}
