import 'server-only';

import {
    getUserPermissionsResponseSchema,
    type GetUserPermissionsResponseBody,
} from '@/api/user/validation/get-user-permissions-schema';
import type { NetworkError } from '@/lib/network/network-error';
import { safeApiCall } from '@/lib/network/safe-api-call';
import type { Result } from '@/lib/result/result';

export async function getUserPermissions(
    accessToken: string,
): Promise<Result<GetUserPermissionsResponseBody, NetworkError>> {
    return safeApiCall<GetUserPermissionsResponseBody>(
        '/users/permissions',
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
        getUserPermissionsResponseSchema,
    );
}
