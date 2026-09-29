'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import {
    MAP_FILTER_DEFAULTS,
    useMapFilters,
} from '@/features/dashboard/hooks/use-map-filters';
import {
    MAPPED_DEVICE_STATUSES,
    NOT_RECORDED,
    type MappedDeviceStatus,
    type SpecimenFacets,
} from '@/features/dashboard/utils/filter-map-points';
import { cn } from '@/utils/cn';
import { ChevronDown, Info, SlidersHorizontal } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { MAP_LAYERS, type MapLayer } from './map-constants';

type MapFiltersProps = {
    facets: SpecimenFacets;
    deviceCounts: Record<MappedDeviceStatus, number>;
    /** Called on every change, e.g. to clear the map selection. */
    onChange: () => void;
};

function FilterRow({
    label,
    count,
    checked,
    disabled,
    onToggle,
}: {
    label: ReactNode;
    count?: number;
    checked: boolean;
    disabled?: boolean;
    onToggle: () => void;
}) {
    const formatter = useFormatter();
    return (
        <label
            className={cn(
                'hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors select-none',
                !checked && 'text-muted-foreground',
                disabled && 'pointer-events-none opacity-50',
            )}
        >
            <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={onToggle}
            />
            <span className="flex-1">{label}</span>
            {count !== undefined && (
                <span className="text-muted-foreground text-xs tabular-nums">
                    {formatter.number(count)}
                </span>
            )}
        </label>
    );
}

/** "Not recorded", with a hover explaining why a value can be missing. */
function NotRecordedLabel({ hint }: { hint: string }) {
    const t = useTranslations('MapFilters');
    return (
        <span className="inline-flex items-center gap-1">
            {t('notRecorded')}
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        tabIndex={0}
                        role="img"
                        aria-label={t('notRecordedInfo')}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px]"
                        // Inside the row's label: explain, don't toggle.
                        onClick={event => event.preventDefault()}
                    >
                        <Info className="size-3.5" aria-hidden="true" />
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64">
                    {hint}
                </TooltipContent>
            </Tooltip>
        </span>
    );
}

function ValueGroup({
    title,
    counts,
    hidden,
    notRecordedHint,
    onChange,
}: {
    title: string;
    counts: Map<string, number>;
    hidden: string[];
    notRecordedHint: string;
    onChange: (hidden: string[]) => void;
}) {
    const t = useTranslations('MapFilters');
    // Most common first; "not recorded" always last.
    const values = [...counts].sort(
        ([a, countA], [b, countB]) =>
            Number(a === NOT_RECORDED) - Number(b === NOT_RECORDED) ||
            countB - countA,
    );
    if (values.length === 0) return null;
    return (
        <div role="group" aria-label={title}>
            <div className="flex items-center justify-between px-2 pt-2 pb-0.5">
                <span className="text-muted-foreground text-xs font-medium">
                    {title}
                </span>
                {hidden.length > 0 && (
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => onChange([])}
                    >
                        {t('showAll')}
                    </Button>
                )}
            </div>
            {values.map(([value, count]) => {
                const isHidden = hidden.includes(value);
                return (
                    <FilterRow
                        key={value}
                        label={
                            value === NOT_RECORDED ? (
                                <NotRecordedLabel hint={notRecordedHint} />
                            ) : (
                                value
                            )
                        }
                        count={count}
                        checked={!isHidden}
                        onToggle={() => {
                            const next = isHidden
                                ? hidden.filter(v => v !== value)
                                : [...hidden, value];
                            onChange(next);
                        }}
                    />
                );
            })}
        </div>
    );
}

function LayerSection({
    layer,
    onChange,
    children,
}: {
    layer: MapLayer;
    onChange: () => void;
    children: ReactNode;
}) {
    const t = useTranslations('MapFilters');
    const [{ layers }, setFilters] = useDashboardFilters();
    const isOn = layers.includes(layer);
    // At least one layer stays on so the map is never blank.
    const isLastOn = isOn && layers.length === 1;
    return (
        <section className="border-b pb-2 last:border-b-0">
            <FilterRow
                label={<span className="font-medium">{t(layer)}</span>}
                checked={isOn}
                disabled={isLastOn}
                onToggle={() => {
                    onChange();
                    void setFilters({
                        layers: MAP_LAYERS.filter(l =>
                            l === layer ? !isOn : layers.includes(l),
                        ),
                    });
                }}
            />
            {isOn && <div className="pl-4">{children}</div>}
        </section>
    );
}

