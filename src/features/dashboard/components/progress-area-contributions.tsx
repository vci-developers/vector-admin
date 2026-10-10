import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import { topProgressAreas } from '@/features/dashboard/utils/top-progress-areas';
import { cn } from '@/utils/cn';
import { ArrowUpRight, ChartNoAxesColumnIncreasing } from 'lucide-react';
import { useFormatter } from 'next-intl';
import styles from './progress-view.module.css';

/** Geographic scan distribution across the selection, independent of chart focus. */
export default function ProgressAreaContributions({
    districts,
    selectedKey,
    onSelect,
    disabled = false,
}: {
    districts: readonly ProgressDistrict[];
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
    disabled?: boolean;
}) {
    const formatter = useFormatter();
    const areas = topProgressAreas(districts);
    const maximum = areas[0]?.uniqueScans ?? 1;
    const showCountry = new Set(districts.map(area => area.country)).size > 1;

    return (
        <section
            aria-labelledby="progress-contributions-heading"
            className={styles.areaContributions}
        >
            <div className="flex shrink-0 items-start gap-3">
                <span className={styles.contributionsIcon}>
                    <ChartNoAxesColumnIncreasing
                        className="size-4"
                        aria-hidden="true"
                    />
                </span>
                <div>
                    <h3
                        id="progress-contributions-heading"
                        className="text-sm font-semibold"
                    >
                        Where scans come from
                    </h3>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                        Top reporting areas across the selected programs.
                    </p>
                </div>
            </div>
            {areas.length > 0 ? (
                <ol className={styles.contributionList}>
                    {areas.map(area => (
                        <li key={area.key}>
                            <button
                                type="button"
                                disabled={disabled}
                                className={cn(
                                    styles.areaContribution,
                                    selectedKey === area.key &&
                                        styles.areaContributionSelected,
                                )}
                                onClick={() =>
                                    onSelect(
                                        selectedKey === area.key
                                            ? null
                                            : area.key,
                                    )
                                }
                                aria-pressed={selectedKey === area.key}
                                aria-label={`Explore ${area.name}, ${area.country}: ${formatter.number(area.uniqueScans)} scans`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className={styles.contributionArea}>
                                            {area.key.endsWith(':unknown')
                                                ? 'Area not recorded'
                                                : area.name}
                                            <ArrowUpRight
                                                className="size-3 shrink-0"
                                                aria-hidden="true"
                                            />
                                        </p>
                                        {showCountry && (
                                            <p className="text-muted-foreground mt-1 text-[11px]">
                                                {area.country}
                                            </p>
                                        )}
                                    </div>
                                    <span className={styles.contributionCount}>
                                        {formatter.number(area.uniqueScans)}
                                        <span className="text-muted-foreground ml-1 font-normal">
                                            scans
                                        </span>
                                    </span>
                                </div>
                                <span
                                    className={styles.contributionTrack}
                                    aria-hidden="true"
                                >
                                    <span
                                        style={{
                                            width: `${(area.uniqueScans / maximum) * 100}%`,
                                        }}
                                    />
                                </span>
                            </button>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
                    No scans to display for this selection.
                </p>
            )}
        </section>
    );
}
