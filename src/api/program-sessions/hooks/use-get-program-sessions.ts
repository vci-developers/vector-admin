import {
    getProgramSessionsResponseSchema,
    type ProgramSessions,
} from '@/api/program-sessions/validation/program-sessions-schema';
import type { NetworkError } from '@/lib/network/network-error';
import { err, type Result } from '@/lib/result/result';
import {
    programSessionsKeys,
    type ProgramSessionsParams,
} from '@/api/program-sessions/program-sessions-keys';
import { useQuery } from '@tanstack/react-query';

async function fetchProgramSessions(
    programId: number,
    { from, to, types, testSites }: ProgramSessionsParams,
): Promise<Result<ProgramSessions, NetworkError>> {
    const searchParams = new URLSearchParams({
        programId: String(programId),
        from,
        to,
        types: types.join(','),
        testSites: String(testSites),
    });
    const response = await fetch(`/api/program-sessions?${searchParams}`, {
        credentials: 'include',
    }).catch(() => null);
    if (!response) return err({ kind: 'network' });

    const body = getProgramSessionsResponseSchema.safeParse(
        await response.json().catch(() => null),
    );
    return body.success
        ? body.data
        : err({ kind: 'client', status: response.status });
}

export function useGetProgramSessions(
    programId: number | null,
    params: ProgramSessionsParams,
) {
    return useQuery({
        queryKey: programSessionsKeys.sessions(programId, params),
        queryFn: () => fetchProgramSessions(programId ?? 0, params),
        enabled: programId !== null,
    });
}
