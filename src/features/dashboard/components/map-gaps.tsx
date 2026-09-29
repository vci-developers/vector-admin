'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { Button } from '@/components/ui/button';
import { useMapFilters } from '@/features/dashboard/hooks/use-map-filters';
import { MAPPED_DEVICE_STATUSES } from '@/features/dashboard/utils/filter-map-points';
import type {
    DeviceGap,
    ProgramMapGap,
    SpecimenGap,
} from '@/features/dashboard/utils/find-map-gaps';
import { programTitle } from '@/features/dashboard/utils/program-title';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

type MapGapsProps = {
    gaps: ProgramMapGap[];
    programs: Map<number, Program>;
    periodLabel: string;
    /** Called before filters change, e.g. to clear the map selection. */
    onChange: () => void;
};

/** Names every selected Program with nothing on the map, and why. */
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
        <div
            role="status"
            className="bg-muted/40 flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-start sm:justify-between"
        >
            <div className="flex gap-2">
                <Info
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                />
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
            </div>
            {anyFiltered && (
                <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                        onChange();
                        void setFilters({
                            hideSpecies: [],
                            hideSex: [],
                            hideAbdomen: [],
                            nonMosquito: true,
                            zeroCatch: true,
                            deviceStatus: [...MAPPED_DEVICE_STATUSES],
                        });
                    }}
                >
                    {t('showEverything')}
                </Button>
            )}
        </div>
    );
}
