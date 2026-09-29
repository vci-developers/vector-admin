import { resultSchema } from '@/lib/result/result-schema';
import { z } from 'zod';

const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const getUserLoginsQuerySchema = z
    .object({
        exclude: z
            .string()
            .regex(/^(\d+(,\d+)*)?$/)
            .transform(value =>
                value === '' ? [] : value.split(',').map(Number),
            )
            .default([]),
        from: monthKeySchema,
        to: monthKeySchema,
    })
    .refine(({ from, to }) => from <= to, 'from must not be after to');

export type GetUserLoginsQuery = z.infer<typeof getUserLoginsQuerySchema>;

export const userLoginRowSchema = z.object({
    userId: z.number(),
    programId: z.number(),
    name: z.string().nullable(),
    email: z.string(),
    logins: z.number(),
    lastLogin: z.string(),
    dailyLogins: z.array(z.object({ date: z.string(), count: z.number() })),
});

export const userLoginsSchema = z.object({
    users: z.array(userLoginRowSchema),
    failedProgramIds: z.array(z.number()),
});

export const getUserLoginsResponseSchema = resultSchema(userLoginsSchema);

export type UserLogins = z.infer<typeof userLoginsSchema>;
