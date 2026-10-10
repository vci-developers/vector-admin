import { monthsInRange } from './month-key';
import {
    prepareProgressData,
    type ProgressProgramData,
} from './build-progress';
import type { ResolvedRange } from './resolve-reporting-range';

/** Excel-only operating figures. Device identities never leave the server. */
export type ProgressDeviceMonth = {
    programId: number;
    programName: string;
    country: string;
    month: string;
    /** Known distinct device ids; incomplete flags any missing device identity. */
    reportingDevices: number;
    uniqueScans: number;
    /** Blank when devices are unknown, absent or incomplete. */
    scansPerReportingDevice: number | null;
    incomplete: boolean;
};

export function buildProgressDeviceMetrics(
    programs: ProgressProgramData[],
    range: ResolvedRange,
): ProgressDeviceMonth[] {
    const {
        from,
        to,
        programs: prepared,
    } = prepareProgressData(programs, range);
    const months = monthsInRange(from, to);
    return prepared.flatMap(({ program, sessions, scansBySession }) => {
        const monthly = new Map(
            months.map(month => [
                month,
                {
                    devices: new Set<number>(),
                    uniqueScans: 0,
                    incomplete: false,
                },
            ]),
        );
        for (const session of sessions) {
            const bucket = monthly.get(session.month)!;
            bucket.uniqueScans += scansBySession.get(session.sessionId) ?? 0;
            if (session.deviceId === null || session.deviceId === undefined) {
                bucket.incomplete = true;
            } else {
                bucket.devices.add(session.deviceId);
            }
        }
        return [...monthly].map(([month, bucket]) => ({
            programId: program.programId,
            programName: program.name,
            country: program.country,
            month,
            reportingDevices: bucket.devices.size,
            uniqueScans: bucket.uniqueScans,
            scansPerReportingDevice:
                bucket.incomplete || bucket.devices.size === 0
                    ? null
                    : bucket.uniqueScans / bucket.devices.size,
            incomplete: bucket.incomplete,
        }));
    });
}
