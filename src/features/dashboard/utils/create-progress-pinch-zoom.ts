import { clampProgressMapZoom } from './progress-map-extent';

type PinchViewport<Anchor> = {
    getZoom: () => number;
    getMinZoom: () => number;
    getMaxZoom: () => number;
    start: () => void;
    move: (zoom: number, anchor: Anchor) => void;
    finish: () => void;
};

const SETTLED_DISTANCE = 0.001;
const RESPONSE_MS = 28;
const GESTURE_IDLE_MS = 140;

/** Continuous, frame-paced zoom; expensive map completion happens once per gesture. */
export function createProgressPinchZoom<Anchor>(map: PinchViewport<Anchor>) {
    let target: number | null = null;
    let anchor: Anchor | null = null;
    let frame: number | null = null;
    let idle: ReturnType<typeof setTimeout> | null = null;
    let started = false;
    let ending = false;
    let previousFrameAt = 0;
    let direction = 0;

    function cancel(finish = false) {
        if (frame !== null) cancelAnimationFrame(frame);
        if (idle !== null) clearTimeout(idle);
        frame = null;
        idle = null;
        target = null;
        anchor = null;
        ending = false;
        direction = 0;
        const moved = started;
        started = false;
        if (finish && moved) map.finish();
    }

    function render(now: number) {
        frame = null;
        if (target === null || anchor === null) return;
        target = clampProgressMapZoom(
            target,
            map.getMinZoom(),
            map.getMaxZoom(),
        );
        const current = map.getZoom();
        const elapsed = Math.max(0, now - previousFrameAt);
        previousFrameAt = now;
        const next =
            current +
            (target - current) * (1 - Math.exp(-elapsed / RESPONSE_MS));
        const settled = Math.abs(target - next) < SETTLED_DISTANCE;
        const zoom = settled ? target : next;
        if (zoom !== current) {
            if (!started) {
                started = true;
                map.start();
            }
            map.move(zoom, anchor);
        }
        if (!settled) frame = requestAnimationFrame(render);
        else if (ending) cancel(true);
    }

    function zoomBy(delta: number, nextAnchor: Anchor) {
        if (!Number.isFinite(delta) || delta === 0) return;
        const nextDirection = Math.sign(delta);
        // A reversed gesture responds immediately, without consuming a queued
        // zoom in the old direction or excess input beyond a zoom limit.
        if (direction !== 0 && direction !== nextDirection)
            target = map.getZoom();
        direction = nextDirection;
        target = clampProgressMapZoom(
            (target ?? map.getZoom()) + delta,
            map.getMinZoom(),
            map.getMaxZoom(),
        );
        anchor = nextAnchor;
        ending = false;
        if (idle !== null) clearTimeout(idle);
        idle = setTimeout(() => {
            idle = null;
            ending = true;
            if (frame === null) cancel(true);
        }, GESTURE_IDLE_MS);
        if (frame === null) {
            previousFrameAt = performance.now();
            frame = requestAnimationFrame(render);
        }
    }

    return { zoomBy, cancel };
}