export default function MapFilters({
    facets,
    deviceCounts,
    onChange,
}: MapFiltersProps) {
    const t = useTranslations('MapFilters');
    const [{ layers }, setLayers] = useDashboardFilters();
    const { filters, setFilters: setMapFilters } = useMapFilters();
    const set: typeof setMapFilters = values => {
        onChange();
        return setMapFilters(values);
    };

    const sameAs = (values: string[], defaults: string[]) =>
        [...values].sort().join() === [...defaults].sort().join();
    const d = MAP_FILTER_DEFAULTS;
    const changedCount = [
        layers.length < MAP_LAYERS.length,
        !sameAs(filters.hideSpecies, d.hideSpecies),
        filters.nonMosquito !== d.nonMosquito,
        !sameAs(filters.hideSex, d.hideSex),
        !sameAs(filters.hideAbdomen, d.hideAbdomen),
        filters.zeroCatch !== d.zeroCatch,
        !sameAs(filters.deviceStatus, d.deviceStatus),
    ].filter(Boolean).length;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                    <SlidersHorizontal />
                    {t('button')}
                    {changedCount > 0 && (
                        <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs tabular-nums">
                            {changedCount}
                        </span>
                    )}
                    <ChevronDown />
                </Button>
            </PopoverTrigger>
            <TooltipProvider delayDuration={200}>
                <PopoverContent
                    align="end"
                    className="flex max-h-[70vh] w-80 flex-col gap-2 overflow-auto p-2"
                >
                    <p className="text-muted-foreground px-2 text-xs">
                        {t('mapOnly')}
                    </p>
                    <LayerSection layer="specimens" onChange={onChange}>
                        <ValueGroup
                            title={t('species')}
                            counts={facets.species}
                            hidden={filters.hideSpecies}
                            notRecordedHint={t('notRecordedSpecies')}
                            onChange={hideSpecies => set({ hideSpecies })}
                        />
                        <div className="pt-1">
                            <FilterRow
                                label={t('nonMosquito')}
                                count={facets.nonMosquito}
                                checked={filters.nonMosquito}
                                onToggle={() =>
                                    set({ nonMosquito: !filters.nonMosquito })
                                }
                            />
                        </div>
                        <ValueGroup
                            title={t('sex')}
                            counts={facets.sex}
                            hidden={filters.hideSex}
                            notRecordedHint={t('notRecordedSex')}
                            onChange={hideSex => set({ hideSex })}
                        />
                        <ValueGroup
                            title={t('abdomen')}
                            counts={facets.abdomen}
                            hidden={filters.hideAbdomen}
                            notRecordedHint={t('notRecordedAbdomen')}
                            onChange={hideAbdomen => set({ hideAbdomen })}
                        />
                        <div className="pt-2">
                            <FilterRow
                                label={t('zeroCatch')}
                                count={facets.zeroCatchSessions}
                                checked={filters.zeroCatch}
                                onToggle={() =>
                                    set({ zeroCatch: !filters.zeroCatch })
                                }
                            />
                        </div>
                    </LayerSection>
                    <LayerSection layer="devices" onChange={onChange}>
                        {MAPPED_DEVICE_STATUSES.map(status => {
                            const isShown =
                                filters.deviceStatus.includes(status);
                            return (
                                <FilterRow
                                    key={status}
                                    label={t(`deviceStatus.${status}`)}
                                    count={deviceCounts[status]}
                                    checked={isShown}
                                    onToggle={() =>
                                        set({
                                            deviceStatus:
                                                MAPPED_DEVICE_STATUSES.filter(
                                                    s =>
                                                        s === status
                                                            ? !isShown
                                                            : filters.deviceStatus.includes(
                                                                  s,
                                                              ),
                                                ),
                                        })
                                    }
                                />
                            );
                        })}
                    </LayerSection>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={changedCount === 0}
                        onClick={() => {
                            onChange();
                            void setLayers({ layers: null });
                            void setMapFilters(null);
                        }}
                    >
                        {t('reset')}
                    </Button>
                </PopoverContent>
            </TooltipProvider>
        </Popover>
    );
}
