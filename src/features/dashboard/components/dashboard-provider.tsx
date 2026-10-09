'use client';

import type { ViewAs } from '@/lib/auth-session/viewer';
import { HIDDEN_BY_DEFAULT_PROGRAM_IDS } from '@/features/dashboard/utils/default-excluded-programs';
import { createContext, type ReactNode } from 'react';

/** The Program Filter's starting selection, set by the page per viewer. */
export const DefaultExcludeContext = createContext<number[]>(
    HIDDEN_BY_DEFAULT_PROGRAM_IDS,
);

/** Which page the viewer gets; Stakeholders see places only to District. */
export const ViewContext = createContext<ViewAs>('developer');

/** Per-viewer settings the page works out on the server. */
export default function DashboardProvider({
    view,
    defaultExclude,
    children,
}: {
    view: ViewAs;
    defaultExclude: number[];
    children: ReactNode;
}) {
    return (
        <ViewContext value={view}>
            <DefaultExcludeContext value={defaultExclude}>
                {children}
            </DefaultExcludeContext>
        </ViewContext>
    );
}
