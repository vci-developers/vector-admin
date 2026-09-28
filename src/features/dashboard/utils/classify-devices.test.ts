import type { Device } from '@/api/device/validation/device-schema';
import type { Session } from '@/api/session/validation/session-schema';
import { describe, expect, it } from 'vitest';
import { classifyDevices } from './classify-devices';

const KAMPALA = { latitude: 0.35, longitude: 32.58 };
const GULU = { latitude: 2.78, longitude: 32.3 };

function device(deviceId: number): Device {
    return {
        deviceId,
        model: 'samsung SM-A155M',
        ssaid: `ssaid-${deviceId}`,
        programId: 1,
        registeredAt: 0,
        submittedAt: null,
    };
}

function session(
    sessionId: number,
    deviceId: number,
    collectionDate: number,
    position: { latitude: number | null; longitude: number | null } = KAMPALA,
): Session {
    return {
        sessionId,
        deviceId,
        siteId: 1,
        type: 'SURVEILLANCE',
        state: 'CERTIFIED',
        collectorName: 'Jane Doe',
        collectionDate,
        createdAt: collectionDate,
        submittedAt: collectionDate,
        ...position,
    };
}

const JAN = Date.UTC(2026, 0, 10);
const MAR = Date.UTC(2026, 2, 10);
const classify = (devices: Device[], sessions: Session[]) =>
    classifyDevices(
        devices,
        sessions,
        { from: '2026-03', to: '2026-03' },
        'Uganda',
        'Africa/Kampala',
    );

describe('classifyDevices', () => {
    it('marks devices Active, Inactive or Never Used for the month', () => {
        const rows = classify(
            [device(1), device(2), device(3)],
            [session(1, 1, MAR), session(2, 2, JAN)],
        );

        expect(rows.map(row => [row.deviceId, row.status])).toEqual([
            [1, 'ACTIVE'],
            [2, 'INACTIVE'],
            [3, 'NEVER_USED'],
        ]);
    });

    it('places a roaming device once, at its latest Session', () => {
        const rows = classify(
            [device(1)],
            [session(1, 1, JAN, KAMPALA), session(2, 1, MAR, GULU)],
        );

        expect(rows).toHaveLength(1);
        expect(rows[0].position).toEqual(GULU);
        expect(rows[0].lastSubmittedAt).toBe(MAR);
    });

    it('leaves a device unplaced for null or out-of-country GPS', () => {
        const rows = classify(
            [device(1), device(2)],
            [
                session(1, 1, MAR, { latitude: null, longitude: null }),
                session(2, 2, MAR, { latitude: 23.04, longitude: 72.52 }),
            ],
        );

        expect(rows.map(row => row.position)).toEqual([null, null]);
    });
});
