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
    tileFiguresByProgram,
    type TileFigures,
} from '@/features/dashboard/utils/tile-figures-by-program';
import { MapPin, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

type CountedSession = Parameters<typeof tileFiguresByProgram>[0][number];

/**
 * A Stakeholder's figures beside the map, framed as the tiles are: each
 * Program's users and sentinel sites in the period's last month, on every
 * Session the Session filter kept. Map-wide, users sit beside the expected
 * figure; for a selection, only the Areas selected count.
 */
export default function PanelTileFigures({
    sessions,
    month,
    selectedPlaces,
    userCoverage,
    programs,
}: {
    sessions: CountedSession[];
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
    const figures = [...tileFiguresByProgram(sessions, month, areas)];
    const monthLabel = formatter.dateTime(monthStartDate(month), {
        month: 'short',
        timeZone: 'UTC',
    });
    // Expected figures are per Program, so only the whole map has one.
    const expectedOf = (programId: number) =>
        areas
            ? undefined
            : userCoverage.find(c => c.programId === programId)
                  ?.instantaneousUserCoverage?.denominator;
    const users = (programId: number, { users: count }: TileFigures) => {
        const expected = expectedOf(programId);
        return expected === undefined
            ? t('usersActive', { count })
            : t('usersOfExpected', { count, expected });
    };
    const sites = (_: number, f: TileFigures) =>
        [
            t('locationSentinelSites', { count: f.sentinelSites }),
            f.houses > 0 && t('locationHouses', { count: f.houses }),
        ]
            .filter(Boolean)
            .join(' · ');
    // One Program reads plainly; several are named, never pooled.
    const line = (phrase: (id: number, f: TileFigures) => string) =>
        figures.length === 1
            ? phrase(...figures[0])
            : figures
                  .map(
                      ([id, f]) =>
                          `${programs.get(id)?.country || id}: ${phrase(id, f)}`,
                  )
                  .join(' · ');
    const row = (icon: ReactNode, text: string) => (
        <p className="flex items-start gap-1 text-xs">
            {icon}
            <span>
                {text}
                <span className="text-muted-foreground">
                    {' · '}
                    {monthLabel}
                </span>
            </span>
        </p>
    );
    const iconClass = 'text-muted-foreground mt-0.5 size-3 shrink-0';

    if (figures.length === 0)
        return row(
            <Users className={iconClass} aria-hidden="true" />,
            t('usersActive', { count: 0 }),
        );
    return (
        <>
            {row(
                <Users className={iconClass} aria-hidden="true" />,
                line(users),
            )}
            {row(
                <MapPin className={iconClass} aria-hidden="true" />,
                line(sites),
            )}
        </>
    );
}
