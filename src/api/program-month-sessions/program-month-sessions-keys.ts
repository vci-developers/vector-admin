export const programMonthSessionsKeys = {
    root: ['program-month-sessions'] as const,
    sessions: (programId: number | null, month: string) =>
        ['program-month-sessions', programId, month] as const,
};
