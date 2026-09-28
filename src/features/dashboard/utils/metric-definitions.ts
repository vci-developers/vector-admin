import type { MonthMetricsDto } from '@/api/dashboard/validation/dashboard-schema';

export type MetricFormat = 'count' | 'decimal' | 'percent';

export type MetricKey =
    | 'activeDevices'
    | 'scans'
    | 'uniqueSpecimens'
    | 'scansPerActiveDevice'
    | 'metadataCompleteness'
    | 'dhis2UploadRate'
    | 'uniqueUsers'
    | 'logins';

export type FieldKey = keyof MonthMetricsDto['fieldCompleteness'];

export type MetricDefinition = {
    key: MetricKey;
    format: MetricFormat;
    value: (metrics: MonthMetricsDto) => number | null;
};

export const METRICS: MetricDefinition[] = [
    { key: 'activeDevices', format: 'count', value: m => m.activeDevices },
    { key: 'scans', format: 'count', value: m => m.scans },
    { key: 'uniqueSpecimens', format: 'count', value: m => m.uniqueSpecimens },
    {
        key: 'scansPerActiveDevice',
        format: 'decimal',
        value: m => m.scansPerActiveDevice,
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
