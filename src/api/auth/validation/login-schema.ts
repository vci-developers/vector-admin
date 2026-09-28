import { z } from 'zod';

export const loginRequestSchema = z.object({
    email: z.email(),
    password: z.string().min(1).max(128),
});

export const loginResponseSchema = z.object({
    tokens: z.object({
        accessToken: z.string(),
    }),
});

export type LoginRequestBody = z.infer<typeof loginRequestSchema>;
export type LoginResponseBody = z.infer<typeof loginResponseSchema>;
