import { describe, expect, it } from 'vitest';
import { progressSpecimenSchema } from './progress-snapshot-schema';

describe('progressSpecimenSchema', () => {
    it('retains every image id while discarding unnecessary image metadata', () => {
        expect(
            progressSpecimenSchema.parse({
                id: 7,
                sessionId: 9,
                specimenId: 'display-only',
                images: [
                    {
                        id: 12,
                        url: 'https://images.test/one.jpg',
                        species: 'Anopheles',
                        metadata: { notes: 'not needed' },
                    },
                    { id: 13, capturedAt: 100 },
                ],
            }),
        ).toEqual({
            id: 7,
            sessionId: 9,
            images: [{ id: 12 }, { id: 13 }],
        });
    });

    it('accepts an explicitly empty image list without fabricating scans', () => {
        expect(
            progressSpecimenSchema.parse({ id: 7, sessionId: 9, images: [] }),
        ).toEqual({ id: 7, sessionId: 9, images: [] });
    });

    it.each([undefined, null])(
        'rejects an absent image list (%s) instead of defaulting to zero scans',
        images => {
            expect(
                progressSpecimenSchema.safeParse({
                    id: 7,
                    sessionId: 9,
                    images,
                }).success,
            ).toBe(false);
        },
    );

    it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '12'])(
        'rejects an invalid image id (%s)',
        id => {
            expect(
                progressSpecimenSchema.safeParse({
                    id: 7,
                    sessionId: 9,
                    images: [{ id }],
                }).success,
            ).toBe(false);
        },
    );
});
