import 'server-only';

import { getUserPermissions } from '@/api/user/get-user-permissions';
import { getUserProfile } from '@/api/user/get-user-profile';
import { withAuthSession } from '@/lib/auth-session/with-auth-session';
import type { NetworkError } from '@/lib/network/network-error';
import { err, ok, type Result } from '@/lib/result/result';
import { cookies } from 'next/headers';
import {
    applyViewAs,
    parseStakeholderList,
    resolveViewer,
    type Viewer,
    type ViewAs,
} from './viewer';

/** Set by the header switch; read only for Developers. */
export const VIEW_AS_COOKIE = 'viewAs';

const forbidden = () => err({ kind: 'forbidden' as const, status: 403 });

/**
 * Runs the callback for a Viewer: a Developer (devMode) or a Stakeholder on
 * `STAKEHOLDER_EMAILS`. Anyone else is forbidden.
 */
export async function withViewer<T>(
    callback: (viewer: Viewer) => Promise<Result<T, NetworkError>>,
): Promise<Result<T, NetworkError>> {
    return withAuthSession(async accessToken => {
        const permissions = await getUserPermissions(accessToken);
        if (!permissions.ok) return permissions;
        const devMode = permissions.data.permissions.devMode;

        // Only non-developers need the email, so developers skip the call.
        let email: string | null = null;
        if (!devMode) {
            const profile = await getUserProfile(accessToken);
            if (!profile.ok) return profile;
            email = profile.data.user.email;
        }

        const list = parseStakeholderList(process.env.STAKEHOLDER_EMAILS);
        if (!list.ok) console.error(`STAKEHOLDER_EMAILS: ${list.error}`);
        const viewer = resolveViewer(devMode, email, list);
        if (!viewer) return forbidden();
        const viewAs = (await cookies()).get(VIEW_AS_COOKIE)?.value;
        return callback(applyViewAs(viewer, viewAs));
    });
}

/** For data only Developers see: the Session panel, users, refresh. */
export async function withDeveloper<T>(
    callback: () => Promise<Result<T, NetworkError>>,
): Promise<Result<T, NetworkError>> {
    return withViewer(viewer =>
        viewer.role === 'developer' ? callback() : Promise.resolve(forbidden()),
    );
}

/**
 * For the header switch: null unless the user is a Developer, else the view
 * they chose. Their own role, not the previewed one, so they can switch back.
 */
export async function getViewAs(): Promise<ViewAs | null> {
    const result = await withAuthSession(async accessToken => {
        const permissions = await getUserPermissions(accessToken);
        if (!permissions.ok) return permissions;
        const viewAs = (await cookies()).get(VIEW_AS_COOKIE)?.value;
        return ok(
            permissions.data.permissions.devMode
                ? viewAs === 'stakeholder'
                    ? ('stakeholder' as const)
                    : ('developer' as const)
                : null,
        );
    });
    return result.ok ? result.data : null;
}
