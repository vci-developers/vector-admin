export type Period = { from: string; to: string };

export const programSessionsKeys = {
    root: ['program-sessions'] as const,
    sessions: (programId: number | null, period: Period) =>
        ['program-sessions', programId, period] as const,
};
