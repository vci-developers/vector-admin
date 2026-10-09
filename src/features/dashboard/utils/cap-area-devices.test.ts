import { describe, expect, it } from 'vitest';
import { areaShare, capAreaDevices } from './cap-area-devices';

const device = (
    deviceId: number,
    area: string,
    lastSubmittedAt: number,
    status = 'ACTIVE',
) => ({ deviceId, programId: 1, status, lastSubmittedAt, area });

describe('areaShare', () => {
    it("shares the month's figure over the Areas with Sessions", () => {
        expect(areaShare(66, 11)).toBe(6);
        expect(areaShare(24, 8)).toBe(3);
    });

    it('gives no cap without a projection or Areas', () => {
        expect(areaShare(undefined, 11)).toBeNull();
        expect(areaShare(66, 0)).toBeNull();
    });
});

describe('capAreaDevices', () => {
    const devices = [
        device(1, 'Karenga', 10),
        device(2, 'Karenga', 30),
        device(3, 'Karenga', 20),
        device(4, 'Gulu', 5),
        device(5, 'Karenga', 1, 'INACTIVE'),
    ];

    it("keeps each Area's most recently used active devices up to the cap", () => {
        const kept = capAreaDevices(
            devices,
            d => d.area,
            () => 2,
        );
        expect(kept.map(d => d.deviceId)).toEqual([2, 3, 4, 5]);
    });

    it('leaves a Program without a cap alone', () => {
        expect(
            capAreaDevices(
                devices,
                d => d.area,
                () => null,
            ),
        ).toEqual(devices);
    });
});
