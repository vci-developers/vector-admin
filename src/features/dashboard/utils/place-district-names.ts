import { placeLabels, type LabelBox } from './place-labels';

/** Keep every name visible; move labels rather than hiding reporting places. */
export function placeDistrictNames(
    names: LabelBox[],
    viewport: { width: number; height: number },
    obstacles: LabelBox[],
): Map<string, LabelBox> {
    const placed = new Map<string, LabelBox>();
    const reserved = [...obstacles];
    const padding = 14;
    const bottomPadding = 28;
    for (const original of names) {
        const width = Math.min(
            original.width,
            Math.max(40, viewport.width - padding * 2),
        );
        const height = original.height;
        const minimumX = padding + width / 2;
        const maximumX = Math.max(
            minimumX,
            viewport.width - padding - width / 2,
        );
        const minimumY = padding + height / 2;
        const maximumY = Math.max(
            minimumY,
            viewport.height - bottomPadding - height / 2,
        );
        const candidate = (x: number, y: number): LabelBox => ({
            key: original.key,
            x: Math.max(minimumX, Math.min(maximumX, x)),
            y: Math.max(minimumY, Math.min(maximumY, y)),
            width,
            height,
        });
        const candidates = [candidate(original.x, original.y)];
        for (const radius of [24, 48, 72, 96, 128, 164, 208, 256, 320]) {
            for (let direction = 0; direction < 8; direction++) {
                const angle = (direction * Math.PI) / 4;
                candidates.push(
                    candidate(
                        original.x + Math.cos(angle) * radius,
                        original.y + Math.sin(angle) * radius,
                    ),
                );
            }
        }
        // At a continental scale several anchors can occupy the same pixel.
        // The viewport grid supplies room for all names around that footprint.
        for (let y = minimumY; y <= maximumY; y += height + 10) {
            for (let x = minimumX; x <= maximumX; x += 24)
                candidates.push(candidate(x, y));
        }
        const distance = (box: LabelBox) =>
            (box.x - original.x) ** 2 + (box.y - original.y) ** 2;
        candidates.sort((a, b) => distance(a) - distance(b));
        const chosen =
            candidates.find(box => placeLabels([box], reserved).has(box.key)) ??
            // Keep the name present even if a very small viewport is crowded.
            candidates.toSorted((a, b) => {
                const overlaps = (box: LabelBox) =>
                    reserved.filter(
                        other =>
                            Math.abs(box.x - other.x) * 2 <
                                box.width + other.width + 8 &&
                            Math.abs(box.y - other.y) * 2 <
                                box.height + other.height + 8,
                    ).length;
                return overlaps(a) - overlaps(b) || distance(a) - distance(b);
            })[0];
        placed.set(original.key, chosen);
        reserved.push(chosen);
    }
    return placed;
}
