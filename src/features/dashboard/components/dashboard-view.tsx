'use client';

import type { ViewAs } from '@/lib/auth-session/viewer';
import dynamic from 'next/dynamic';
import ProgressView from './progress-view';

const InternalDashboardView = dynamic(
    () => import('./internal-dashboard-view'),
);

export default function DashboardView({ view }: { view: ViewAs }) {
    return view === 'stakeholder' ? (
        <ProgressView />
    ) : (
        <InternalDashboardView view={view} />
    );
}
