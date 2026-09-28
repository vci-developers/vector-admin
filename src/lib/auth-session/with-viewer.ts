import 'server-only';

import { getUserPermissions } from '@/api/user/get-user-permissions';
import { withAuthSession } from '@/lib/auth-session/with-auth-session';
import type { NetworkError } from '@/lib/network/network-error';
import { err, type Result } from '@/lib/result/result';

export async function withViewer<T>(
    callback: () => Promise<Result<T, NetworkError>>,
): Promise<Result<T, NetworkError>> {
    return withAuthSession(async accessToken => {
        const permissions = await getUserPermissions(accessToken);
        if (!permissions.ok) return permissions;
        if (!permissions.data.permissions.devMode) {
            return err({ kind: 'forbidden', status: 403 });
        }
        return callback();
    });
}
