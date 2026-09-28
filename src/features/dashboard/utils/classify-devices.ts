import type { Device } from '@/api/device/validation/device-schema';
import type { Session } from '@/api/session/validation/session-schema';
import { isCountedSession, sessionBucketTime } from './counted-sessions';
import { isInsideCountry } from './country-bounding-boxes';
import { monthKeyOf, type MonthKey } from './month-key';

export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'NEVER_USED';

export type DeviceRow = {
    deviceId: number;
    ssaid: string | null;
    model: string;
    programId: number;
    status: DeviceStatus;
    /** Latest Session's GPS; null when the device is unplaced or never used. */
    position: { latitude: number; longitude: number } | null;
    lastSubmittedAt: number | null;
};

export function classifyDevices(
    devices: Device[],
    sessions: Session[],
    month: MonthKey,
    country: string,
    timeZone: string,
): DeviceRow[] {
    const latestSession = new Map<number, Session>();
    const activeDeviceIds = new Set<number>();

    for (const session of sessions.filter(isCountedSession)) {
        const latest = latestSession.get(session.deviceId);
        if (!latest || session.submittedAt > latest.submittedAt) {
            latestSession.set(session.deviceId, session);
        }
        if (monthKeyOf(sessionBucketTime(session), timeZone) === month) {
            activeDeviceIds.add(session.deviceId);
        }
    }

    return devices.map(device => {
        const latest = latestSession.get(device.deviceId);
        const status: DeviceStatus = !latest
            ? 'NEVER_USED'
            : activeDeviceIds.has(device.deviceId)
              ? 'ACTIVE'
              : 'INACTIVE';
        const position =
            latest &&
            latest.latitude !== null &&
            latest.longitude !== null &&
            isInsideCountry(latest.latitude, latest.longitude, country)
                ? { latitude: latest.latitude, longitude: latest.longitude }
                : null;

        return {
            deviceId: device.deviceId,
            ssaid: device.ssaid,
            model: device.model,
            programId: device.programId,
            status,
            position,
            lastSubmittedAt: latest?.submittedAt ?? null,
        };
    });
}
