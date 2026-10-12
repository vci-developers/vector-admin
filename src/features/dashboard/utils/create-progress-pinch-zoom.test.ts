import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgressPinchZoom } from './create-progress-pinch-zoom';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        setTimeout(() => callback(performance.now()), 16),
    );
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function viewport(initialZoom = 7) {
    let zoom = initialZoom;
    let minimum = 5.5;
    const start = vi.fn();
    const finish = vi.fn();
    const move = vi.fn<(next: number, anchor: string) => void>(next => {
        zoom = next;
    });
    const gesture = createProgressPinchZoom({
        getZoom: () => zoom,
        getMinZoom: () => minimum,
        getMaxZoom: () => 12,
        start,
        move,
        finish,
    });
    return {
        gesture,
        start,
        move,
        finish,
        zoom: () => zoom,
        minimum: (next: number) => {
            minimum = next;
        },
    };
}

describe('continuous progress map pinch zoom', () => {
    it('responds to tiny input smoothly without quarter-level jumps and completes only once', () => {
        const map = viewport();
        map.gesture.zoomBy(0.04, 'pinch origin');
        vi.advanceTimersByTime(16);
        expect(map.zoom()).toBeGreaterThan(7);
        expect(map.zoom()).toBeLessThan(7.04);
        expect(map.start).toHaveBeenCalledTimes(1);
        expect(map.finish).not.toHaveBeenCalled();
        vi.advanceTimersByTime(600);
        expect(map.zoom()).toBeCloseTo(7.04, 10);
        expect(
            map.move.mock.calls.every(
                ([, anchor]) => anchor === 'pinch origin',
            ),
        ).toBe(true);
        expect(map.start).toHaveBeenCalledTimes(1);
        expect(map.finish).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('coalesces rapid input into one frame and keeps gesture completion out of the live movement', () => {
        const map = viewport();
        for (let index = 0; index < 20; index++)
            map.gesture.zoomBy(0.01, `origin ${index}`);
        expect(map.move).not.toHaveBeenCalled();
        vi.advanceTimersByTime(16);
        expect(map.move).toHaveBeenCalledTimes(1);
        expect(map.move.mock.calls[0][1]).toBe('origin 19');
        for (let index = 0; index < 15; index++) {
            map.gesture.zoomBy(0.01, 'moving origin');
            vi.advanceTimersByTime(16);
            expect(map.finish).not.toHaveBeenCalled();
        }
        vi.advanceTimersByTime(600);
        expect(map.zoom()).toBeCloseTo(7.35, 10);
        expect(map.start).toHaveBeenCalledTimes(1);
        expect(map.finish).toHaveBeenCalledTimes(1);
    });

    it('stays within navigation limits and responds immediately when reversing away from a limit', () => {
        const map = viewport(11.9);
        map.gesture.zoomBy(100, 'edge');
        vi.advanceTimersByTime(600);
        expect(map.zoom()).toBe(12);
        map.gesture.zoomBy(100, 'edge');
        vi.advanceTimersByTime(16);
        map.gesture.zoomBy(-0.1, 'edge');
        vi.advanceTimersByTime(16);
        expect(map.zoom()).toBeLessThan(12);
        map.gesture.zoomBy(-100, 'edge');
        vi.advanceTimersByTime(800);
        expect(map.zoom()).toBe(5.5);
        for (const [zoom] of map.move.mock.calls) {
            expect(zoom).toBeGreaterThanOrEqual(5.5);
            expect(zoom).toBeLessThanOrEqual(12);
        }
    });

    it('discards outstanding input when another navigation starts and lets the next pinch start fresh', () => {
        const map = viewport();
        map.gesture.zoomBy(1, 'old origin');
        vi.advanceTimersByTime(16);
        const interruptedZoom = map.zoom();
        map.gesture.cancel(true);
        expect(map.finish).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(600);
        expect(map.zoom()).toBe(interruptedZoom);
        map.gesture.zoomBy(-0.2, 'new origin');
        vi.advanceTimersByTime(600);
        expect(map.zoom()).toBeCloseTo(interruptedZoom - 0.2, 10);
        expect(map.start).toHaveBeenCalledTimes(2);
        expect(map.finish).toHaveBeenCalledTimes(2);
    });

    it('reverses direction while the previous zoom is still catching up', () => {
        const map = viewport();
        map.gesture.zoomBy(1, 'origin');
        vi.advanceTimersByTime(16);
        const reversingAt = map.zoom();
        map.gesture.zoomBy(-0.1, 'origin');
        vi.advanceTimersByTime(16);
        expect(map.zoom()).toBeLessThan(reversingAt);
        vi.advanceTimersByTime(600);
        expect(map.zoom()).toBeCloseTo(reversingAt - 0.1, 10);
        expect(map.start).toHaveBeenCalledTimes(1);
        expect(map.finish).toHaveBeenCalledTimes(1);
    });

    it('drops animation and idle callbacks on cleanup without touching an unmounted map', () => {
        const map = viewport();
        map.gesture.zoomBy(1, 'origin');
        map.gesture.cancel();
        vi.advanceTimersByTime(600);
        expect(map.move).not.toHaveBeenCalled();
        expect(map.start).not.toHaveBeenCalled();
        expect(map.finish).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('ignores invalid or zero input and reclamps the target if navigation limits change', () => {
        const map = viewport();
        for (const delta of [0, Number.NaN, Infinity])
            map.gesture.zoomBy(delta, 'origin');
        expect(vi.getTimerCount()).toBe(0);
        map.gesture.zoomBy(-1, 'origin');
        map.minimum(6.75);
        vi.advanceTimersByTime(600);
        expect(map.zoom()).toBe(6.75);
        expect(map.finish).toHaveBeenCalledTimes(1);
    });
});
