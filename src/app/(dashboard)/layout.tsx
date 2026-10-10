import ViewerGate from '@/features/auth/components/viewer-gate';
import DashboardLoading from '@/features/dashboard/components/dashboard-loading';
import { Suspense } from 'react';

export default function DashboardLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <Suspense fallback={<DashboardLoading />}>
            <ViewerGate>{children}</ViewerGate>
        </Suspense>
    );
}
