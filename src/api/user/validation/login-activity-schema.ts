import { z } from 'zod';

export const userLoginActivitySchema = z.object({
    userId: z.number(),
    name: z.string().nullable(),
    email: z.string(),
    dailyLogins: z.array(
        z.object({
            /** `YYYY-MM-DD`, bucketed by the backend in UTC. */
            date: z.string(),
            count: z.number(),
        }),
    ),
});

export const getLoginActivityResponseSchema = z.object({
    users: z.array(userLoginActivitySchema),
});

export type UserLoginActivity = z.infer<typeof userLoginActivitySchema>;
