import type { Device } from '@/api/device/validation/device-schema';
import type { Session } from '@/api/session/validation/session-schema';
import { isCountedSession, sessionBucketTime } from './counted-sessions';
import { isInsideCountry } from './country-bounding-boxes';
import { monthKeyOf, type MonthKey } from './month-key';

export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'NEVER_USED';

export type DeviceRow = {
    deviceId: number;
    model: string;
    programId: number;
    status: DeviceStatus;
    /**
     * GPS of the latest Session with an in-country fix (usually the latest
     * Session); null when no Session has one, or the device was never used.
     */
    position: { latitude: number; longitude: number } | null;
    /** Latest Session's Site, the fallback location when position is null. */
    siteId: number | null;
    lastSubmittedAt: number | null;
};

export function classifyDevices(
    devices: Device[],
    sessions: Session[],
    period: { from: MonthKey; to: MonthKey },
    country: string,
    timeZone: string,
): DeviceRow[] {
    const latestSession = new Map<number, Session>();
    const latestFix = new Map<number, Session>();
    const activeDeviceIds = new Set<number>();
    const isLater = (session: Session, current?: Session) =>
        !current || session.submittedAt > current.submittedAt;

    for (const session of sessions.filter(isCountedSession)) {
        if (isLater(session, latestSession.get(session.deviceId))) {
            latestSession.set(session.deviceId, session);
        }
        if (
            isInsideCountry(session.latitude, session.longitude, country) &&
            isLater(session, latestFix.get(session.deviceId))
        ) {
            latestFix.set(session.deviceId, session);
        }
        const month = monthKeyOf(sessionBucketTime(session), timeZone);
        if (month >= period.from && month <= period.to) {
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
        const fix = latestFix.get(device.deviceId);
        const position =
            fix && fix.latitude !== null && fix.longitude !== null
                ? { latitude: fix.latitude, longitude: fix.longitude }
                : null;

        return {
            deviceId: device.deviceId,
            model: device.model,
            programId: device.programId,
            status,
            position,
            siteId: latest?.siteId ?? null,
            lastSubmittedAt: latest?.submittedAt ?? null,
        };
    });
}
