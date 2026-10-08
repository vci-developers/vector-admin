/** A label's box in screen pixels, centred on (x, y). */
export type LabelBox = {
    key: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

/** Space kept clear around each label so neighbours never touch. */
const GAP = 4;

/**
 * The labels to draw so none overlaps another, taken in the order given
 * (most important first): each is kept only if it clears every one kept
 * before it.
 */
export function placeLabels(boxes: LabelBox[]): Set<string> {
    const kept: LabelBox[] = [];
    for (const box of boxes) {
        const clear = kept.every(
            other =>
                Math.abs(box.x - other.x) * 2 >=
                    box.width + other.width + 2 * GAP ||
                Math.abs(box.y - other.y) * 2 >=
                    box.height + other.height + 2 * GAP,
        );
        if (clear) kept.push(box);
    }
    return new Set(kept.map(box => box.key));
}
