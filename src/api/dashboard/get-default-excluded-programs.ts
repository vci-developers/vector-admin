import 'server-only';

import { loadPrograms } from '@/api/admin/load-programs';
import {
    defaultExcludedPrograms,
    HIDDEN_BY_DEFAULT_PROGRAM_IDS,
} from '@/features/dashboard/utils/default-excluded-programs';
import { canSeeProgram } from '@/lib/auth-session/viewer';
import { withViewer } from '@/lib/auth-session/with-viewer';
import { ok } from '@/lib/result/result';

/**
 * The Program Filter's starting selection for this viewer, worked out before
 * the page renders so the first load already asks for it.
 */
export async function getDefaultExcludedPrograms(): Promise<number[]> {
    const result = await withViewer(async viewer => {
        const programs = await loadPrograms();
        if (!programs.ok) return programs;
        return ok(
            defaultExcludedPrograms(
                viewer.role,
                programs.data.filter(program =>
                    canSeeProgram(viewer, program.programId),
                ),
            ),
        );
    });
    // A viewer the routes will refuse anyway; the page shows that error.
    return result.ok ? result.data : HIDDEN_BY_DEFAULT_PROGRAM_IDS;
}
