'use client';

import {
    monthStartDate,
    type MonthKey,
} from '@/features/dashboard/utils/month-key';
import { useFormatter, useTranslations } from 'next-intl';
import { InfoTip } from './metric-info';

/** An "i" for a period whose last month hasn't ended; says so on hover. */
export default function InProgressInfo({ to }: { to: MonthKey }) {
    const t = useTranslations('Summary');
    const formatter = useFormatter();
    return (
        <InfoTip label={t('inProgress')}>
            <p className="font-medium">{t('inProgress')}</p>
            <p>
                {t('inProgressHint', {
                    month: formatter.dateTime(monthStartDate(to), {
                        month: 'long',
                        timeZone: 'UTC',
                    }),
                })}
            </p>
        </InfoTip>
    );
}
