'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { Button } from '@/components/ui/button';
import { useMapFilters } from '@/features/dashboard/hooks/use-map-filters';
import type {
    DeviceGap,
    ProgramMapGap,
    SpecimenGap,
} from '@/features/dashboard/utils/find-map-gaps';
import { programTitle } from '@/features/dashboard/utils/program-title';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

type MapGapsProps = {
    gaps: ProgramMapGap[];
    programs: Map<number, Program>;
    periodLabel: string;
    /** Called before filters change, e.g. to clear the map selection. */
    onChange: () => void;
};

/**
 * A "!" on the map when a selected Program has nothing on it; opens to name
 * each one and why.
 */
export default function MapGaps({
    gaps,
    programs,
    periodLabel,
    onChange,
}: MapGapsProps) {
    const t = useTranslations('MapSection');
    const { setFilters } = useMapFilters();
    if (gaps.length === 0) return null;

    const specimenReason = (gap: SpecimenGap) =>
        gap.kind === 'noSessions'
            ? t('gapNoSessions', { period: periodLabel })
            : gap.kind === 'filtered'
              ? t('gapFiltered', gap)
              : t('gapNoLocation', gap);
    const deviceReason = (gap: DeviceGap) =>
        gap.kind === 'filtered'
            ? t('gapDevicesFiltered', gap)
            : t('gapDevicesNoLocation', gap);
    const anyFiltered = gaps.some(
        gap =>
            gap.specimens?.kind === 'filtered' ||
            gap.devices?.kind === 'filtered',
    );

    return (
        <Popover>
            <PopoverTrigger asChild>
                {/* Sits on the map beside its filters; solid like them. */}
                <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={t('gapsOpen', { count: gaps.length })}
                    title={t('gapsTitle')}
                    className="dark:bg-card/95 dark:hover:bg-accent text-amber-600 shadow-sm dark:text-amber-400"
                >
                    <CircleAlert />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="flex w-80 flex-col gap-2 text-sm"
            >
                <div>
                    <p className="font-medium">{t('gapsTitle')}</p>
                    <ul className="text-muted-foreground">
                        {gaps.map(gap => {
                            const program = programs.get(gap.programId);
                            const reasons = [
                                gap.specimens && specimenReason(gap.specimens),
                                gap.devices && deviceReason(gap.devices),
                            ].filter(Boolean);
                            return (
                                <li key={gap.programId}>
                                    <span className="text-foreground">
                                        {program
                                            ? programTitle(program)
                                            : gap.programId}
                                    </span>
                                    {': '}
                                    {reasons.join(' · ')}
                                </li>
                            );
                        })}
                    </ul>
                </div>
                {anyFiltered && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() => {
                            onChange();
                            void setFilters({
                                hideSpecies: [],
                                hideSex: [],
                                hideAbdomen: [],
                                nonMosquito: true,
                                zeroCatch: true,
                            });
                        }}
                    >
                        {t('showEverything')}
                    </Button>
                )}
            </PopoverContent>
        </Popover>
    );
}
