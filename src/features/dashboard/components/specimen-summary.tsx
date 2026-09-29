'use client';

import type { SpecimenGroup } from '@/features/dashboard/utils/build-specimen-points';
import {
    NOT_RECORDED,
    summarizeSpecimens,
    type HiddenCount,
    type HiddenReason,
} from '@/features/dashboard/utils/filter-map-points';
import { useFormatter, useTranslations } from 'next-intl';

export type SummarySession = {
    specimenCount: number;
    specimenGroups: SpecimenGroup[];
    /** Set on Sessions the map filters have narrowed. */
    hiddenBy?: HiddenCount[];
};

/** "+ N more hidden by the map filters: …", naming the filters; or nothing. */
export function HiddenNote({ sessions }: { sessions: SummarySession[] }) {
    const t = useTranslations('MapSection');
    const tFilters = useTranslations('MapFilters');
    const formatter = useFormatter();
    const { hiddenSpecimens, hiddenBy } = summarizeSpecimens(sessions);
    if (hiddenSpecimens === 0) return null;
    const reasonLabel = (reason: HiddenReason) =>
        reason.filter === 'nonMosquito'
            ? tFilters('nonMosquito')
            : reason.value === NOT_RECORDED
              ? t(`hiddenNotRecorded.${reason.filter}`)
              : reason.value;
    return (
        <p className="text-muted-foreground text-xs">
            <span className="italic">
                {t('hiddenByFilters', { count: hiddenSpecimens })}
            </span>{' '}
            {hiddenBy
                .map(
                    ({ reason, count }) =>
                        `${reasonLabel(reason)} ${formatter.number(count)}`,
                )
                .join(' · ')}
        </p>
    );
}

/**
 * Species, sex and abdomen status for the Sessions behind a clicked point,
 * cluster or device. Filtered Sessions also say how many specimens the map
 * filters hid, so a summary is never silently smaller than what was submitted.
 */
export default function SpecimenSummary({
    sessions,
}: {
    sessions: SummarySession[];
}) {
    const t = useTranslations('MapSection');
    const tFilters = useTranslations('MapFilters');
    const formatter = useFormatter();
    const summary = summarizeSpecimens(sessions);
    const label = (value: string) =>
        value === NOT_RECORDED ? tFilters('notRecorded') : value;
    const inline = (values: [string, number][]) =>
        values
            .map(
                ([value, count]) =>
                    `${label(value)} ${formatter.number(count)}`,
            )
            .join(' · ');
    const top = summary.species[0]?.[1] ?? 0;

    const hiddenNote = <HiddenNote sessions={sessions} />;

    if (summary.specimens === 0) {
        return (
            <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-xs">
                    {t('noSpecimens', { sessions: summary.sessions })}
                </p>
                {hiddenNote}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5 text-xs">
            <p className="font-medium">
                {t('summaryTotal', {
                    specimens: summary.specimens,
                    sessions: summary.sessions,
                })}
            </p>
            <ul
                aria-label={t('summarySpecies')}
                className="flex flex-col gap-0.5"
            >
                {summary.species.map(([species, count]) => (
                    <li
                        key={species}
                        className="grid grid-cols-[1fr_auto] items-center gap-x-2"
                    >
                        <span className="truncate">{label(species)}</span>
                        <span className="tabular-nums">
                            {formatter.number(count)}
                        </span>
                        <span
                            aria-hidden="true"
                            className="bg-primary/70 col-span-2 h-1 rounded-full"
                            style={{ width: `${(count / top) * 100}%` }}
                        />
                    </li>
                ))}
            </ul>
            <p className="text-muted-foreground">
                <span className="text-foreground">{t('summarySex')}:</span>{' '}
                {inline(summary.sex)}
            </p>
            <p className="text-muted-foreground">
                <span className="text-foreground">{t('summaryAbdomen')}:</span>{' '}
                {inline(summary.abdomen)}
            </p>
            {hiddenNote}
        </div>
    );
}
