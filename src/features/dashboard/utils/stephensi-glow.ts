// One breath in and out: the CSS runs 1.6s each way, alternating.
const GLOW_CYCLE_MS = 3200;

/** A negative delay that starts a new glow in step with every other one. */
export function stephensiGlowDelay(): string {
    return `${-(performance.now() % GLOW_CYCLE_MS)}ms`;
}

/** A stable ref callback, so React sets the delay only when the element mounts. */
export function syncStephensiGlow(element: HTMLElement | null) {
    if (element) element.style.animationDelay = stephensiGlowDelay();
}
