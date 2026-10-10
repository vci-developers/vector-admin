import { describe, expect, it } from 'vitest';
import {
    placeCountryCards,
    type CountryCardPlacement,
    type CountryCardPoint,
} from './place-country-cards';

const viewport = { width: 400, height: 400 };

function rectangle(node: CountryCardPoint, placement: CountryCardPlacement) {
    const left =
        placement.side === 'right'
            ? node.x + 18
            : node.x - 18 - placement.cardWidth;
    return {
        left,
        right: left + placement.cardWidth,
        top: node.y + placement.offsetY - 24,
        bottom: node.y + placement.offsetY + 24,
    };
}

function intersects(
    a: ReturnType<typeof rectangle>,
    b: ReturnType<typeof rectangle>,
) {
    return (
        a.left < b.right &&
        b.left < a.right &&
        a.top < b.bottom &&
        b.top < a.bottom
    );
}

describe('placeCountryCards', () => {
    it('keeps adjacent Uganda and Kenya cards clear of one another and both real anchors', () => {
        const nodes = [
            { key: 'uganda', country: 'Uganda', x: 100, y: 140 },
            { key: 'kenya', country: 'Kenya', x: 145, y: 140 },
        ];
        const placements = placeCountryCards(nodes, viewport);
        const cards = nodes.map(node =>
            rectangle(node, placements.get(node.key)!),
        );

        expect(intersects(cards[0], cards[1])).toBe(false);
        for (const card of cards) {
            for (const node of nodes) {
                expect(
                    intersects(card, {
                        left: node.x - 12,
                        right: node.x + 12,
                        top: node.y - 12,
                        bottom: node.y + 12,
                    }),
                ).toBe(false);
            }
        }
    });

    it('puts a right-edge country label on the left within the viewport', () => {
        const node = { key: 'uganda', country: 'Uganda', x: 380, y: 140 };
        const placement = placeCountryCards([node], viewport).get(node.key)!;

        expect(placement).toEqual({ side: 'left', offsetY: 0, cardWidth: 110 });
        expect(rectangle(node, placement).left).toBeGreaterThanOrEqual(12);
        expect(rectangle(node, placement).right).toBeLessThanOrEqual(
            viewport.width - 12,
        );
    });

    it('stacks three close country cards with separate vertical offsets', () => {
        const nodes = [
            { key: 'a', country: 'Albania', x: 110, y: 140 },
            { key: 'b', country: 'Kenya', x: 125, y: 140 },
            { key: 'c', country: 'Uganda', x: 140, y: 140 },
        ];
        const placements = placeCountryCards(nodes, viewport);
        const cards = nodes.map(node =>
            rectangle(node, placements.get(node.key)!),
        );

        expect(
            new Set(
                [...placements.values()].map(placement => placement.offsetY),
            ).size,
        ).toBe(3);
        for (let first = 0; first < cards.length; first++) {
            for (let second = first + 1; second < cards.length; second++)
                expect(intersects(cards[first], cards[second])).toBe(false);
        }
    });

    it('is independent of input order and does not change points or obstacles', () => {
        const nodes = [
            { key: 'z', country: 'Uganda', x: 145, y: 140 },
            { key: 'a', country: 'Kenya', x: 100, y: 140 },
        ];
        const obstacles = [
            { key: 'zoom', x: 35, y: 55, width: 42, height: 76 },
        ];
        const before = structuredClone({ nodes, obstacles });

        expect([...placeCountryCards(nodes, viewport, obstacles)]).toEqual([
            ...placeCountryCards(nodes.toReversed(), viewport, obstacles),
        ]);
        expect({ nodes, obstacles }).toEqual(before);
    });

    it('respects supplied obstacles and keeps a bounded fallback card when every candidate is blocked', () => {
        const node = { key: 'uganda', country: 'Uganda', x: 150, y: 120 };
        const placement = placeCountryCards([node], viewport, [
            { key: 'zoom', x: 200, y: 120, width: 120, height: 88 },
        ]).get(node.key)!;
        expect(placement).toEqual({ side: 'left', offsetY: 0, cardWidth: 110 });

        const corner = { key: 'kenya', country: 'Kenya', x: 385, y: 380 };
        const blocked = placeCountryCards([corner], viewport, [
            { key: 'blocked', x: 200, y: 200, width: 400, height: 400 },
        ]);
        const fallback = blocked.get(corner.key)!;
        const card = rectangle(corner, fallback);
        expect(blocked.size).toBe(1);
        expect(fallback.side).toBe('left');
        expect(card.left).toBeGreaterThanOrEqual(12);
        expect(card.top).toBeGreaterThanOrEqual(12);
        expect(card.right).toBeLessThanOrEqual(viewport.width - 12);
        expect(card.bottom).toBeLessThanOrEqual(viewport.height - 24);
    });
});
