import { z } from 'zod';

export const getUserProfileResponseSchema = z.object({
    user: z.object({ email: z.string() }),
});

export type GetUserProfileResponseBody = z.infer<
    typeof getUserProfileResponseSchema
>;
