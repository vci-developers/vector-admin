import type { SessionScope } from '@/features/dashboard/utils/counted-sessions';

export type Period = { from: string; to: string };

export type ProgramSessionsParams = Period & SessionScope;

export const programSessionsKeys = {
    root: ['program-sessions'] as const,
    sessions: (programId: number | null, params: ProgramSessionsParams) =>
        ['program-sessions', programId, params] as const,
};
