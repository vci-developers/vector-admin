import { z } from 'zod';

export const deviceSchema = z.object({
    deviceId: z.number(),
    model: z.string(),
    ssaid: z.string().nullable(),
    programId: z.number(),
    registeredAt: z.number(),
    submittedAt: z.number().nullable(),
});

export const getDevicesPageSchema = z
    .object({ devices: z.array(deviceSchema), total: z.number() })
    .transform(page => ({ items: page.devices, total: page.total }));

export type Device = z.infer<typeof deviceSchema>;
