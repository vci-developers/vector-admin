import { z } from 'zod';

export const programSchema = z.object({
    programId: z.number(),
    name: z.string(),
    country: z.string(),
});

export const getProgramsPageSchema = z
    .object({ programs: z.array(programSchema), total: z.number() })
    .transform(page => ({ items: page.programs, total: page.total }));

export type Program = z.infer<typeof programSchema>;
