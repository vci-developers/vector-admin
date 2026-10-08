export const coverageKeys = {
    root: ['coverage'] as const,
    coverage: (exclude: number[]) => ['coverage', exclude] as const,
};
