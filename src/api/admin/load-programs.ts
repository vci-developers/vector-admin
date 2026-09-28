import 'server-only';

import { adminGetAll } from '@/api/admin/admin-client';
import {
    getProgramsPageSchema,
    type Program,
} from '@/api/program/validation/program-schema';
import type { NetworkError } from '@/lib/network/network-error';
import type { Result } from '@/lib/result/result';
import { cacheLife, cacheTag } from 'next/cache';

export const PROGRAMS_TAG = 'programs';

export async function loadPrograms(): Promise<Result<Program[], NetworkError>> {
    'use cache';
    cacheTag(PROGRAMS_TAG);

    const programs = await adminGetAll('/programs', {}, getProgramsPageSchema);
    if (programs.ok) cacheLife('hours');
    else cacheLife('seconds');
    return programs;
}
