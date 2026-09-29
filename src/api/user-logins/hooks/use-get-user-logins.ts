import {
    getUserLoginsResponseSchema,
    type UserLogins,
} from '@/api/user-logins/validation/user-logins-schema';
import type { NetworkError } from '@/lib/network/network-error';
import { err, type Result } from '@/lib/result/result';
import { useQuery } from '@tanstack/react-query';

export type UserLoginsParams = { exclude: number[]; from: string; to: string };

export const userLoginsKeys = {
    root: ['user-logins'] as const,
    logins: (params: UserLoginsParams) => ['user-logins', params] as const,
};

export function userLoginsSearch(params: UserLoginsParams): string {
    return new URLSearchParams({
        exclude: params.exclude.join(','),
        from: params.from,
        to: params.to,
    }).toString();
}

async function fetchUserLogins(
    params: UserLoginsParams,
): Promise<Result<UserLogins, NetworkError>> {
    const response = await fetch(
        `/api/user-logins?${userLoginsSearch(params)}`,
        {
            credentials: 'include',
        },
    ).catch(() => null);
    if (!response) return err({ kind: 'network' });

    const body = getUserLoginsResponseSchema.safeParse(
        await response.json().catch(() => null),
    );
    return body.success
        ? body.data
        : err({ kind: 'client', status: response.status });
}

export function useGetUserLogins(params: UserLoginsParams) {
    return useQuery({
        queryKey: userLoginsKeys.logins(params),
        queryFn: () => fetchUserLogins(params),
    });
}
