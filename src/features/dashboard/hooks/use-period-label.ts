import { monthStartDate } from '@/features/dashboard/utils/month-key';
import { useFormatter, useTranslations } from 'next-intl';

/** "November 2025" for one month, "Oct 2025 – Sep 2026" for several. */
export function usePeriodLabel() {
    const formatter = useFormatter();
    const t = useTranslations('Period');
    return (from: string, to: string) => {
        if (from === to) {
            return formatter.dateTime(monthStartDate(from), {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
            });
        }
        const short = (month: string) =>
            formatter.dateTime(monthStartDate(month), {
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
            });
        return t('range', { from: short(from), to: short(to) });
    };
}

export type DisplayPeriod = {
    from: string;
    to: string;
    label: string;
    /** Includes the current month, so its counts are still rising. */
    inProgress: boolean;
};
