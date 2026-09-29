import 'server-only';

import { loadProgramSnapshot } from '@/api/admin/load-program-snapshot';
import { loadPrograms } from '@/api/admin/load-programs';
import type { GetUserLoginsQuery } from '@/api/user-logins/validation/user-logins-schema';
import type { ProgramData } from '@/features/dashboard/utils/build-period-metrics';
import {
    buildUserLoginRows,
    type UserLoginRow,
} from '@/features/dashboard/utils/build-user-logins';
import type { NetworkError } from '@/lib/network/network-error';
import { ok, type Result } from '@/lib/result/result';

export type UserLoginsData = {
    users: UserLoginRow[];
    failedProgramIds: number[];
    programNames: Map<number, string>;
};

export async function getUserLogins({
    exclude,
    from,
    to,
}: GetUserLoginsQuery): Promise<Result<UserLoginsData, NetworkError>> {
    const programs = await loadPrograms();
    if (!programs.ok) return programs;

    const selected = programs.data.filter(p => !exclude.includes(p.programId));
    const snapshots = await Promise.all(
        selected.map(p => loadProgramSnapshot(p.programId)),
    );
    const loaded: ProgramData[] = [];
    const failedProgramIds: number[] = [];
    selected.forEach((program, index) => {
        const snapshot = snapshots[index];
        if (snapshot.ok) loaded.push({ program, snapshot: snapshot.data });
        else failedProgramIds.push(program.programId);
    });

    return ok({
        users: buildUserLoginRows(loaded, { from, to }),
        failedProgramIds,
        programNames: new Map(programs.data.map(p => [p.programId, p.name])),
    });
}
