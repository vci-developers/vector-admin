import { NETWORK_ERROR_KINDS } from '@/lib/network/network-error';
import { z } from 'zod';

export const networkErrorSchema = z.object({
    kind: z.enum(NETWORK_ERROR_KINDS),
    status: z.number().optional(),
    message: z.string().optional(),
});

export function resultSchema<T extends z.ZodType>(dataSchema: T) {
    return z.discriminatedUnion('ok', [
        z.object({ ok: z.literal(true), data: dataSchema }),
        z.object({ ok: z.literal(false), error: networkErrorSchema }),
    ]);
}
