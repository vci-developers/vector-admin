'use client';

import type { ViewAs } from '@/lib/auth-session/viewer';
import type { Program } from '@/api/program/validation/program-schema';
import { HIDDEN_BY_DEFAULT_PROGRAM_IDS } from '@/features/dashboard/utils/default-excluded-programs';
import { createContext, type ReactNode } from 'react';

/** The Program Filter's starting selection, set by the page per viewer. */
export const DefaultExcludeContext = createContext<number[]>(
    HIDDEN_BY_DEFAULT_PROGRAM_IDS,
);

/** Which page the viewer gets; Stakeholders see places only to District. */
export const ViewContext = createContext<ViewAs>('developer');

/** Small, authorized program list is ready before the reporting snapshot. */
export const AvailableProgramsContext = createContext<Program[]>([]);

/** Per-viewer settings the page works out on the server. */
export default function DashboardProvider({
    view,
    defaultExclude,
    programs = [],
    children,
}: {
    view: ViewAs;
    defaultExclude: number[];
    programs?: Program[];
    children: ReactNode;
}) {
    return (
        <ViewContext value={view}>
            <DefaultExcludeContext value={defaultExclude}>
                <AvailableProgramsContext value={programs}>
                    {children}
                </AvailableProgramsContext>
            </DefaultExcludeContext>
        </ViewContext>
    );
}
