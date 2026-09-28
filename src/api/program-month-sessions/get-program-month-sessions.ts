import 'server-only';

import { loadProgramSnapshot } from '@/api/admin/load-program-snapshot';
import { loadPrograms } from '@/api/admin/load-programs';
import type {
    GetProgramMonthSessionsQuery,
    ProgramMonthSessions,
} from '@/api/program-month-sessions/validation/program-month-sessions-schema';
import { buildProgramMonthSessions } from '@/features/dashboard/utils/build-program-month-sessions';
import type { NetworkError } from '@/lib/network/network-error';
import { err, ok, type Result } from '@/lib/result/result';

export async function getProgramMonthSessions({
    programId,
    month,
}: GetProgramMonthSessionsQuery): Promise<
    Result<ProgramMonthSessions, NetworkError>
> {
    const programs = await loadPrograms();
    if (!programs.ok) return programs;

    const program = programs.data.find(p => p.programId === programId);
    if (!program) return err({ kind: 'not_found', status: 404 });

    const snapshot = await loadProgramSnapshot(programId);
    if (!snapshot.ok) return snapshot;

    return ok({
        programId,
        month,
        sessions: buildProgramMonthSessions(
            snapshot.data,
            program.country,
            month,
        ),
    });
}
