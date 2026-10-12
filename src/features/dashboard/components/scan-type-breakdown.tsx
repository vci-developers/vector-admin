import type { ProgressTypeScans } from '@/api/progress/validation/progress-schema';
import {
    PROGRESS_SESSION_TYPE_LABELS,
    scanTypeBreakdown,
} from '@/features/dashboard/utils/progress-session-types';
import { useFormatter } from 'next-intl';

/** One line per session type; nothing when one type holds every scan. */
export default function ScanTypeBreakdown({
    scansByType,
    className,
}: {
    scansByType: ProgressTypeScans[];
    className?: string;
}) {
    const formatter = useFormatter();
    const rows = scanTypeBreakdown(scansByType);
    if (rows.length === 0) return null;
    return (
        <ul aria-label="Scans by session type" className={className}>
            {rows.map(row => (
                <li
                    key={row.type}
                    className="flex justify-between gap-4 tabular-nums"
                >
                    <span>{PROGRESS_SESSION_TYPE_LABELS[row.type]}</span>
                    <span>{formatter.number(row.scans)}</span>
                </li>
            ))}
        </ul>
    );
}
