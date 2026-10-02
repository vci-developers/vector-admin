import 'server-only';

import { loadProgramSnapshot } from '@/api/admin/load-program-snapshot';
import { loadPrograms } from '@/api/admin/load-programs';
import type {
    GetProgramSessionsQuery,
    ProgramSessions,
} from '@/api/program-sessions/validation/program-sessions-schema';
import { buildProgramSessions } from '@/features/dashboard/utils/build-program-sessions';
import { scopeSnapshot } from '@/features/dashboard/utils/counted-sessions';
import type { NetworkError } from '@/lib/network/network-error';
import { err, ok, type Result } from '@/lib/result/result';

export async function getProgramSessions({
    programId,
    from,
    to,
    ...scope
}: GetProgramSessionsQuery): Promise<Result<ProgramSessions, NetworkError>> {
    const programs = await loadPrograms();
    if (!programs.ok) return programs;

    const program = programs.data.find(p => p.programId === programId);
    if (!program) return err({ kind: 'not_found', status: 404 });

    const snapshot = await loadProgramSnapshot(programId);
    if (!snapshot.ok) return snapshot;

    return ok({
        programId,
        from,
        to,
        sessions: buildProgramSessions(
            scopeSnapshot(snapshot.data, scope),
            program.country,
            {
                from,
                to,
            },
        ),
    });
}
