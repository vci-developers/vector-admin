import { z } from 'zod';

// /users/profile omits isDeveloper; /users/permissions exposes it as devMode
export const getUserPermissionsResponseSchema = z.object({
    permissions: z.object({
        devMode: z.boolean(),
    }),
});

export type GetUserPermissionsResponseBody = z.infer<
    typeof getUserPermissionsResponseSchema
>;
