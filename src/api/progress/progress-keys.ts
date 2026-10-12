import type { ProgressSessionType } from '@/api/progress/validation/progress-schema';

export type ProgressParams = {
    exclude: number[];
    from?: string;
    to: string;
    types: ProgressSessionType[];
};

export const PROGRESS_SCAN_COUNT_VERSION =
    'image-count-v1-locations-v3-site-hierarchy-v1-types-v1';

export const progressKeys = {
    root: ['progress'] as const,
    dashboard: (params: ProgressParams) =>
        ['progress', PROGRESS_SCAN_COUNT_VERSION, params] as const,
};
