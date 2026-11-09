/**
 * The timeline's exact position, in months from the first. It moves every
 * frame, so only what must follow it subscribes; the page hears whole months.
 */
export type TimelineClock = {
    get: () => number;
    set: (position: number) => void;
    subscribe: (listener: () => void) => () => void;
};

export function createTimelineClock(): TimelineClock {
    let position = 0;
    const listeners = new Set<() => void>();
    return {
        get: () => position,
        set: next => {
            if (next === position) return;
            position = next;
            listeners.forEach(listener => listener());
        },
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
