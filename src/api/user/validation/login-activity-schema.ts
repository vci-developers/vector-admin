import { z } from 'zod';

// Only ids and per-day counts; zod strips names and emails before caching.
export const userLoginActivitySchema = z.object({
    userId: z.number(),
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
