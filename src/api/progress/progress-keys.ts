export type ProgressParams = {
    exclude: number[];
    from?: string;
    to: string;
};

export const PROGRESS_SCAN_COUNT_VERSION = 'image-count-v1-locations-v3';

export const progressKeys = {
    root: ['progress'] as const,
    dashboard: (params: ProgressParams) =>
        ['progress', PROGRESS_SCAN_COUNT_VERSION, params] as const,
};
