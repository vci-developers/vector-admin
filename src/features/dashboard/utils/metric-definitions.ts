import type { PeriodMetricsDto } from '@/api/dashboard/validation/dashboard-schema';

export type MetricFormat = 'count' | 'decimal' | 'percent';

export type MetricKey =
    | 'activeDevices'
    | 'images'
    | 'uniqueSpecimens'
    | 'imagesPerActiveDevice'
    | 'metadataCompleteness'
    | 'dhis2UploadRate'
    | 'uniqueUsers'
    | 'logins';

export type FieldKey = keyof PeriodMetricsDto['fieldCompleteness'];

export type MetricDefinition = {
    key: MetricKey;
    format: MetricFormat;
    value: (metrics: PeriodMetricsDto) => number | null;
};

export const METRICS: MetricDefinition[] = [
    { key: 'activeDevices', format: 'count', value: m => m.activeDevices },
    { key: 'images', format: 'count', value: m => m.images },
    { key: 'uniqueSpecimens', format: 'count', value: m => m.uniqueSpecimens },
    {
        key: 'imagesPerActiveDevice',
        format: 'decimal',
        value: m => m.imagesPerActiveDevice,
    },
    { key: 'uniqueUsers', format: 'count', value: m => m.uniqueUsers },
    { key: 'logins', format: 'count', value: m => m.logins },
    {
        key: 'metadataCompleteness',
        format: 'percent',
        value: m => m.metadataCompleteness,
    },
    {
        key: 'dhis2UploadRate',
        format: 'percent',
        value: m => m.dhis2UploadRate,
    },
];

export const FIELDS: FieldKey[] = [
    'species',
    'captureDate',
    'geolocation',
    'operatorId',
];
