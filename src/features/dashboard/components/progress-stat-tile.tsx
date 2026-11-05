import type { LucideIcon } from 'lucide-react';
import { useFormatter } from 'next-intl';
import styles from './progress-view.module.css';

/** A single figure above the headline tiles. */
export default function ProgressStatTile({
    title,
    icon: Icon,
    value,
    detail,
}: {
    title: string;
    icon: LucideIcon;
    value: number;
    detail: string;
}) {
    const formatter = useFormatter();
    return (
        <article className={styles.headline}>
            <div className="flex items-center justify-between gap-4">
                <h2 className={styles.headlineLabel}>{title}</h2>
                <span className={styles.headlineIcon}>
                    <Icon className="size-[18px]" aria-hidden="true" />
                </span>
            </div>
            <p className={styles.headlineSummary}>
                <span className={styles.headlineValue}>
                    {formatter.number(value)}
                </span>
                <span className={styles.headlineUnit}>{detail}</span>
            </p>
        </article>
    );
}
