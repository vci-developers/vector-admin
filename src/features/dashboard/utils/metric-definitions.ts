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

/** A count that goes into a ratio, named for the tooltip. */
export type CalculationTerm = {
    term:
        | 'images'
        | 'activeDevices'
        | 'completeRecords'
        | 'records'
        | 'submittedSessions'
        | 'certifiedSessions';
    value: number;
};

/** A ratio's working: the sum of the numerator over the sum of the denominator. */
export type MetricCalculation = {
    numerator: CalculationTerm[];
    denominator: CalculationTerm[];
};

export type MetricDefinition = {
    key: MetricKey;
    format: MetricFormat;
    value: (metrics: PeriodMetricsDto) => number | null;
    /** Ratios only; must reproduce `value` whenever the denominator is not 0. */
    calculation?: (metrics: PeriodMetricsDto) => MetricCalculation;
    /** Users log in to a Program, not a Site, so locations leave it blank. */
    programOnly?: true;
};

export const METRICS: MetricDefinition[] = [
    { key: 'activeDevices', format: 'count', value: m => m.activeDevices },
    { key: 'images', format: 'count', value: m => m.images },
    { key: 'uniqueSpecimens', format: 'count', value: m => m.uniqueSpecimens },
    {
        key: 'imagesPerActiveDevice',
        format: 'decimal',
        value: m => m.imagesPerActiveDevice,
        calculation: m => ({
            numerator: [{ term: 'images', value: m.images }],
            denominator: [{ term: 'activeDevices', value: m.activeDevices }],
        }),
    },
    {
        key: 'uniqueUsers',
        format: 'count',
        value: m => m.uniqueUsers,
        programOnly: true,
    },
    { key: 'logins', format: 'count', value: m => m.logins, programOnly: true },
    {
        key: 'metadataCompleteness',
        format: 'percent',
        value: m => m.metadataCompleteness,
        calculation: m => ({
            numerator: [{ term: 'completeRecords', value: m.completeRecords }],
            denominator: [{ term: 'records', value: m.records }],
        }),
    },
    {
        key: 'dhis2UploadRate',
        format: 'percent',
        value: m => m.dhis2UploadRate,
        calculation: m => ({
            numerator: [
                { term: 'submittedSessions', value: m.submittedSessions },
            ],
            denominator: [
                { term: 'certifiedSessions', value: m.certifiedSessions },
                { term: 'submittedSessions', value: m.submittedSessions },
            ],
        }),
    },
];

export const FIELDS: FieldKey[] = [
    'species',
    'captureDate',
    'geolocation',
    'operatorId',
];
