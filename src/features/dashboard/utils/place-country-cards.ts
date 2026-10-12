import { placeLabels, type LabelBox } from './place-labels';

export type CountryCardPoint = {
    key: string;
    country: string;
    x: number;
    y: number;
};
export type CountryCardPlacement = {
    side: 'left' | 'right';
    offsetY: number;
    cardWidth: number;
};

const CARD_HEIGHT = 48;
const ANCHOR_GAP = 18;
const SIDE_PADDING = 12;
const BOTTOM_PADDING = 24;

function cardBox(
    node: CountryCardPoint,
    placement: CountryCardPlacement,
): LabelBox {
    const left =
        placement.side === 'right'
            ? node.x + ANCHOR_GAP
            : node.x - ANCHOR_GAP - placement.cardWidth;
    return {
        key: 'candidate',
        x: left + placement.cardWidth / 2,
        y: node.y + placement.offsetY,
        width: placement.cardWidth,
        height: CARD_HEIGHT,
    };
}

/** Moves labels, never geographic anchors. Every country always gets a card. */
export function placeCountryCards(
    nodes: readonly CountryCardPoint[],
    viewport: { width: number; height: number },
    obstacles: readonly LabelBox[] = [],
): Map<string, CountryCardPlacement> {
    const placements = new Map<string, CountryCardPlacement>();
    const reserved: LabelBox[] = [
        ...obstacles,
        ...nodes.map(node => ({
            key: node.key,
            x: node.x,
            y: node.y,
            width: 24,
            height: 24,
        })),
    ];
    const ordered = nodes.toSorted((a, b) =>
        a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
    );
    const offsets = [0];
    for (let step = 1; step <= Math.ceil(viewport.height / 60) + 1; step++)
        offsets.push(-60 * step, 60 * step);

    function fits(box: LabelBox) {
        if (
            box.x - box.width / 2 < SIDE_PADDING ||
            box.x + box.width / 2 > viewport.width - SIDE_PADDING ||
            box.y - CARD_HEIGHT / 2 < SIDE_PADDING ||
            box.y + CARD_HEIGHT / 2 > viewport.height - BOTTOM_PADDING
        )
            return false;
        // Check each obstacle separately: placeLabels may otherwise discard an
        // overlapping obstacle before it considers the candidate card.
        return reserved.every(obstacle =>
            placeLabels([{ ...obstacle, key: 'reserved' }, box]).has(box.key),
        );
    }

    for (const node of ordered) {
        const cardWidth = Math.max(110, node.country.length * 8.5 + 24);
        let chosen: CountryCardPlacement | null = null;
        for (const offsetY of offsets) {
            for (const side of ['right', 'left'] as const) {
                const candidate = { side, offsetY, cardWidth };
                if (fits(cardBox(node, candidate))) {
                    chosen = candidate;
                    break;
                }
            }
            if (chosen) break;
        }
        if (!chosen) {
            const overflow = (side: CountryCardPlacement['side']) => {
                const box = cardBox(node, { side, offsetY: 0, cardWidth });
                return (
                    Math.max(0, SIDE_PADDING - (box.x - cardWidth / 2)) +
                    Math.max(
                        0,
                        box.x + cardWidth / 2 - (viewport.width - SIDE_PADDING),
                    )
                );
            };
            const side =
                overflow('left') < overflow('right') ? 'left' : 'right';
            const minimumY = SIDE_PADDING + CARD_HEIGHT / 2;
            const maximumY = Math.max(
                minimumY,
                viewport.height - BOTTOM_PADDING - CARD_HEIGHT / 2,
            );
            const centreY = Math.max(minimumY, Math.min(maximumY, node.y));
            chosen = { side, offsetY: centreY - node.y, cardWidth };
        }
        placements.set(node.key, chosen);
        reserved.push(cardBox(node, chosen));
    }
    return placements;
}
