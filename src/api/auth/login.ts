import 'server-only';

import {
    loginRequestSchema,
    loginResponseSchema,
    type LoginResponseBody,
} from '@/api/auth/validation/login-schema';
import type { NetworkError } from '@/lib/network/network-error';
import { safeApiCall } from '@/lib/network/safe-api-call';
import { err, type Result } from '@/lib/result/result';

export async function login(
    requestBody: unknown,
): Promise<Result<LoginResponseBody, NetworkError>> {
    const parsedRequestBody = loginRequestSchema.safeParse(requestBody);
    if (!parsedRequestBody.success) {
        return err({ kind: 'client', status: 400 });
    }

    return safeApiCall<LoginResponseBody>(
        '/auth/login',
        {
            method: 'POST',
            body: JSON.stringify(parsedRequestBody.data),
        },
        loginResponseSchema,
    );
}
