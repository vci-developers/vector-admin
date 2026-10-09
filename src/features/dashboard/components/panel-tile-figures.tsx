'use client';

import type { Program } from '@/api/program/validation/program-schema';
import type { UserCoverageDto } from '@/api/dashboard/validation/dashboard-schema';
import { areaKey } from '@/features/dashboard/utils/build-area-marks';
import {
    monthStartDate,
    type MonthKey,
} from '@/features/dashboard/utils/month-key';
import type { LocationLevel } from '@/features/dashboard/utils/site-location-path';
import {
    panelFigureRows,
    type PanelFigureRow,
} from '@/features/dashboard/utils/tile-figures-by-program';
import { MapPin, Smartphone, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

type CountedSession = Parameters<typeof panelFigureRows>[0][number];

/**
 * A Stakeholder's figures beside the map, framed as the tiles are: users and
 * sentinel sites in the period's last month, on every Session the Session
 * filter kept, each beside its expected users. The whole map: one line per
 * Program. A selection: one line per District (or top place), even when the
 * map merged neighbouring marks, against its share of the plan (Uganda: 6).
 */
export default function PanelTileFigures({
    sessions,
    deviceCounts,
    projectedDevices,
    plannedAreas,
    areaDevicePlans,
    month,
    selectedPlaces,
    userCoverage,
    programs,
}: {
    sessions: CountedSession[];
    /** Active devices per Area over the period, placed on the map or not. */
    deviceCounts: Parameters<typeof panelFigureRows>[1];
    projectedDevices: { programId: number; projected: number }[];
    plannedAreas: {
        programId: number;
        areas: number;
        sentinelSites: number | null;
    }[];
    /** Uganda's planned devices per District, by its rollout rule. */
    areaDevicePlans: { programId: number; area: string; planned: number }[];
    month: MonthKey;
    /** What is selected, for its Areas; null for the whole map. */
    selectedPlaces: { programId: number; location: LocationLevel[] }[] | null;
    userCoverage: UserCoverageDto[];
    programs: Map<number, Program>;
}) {
    const t = useTranslations('MapSection');
    const formatter = useFormatter();
    const areas = selectedPlaces
        ? new Set(
              selectedPlaces.map(p =>
                  areaKey(p.programId, p.location[0]?.name ?? null),
              ),
          )
        : null;
    const rows = panelFigureRows(sessions, deviceCounts, month, areas, {
        expectedUsers: programId =>
            userCoverage.find(c => c.programId === programId)
                ?.instantaneousUserCoverage?.denominator,
        devices: programId =>
            projectedDevices.find(row => row.programId === programId)
                ?.projected,
        areas: programId =>
            plannedAreas.find(row => row.programId === programId)?.areas ?? 0,
        sentinelSites: programId =>
            plannedAreas.find(row => row.programId === programId)
                ?.sentinelSites ?? null,
        areaDevices: areaDevicePlans,
    });
    const monthLabel = formatter.dateTime(monthStartDate(month), {
        month: 'short',
        timeZone: 'UTC',
    });
    const several = new Set(rows.map(row => row.programId)).size > 1;
    const labelOf = (row: PanelFigureRow) => {
        const country = programs.get(row.programId)?.country || row.programId;
        if (row.area === null) return String(country);
        return several ? `${country} · ${row.area}` : row.area;
    };
    const users = ({ figures, expected }: PanelFigureRow) =>
        expected === null
            ? t('usersActive', { count: figures.users })
            : t('usersOfExpected', { count: figures.users, expected });
    const deviceLine = ({ devices: count, plannedDevices }: PanelFigureRow) =>
        plannedDevices === null
            ? t('devicesActive', { count })
            : t('devicesOfPlanned', { count, planned: plannedDevices });
    const sites = ({ figures, plannedSentinelSites }: PanelFigureRow) =>
        [
            plannedSentinelSites === null
                ? t('sentinelSitesSubmitted', { count: figures.sentinelSites })
                : t('sentinelSitesOfPlanned', {
                      count: figures.sentinelSites,
                      planned: plannedSentinelSites,
                  }),
            figures.houses > 0 && t('housesSampled', { count: figures.houses }),
        ]
            .filter(Boolean)
            .join(' · ');
    const monthTag = (
        <span className="text-muted-foreground">
            {' · '}
            {monthLabel}
        </span>
    );
    // One line reads plainly; several get a line each, named in a column so
    // the figures line up, never pooled.
    const row = (icon: ReactNode, phrase: (row: PanelFigureRow) => string) => (
        <div className="flex items-start gap-1 text-xs">
            {icon}
            {rows.length === 1 ? (
                <p>
                    {phrase(rows[0])}
                    {monthTag}
                </p>
            ) : (
                <ul className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
                    {rows.map(line => (
                        <li key={line.key} className="contents">
                            <span className="text-muted-foreground">
                                {labelOf(line)}
                            </span>
                            <span>{phrase(line)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
    const iconClass = 'text-muted-foreground mt-0.5 size-3 shrink-0';

    if (rows.length === 0)
        return (
            <p className="flex items-start gap-1 text-xs">
                <Users className={iconClass} aria-hidden="true" />
                <span>
                    {t('usersActive', { count: 0 })}
                    {monthTag}
                </span>
            </p>
        );
    return (
        <>
            {/* Several lines: the month once, above them. */}
            {rows.length > 1 && (
                <p className="text-muted-foreground text-xs">
                    {t('figuresMonth', { month: monthLabel })}
                </p>
            )}
            {row(<Users className={iconClass} aria-hidden="true" />, users)}
            {row(
                <Smartphone className={iconClass} aria-hidden="true" />,
                deviceLine,
            )}
            {row(<MapPin className={iconClass} aria-hidden="true" />, sites)}
        </>
    );
}
