import { z } from 'zod';

export const collectionCycleSchema = z.object({
    id: z.number(),
    cycleNumber: z.number(),
    startDate: z.number(),
    endDate: z.number(),
    timezone: z.string().nullable(),
});

export const getCollectionCyclesResponseSchema = z.object({
    collectionCycles: z.array(collectionCycleSchema),
});

export type CollectionCycle = z.infer<typeof collectionCycleSchema>;
