import type { Program } from '@/api/program/validation/program-schema';
import { describe, expect, it } from 'vitest';
import {
    buildProgressDevices,
    deviceFigures,
    activeDevicesByCountry,
    devicesInSelection,
    showsDeviceTarget,
} from './build-progress-devices';

const sheet = {
    projectedDevices: [
        { programId: 1, month: '2026-10', projected: 66 },
        { programId: 1, month: '2027-02', projected: 84 },
        { programId: 1, month: '2026-12', projected: 84 },
        { programId: 8, month: '2027-02', projected: 45 },
    ],
};

describe('buildProgressDevices', () => {
    it('reads the month’s count and the last column as the target', () => {
        expect(buildProgressDevices([1, 8, 3], '2026-10', sheet)).toEqual([
            {
                programId: 1,
                active: 66,
                target: 84,
                targetMonth: '2027-02',
                monthly: [{ month: '2026-10', active: 66 }],
            },
            {
                programId: 8,
                active: null,
                target: 45,
                targetMonth: '2027-02',
                monthly: [],
            },
            {
                programId: 3,
                active: null,
                target: null,
                targetMonth: null,
                monthly: [],
            },
        ]);
    });

    it('has nothing without the workbook', () => {
        expect(buildProgressDevices([1], '2026-10', null)).toEqual([
            {
                programId: 1,
                active: null,
                target: null,
                targetMonth: null,
                monthly: [],
            },
        ]);
    });
});

describe('showsDeviceTarget', () => {
    const october = '2026-10';
    it('shows the target for a period that runs up to now', () => {
        expect(
            showsDeviceTarget({ from: '2026-01', to: october }, october),
        ).toBe(true);
        expect(showsDeviceTarget({ to: '2026-11' }, october)).toBe(true);
    });

    it('shows the count alone for one month or an earlier period', () => {
        expect(showsDeviceTarget({ from: october, to: october }, october)).toBe(
            false,
        );
        expect(
            showsDeviceTarget({ from: '2026-03', to: '2026-06' }, october),
        ).toBe(false);
    });
});

describe('deviceFigures', () => {
    const devices = [
        {
            programId: 1,
            active: 66,
            target: 84,
            targetMonth: '2027-01',
            monthly: [],
        },
        {
            programId: 8,
            active: null,
            target: 45,
            targetMonth: '2027-02',
            monthly: [],
        },
        {
            programId: 3,
            active: null,
            target: null,
            targetMonth: null,
            monthly: [],
        },
    ];

    it('adds counts, and targets when shown', () => {
        expect(deviceFigures(devices, true)).toEqual({
            active: 66,
            target: 129,
            targetMonth: '2027-02',
        });
        expect(deviceFigures(devices, false)).toEqual({
            active: 66,
            target: null,
            targetMonth: null,
        });
    });

    it('has none when no Program has devices', () => {
        expect(deviceFigures(devices.slice(1), false)).toBeNull();
        expect(deviceFigures(devices.slice(2), true)).toBeNull();
    });

    it('narrows to a selected Area’s Programs', () => {
        expect(devicesInSelection(devices, [3, 8])).toEqual(devices.slice(1));
        expect(devicesInSelection(devices, null)).toEqual(devices);
    });
});

describe('activeDevicesByCountry', () => {
    it('adds up each country’s counts, leaving out countries without one', () => {
        const programs: Program[] = [
            { programId: 1, name: 'Uganda', country: 'Uganda' },
            { programId: 8, name: 'Pilgrim', country: 'Uganda' },
            { programId: 2, name: 'Colombia', country: 'Colombia' },
        ];
        const row = (programId: number, active: number | null) => ({
            programId,
            active,
            target: 1,
            targetMonth: '2027-02',
            monthly: active === null ? [] : [{ month: '2026-09', active: 2 }],
        });
        const counts = activeDevicesByCountry(
            [row(1, 66), row(8, 10), row(2, null)],
            programs,
        );
        expect(Object.fromEntries(counts)).toEqual({ Uganda: 76 });
        expect(
            Object.fromEntries(
                activeDevicesByCountry(
                    [row(1, 66), row(8, 10), row(2, null)],
                    programs,
                    '2026-09',
                ),
            ),
        ).toEqual({ Uganda: 4 });
    });
});
