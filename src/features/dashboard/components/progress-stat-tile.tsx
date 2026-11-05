import { cn } from '@/utils/cn';
import type { LucideIcon } from 'lucide-react';
import { useFormatter } from 'next-intl';
import type { ReactNode } from 'react';
import HeadlineExpandButton from './headline-expand-button';
import styles from './progress-view.module.css';

/** A single figure above the headline tiles, opening out to `children`. */
export default function ProgressStatTile({
    title,
    icon: Icon,
    value,
    detail,
    expanded,
    onToggle,
    children,
}: {
    title: string;
    icon: LucideIcon;
    value: number;
    detail: string;
    expanded: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    const formatter = useFormatter();
    return (
        <article
            className={cn(styles.headline, styles.headlineToggle, 'group')}
            onClick={onToggle}
        >
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
            {expanded && children}
            <HeadlineExpandButton title={title} expanded={expanded} />
        </article>
    );
}
