import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './panel.module.css';

export const panelClassName = styles.panel;

// Pill segmented controls, like the header's view switch.
export const SEGMENTED = 'bg-muted self-start rounded-full p-0.5';
// Panel buttons: one solid primary action, the rest soft pills.
const PILL = 'h-8 gap-1.5 rounded-full px-3.5 text-xs font-medium';
export const PANEL_PRIMARY = `${PILL} shadow-sm`;
export const PANEL_ACTION = `${PILL} border-(color:--line) bg-muted text-(color:--ink) shadow-none hover:bg-[color-mix(in_srgb,var(--primary)_14%,var(--card))] hover:text-(color:--ink) dark:border-(color:--line) dark:bg-muted dark:hover:bg-[color-mix(in_srgb,var(--primary)_18%,var(--card))]`;
export const PANEL_QUIET = `${PILL} text-muted-foreground hover:text-(color:--ink)`;

export const SEGMENT =
    'text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-(color:--ink) hover:bg-transparent h-7 rounded-full px-3 text-xs data-[state=on]:shadow-sm';

/** A panel's header: icon chip, title and description, actions on the right. */
export default function PanelHeader({
    id,
    icon: Icon,
    title,
    description,
    actions,
}: {
    id?: string;
    icon: LucideIcon;
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <div className={styles.header}>
            <div className={styles.heading}>
                <span className={styles.chip}>
                    <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2 id={id} className={styles.title}>
                        {title}
                    </h2>
                    {description && (
                        <p className={styles.description}>{description}</p>
                    )}
                </div>
            </div>
            {actions && <div className={styles.actions}>{actions}</div>}
        </div>
    );
}
