import type {
    ProgressSession,
    ProgressSpecimen,
} from '@/api/progress/validation/progress-snapshot-schema';
import { describe, expect, it } from 'vitest';
import { buildProgress, type ProgressProgramData } from './build-progress';
import { buildProgressDeviceMetrics } from './build-progress-device-metrics';

const DEC = Date.UTC(2025, 11, 15);
const JAN = Date.UTC(2026, 0, 15);

const session = (
    sessionId: number,
    fields: Partial<ProgressSession> = {},
): ProgressSession => ({
    sessionId,
    siteId: 1,
    deviceId: 20,
    type: 'SURVEILLANCE',
    collectionDate: DEC,
    submittedAt: JAN,
    latitude: null,
    longitude: null,
    ...fields,
});

function program(
    programId: number,
    sessions: ProgressSession[],
    specimens: ProgressSpecimen[] = [],
): ProgressProgramData {
    return {
        program: { programId, country: 'Uganda', name: `Program ${programId}` },
        snapshot: {
            programId,
            sessions,
            specimens,
            sites: [
                {
                    siteId: 1,
                    name: null,
                    district: 'Gulu',
                    locationHierarchy: {},
                },
                {
                    siteId: 11,
                    name: null,
                    district: 'Other',
                    locationHierarchy: {},
                },
            ],
            collectionCycles: [],
            fetchedAt: 100,
        },
    };
}

describe('buildProgressDeviceMetrics', () => {
    it('uses distinct images rather than specimen rows in the device ratio', () => {
        const data = program(
            7,
            [session(1)],
            [
                {
                    id: 1,
                    sessionId: 1,
                    images: [{ id: 10 }, { id: 11 }, { id: 10 }],
                },
            ],
        );
        const period = { from: '2025-12', to: '2025-12' };
        const metrics = buildProgressDeviceMetrics([data], period);

        expect(metrics).toHaveLength(1);
        expect(metrics[0]).toMatchObject({
            reportingDevices: 1,
            uniqueScans: 2,
            scansPerReportingDevice: 2,
            incomplete: false,
        });
        expect(metrics[0].uniqueScans).toBe(
            buildProgress([data], period).uniqueScans,
        );
    });

    it('deduplicates scans and devices by program and month across a year boundary', () => {
        const first = session(1);
        const programs = [
            program(
                7,
                [
                    first,
                    first,
                    session(2),
                    session(3, { collectionDate: JAN }),
                    session(4, { deviceId: 21, collectionDate: JAN }), // Zero catch still active.
                ],
                [
                    { id: 1, sessionId: 1, images: [{ id: 10 }] },
                    { id: 1, sessionId: 1, images: [{ id: 10 }] },
                    { id: 2, sessionId: 2, images: [{ id: 20 }] },
                    { id: 3, sessionId: 3, images: [{ id: 30 }] },
                ],
            ),
            // Numeric ids can match in independent program snapshots.
            program(
                8,
                [session(1)],
                [{ id: 1, sessionId: 1, images: [{ id: 10 }] }],
            ),
        ];
        const period = { from: '2025-12', to: '2026-01' };
        const rows = buildProgressDeviceMetrics(programs, period);
        expect(
            rows.map(
                ({
                    programId,
                    month,
                    reportingDevices,
                    uniqueScans,
                    scansPerReportingDevice,
                }) => ({
                    programId,
                    month,
                    reportingDevices,
                    uniqueScans,
                    scansPerReportingDevice,
                }),
            ),
        ).toEqual([
            {
                programId: 7,
                month: '2025-12',
                reportingDevices: 1,
                uniqueScans: 2,
                scansPerReportingDevice: 2,
            },
            {
                programId: 7,
                month: '2026-01',
                reportingDevices: 2,
                uniqueScans: 1,
                scansPerReportingDevice: 0.5,
            },
            {
                programId: 8,
                month: '2025-12',
                reportingDevices: 1,
                uniqueScans: 1,
                scansPerReportingDevice: 1,
            },
            {
                programId: 8,
                month: '2026-01',
                reportingDevices: 0,
                uniqueScans: 0,
                scansPerReportingDevice: null,
            },
        ]);
        expect(rows.reduce((sum, row) => sum + row.uniqueScans, 0)).toBe(
            buildProgress(programs, period).uniqueScans,
        );
    });

    it('uses the same surveillance, test-site, orphan-record and reporting-period scope as progress', () => {
        const programs = [
            program(
                7,
                [
                    session(1),
                    session(2, { type: 'PRACTICE', deviceId: 22 }),
                    session(3, { siteId: 11, deviceId: 23 }),
                    session(4, { collectionDate: JAN, deviceId: 24 }),
                    session(5, { type: '', deviceId: 25 }),
                ],
                [
                    { id: 1, sessionId: 1, images: [{ id: 10 }] },
                    { id: 2, sessionId: 2, images: [{ id: 20 }] },
                    { id: 3, sessionId: 3, images: [{ id: 30 }] },
                    { id: 4, sessionId: 4, images: [{ id: 40 }] },
                    { id: 5, sessionId: 5, images: [{ id: 50 }] },
                    { id: 6, sessionId: 99, images: [{ id: 60 }] },
                ],
            ),
        ];
        const rows = buildProgressDeviceMetrics(programs, {
            from: '2025-12',
            to: '2025-12',
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            reportingDevices: 1,
            uniqueScans: 1,
            scansPerReportingDevice: 1,
            incomplete: false,
        });
        expect(rows[0]).not.toHaveProperty('deviceId');
    });

    it('suppresses the ratio if any reporting session lacks a device identity', () => {
        const rows = buildProgressDeviceMetrics(
            [
                program(
                    7,
                    [session(1), session(2, { deviceId: null })],
                    [
                        { id: 1, sessionId: 1, images: [{ id: 10 }] },
                        { id: 2, sessionId: 2, images: [{ id: 20 }] },
                    ],
                ),
            ],
            {
                from: '2025-12',
                to: '2025-12',
            },
        );
        expect(rows[0]).toMatchObject({
            reportingDevices: 1,
            uniqueScans: 2,
            scansPerReportingDevice: null,
            incomplete: true,
        });
        const unknown = buildProgressDeviceMetrics(
            [program(7, [session(1, { deviceId: undefined })])],
            {
                from: '2025-12',
                to: '2025-12',
            },
        );
        expect(unknown[0]).toMatchObject({
            reportingDevices: 0,
            scansPerReportingDevice: null,
            incomplete: true,
        });
    });

    it('uses local reporting months and upload time fallback', () => {
        const data = program(
            7,
            [
                session(1, {
                    collectionDate: Date.UTC(2025, 11, 31, 22),
                }),
                session(2, {
                    collectionDate: null,
                    submittedAt: JAN,
                    deviceId: 21,
                }),
            ],
            [
                { id: 1, sessionId: 1, images: [{ id: 10 }] },
                { id: 2, sessionId: 2, images: [{ id: 20 }] },
            ],
        );
        data.snapshot.collectionCycles = [
            {
                id: 1,
                cycleNumber: 1,
                startDate: DEC,
                endDate: JAN,
                timezone: 'Africa/Kampala',
            },
        ];
        const rows = buildProgressDeviceMetrics([data], {
            from: '2026-01',
            to: '2026-01',
        });
        expect(rows[0]).toMatchObject({
            month: '2026-01',
            reportingDevices: 2,
            uniqueScans: 2,
            scansPerReportingDevice: 1,
        });
    });
});
