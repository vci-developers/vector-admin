import type { Program } from '@/api/program/validation/program-schema';
import type { ProgressProgramDevices } from '@/api/progress/validation/progress-schema';
import {
    deviceFigures,
    devicesInSelection,
    namedAreas,
    type DeviceSelection,
} from '@/features/dashboard/utils/build-progress-devices';
import { groupRowsByCountry } from '@/features/dashboard/utils/group-rows-by-country';
import { Smartphone } from 'lucide-react';
import { useFormatter } from 'next-intl';
import BreakdownList from './breakdown-list';
import ProgressStatTile from './progress-stat-tile';
import styles from './progress-view.module.css';

/** Active devices against the plan, opening out to the places behind them. */
export default function ProgressDevicesTile({
    devices,
    selected,
    programs,
    expanded,
    onToggle,
}: {
    devices: readonly ProgressProgramDevices[];
    selected: DeviceSelection | null;
    programs: readonly Program[];
    expanded: boolean;
    onToggle: () => void;
}) {
    const formatter = useFormatter();
    const programById = new Map(
        programs.map(program => [program.programId, program]),
    );
    const shown = devicesInSelection(devices, selected);
    const { active, planned } = deviceFigures(shown);

    const figure = (rows: readonly ProgressProgramDevices[]) => {
        const totals = deviceFigures(rows);
        return (
            <p className={styles.deviceFigure}>
                <span className={styles.coverageCount}>
                    {formatter.number(totals.active)}
                </span>
                {totals.planned !== null && (
                    <span className={styles.deviceFigurePlan}>
                        of {formatter.number(totals.planned)}
                    </span>
                )}
            </p>
        );
    };
    const line = (
        name: string | undefined,
        count: number,
        plan?: number | null,
    ) => (
        <>
            <p className={styles.coverageProgram}>
                <span className={styles.programName}>{name}</span>
            </p>
            <p className={styles.deviceFigure}>
                <span className={styles.coverageCount}>
                    {formatter.number(count)}
                </span>
                {plan != null && (
                    <span className={styles.deviceFigurePlan}>
                        of {formatter.number(plan)}
                    </span>
                )}
            </p>
        </>
    );
    const areaLines = (row: ProgressProgramDevices) =>
        namedAreas(row).map(area => (
            <li className={styles.coverageRow} key={area.name}>
                {line(area.name, area.active, area.planned)}
            </li>
        ));

    return (
        <ProgressStatTile
            title="Devices"
            icon={Smartphone}
            value={active}
            detail={
                planned === null
                    ? 'active devices'
                    : `active, of ${formatter.number(planned)} planned`
            }
            expanded={expanded}
            onToggle={onToggle}
        >
            {shown.length > 0 && (
                <BreakdownList label="Devices by country">
                    {groupRowsByCountry(shown, programById).map(
                        ({ country, rows }) => {
                            const single = rows.length === 1 ? rows[0] : null;
                            const lines = single
                                ? areaLines(single)
                                : rows.flatMap(row => [
                                      <li
                                          className={styles.coverageRow}
                                          key={`program:${row.programId}`}
                                      >
                                          {line(
                                              programById.get(row.programId)
                                                  ?.name,
                                              row.active,
                                              row.planned,
                                          )}
                                      </li>,
                                      ...(namedAreas(row).length > 0
                                          ? [
                                                <li
                                                    key={`areas:${row.programId}`}
                                                >
                                                    <ul
                                                        className={
                                                            styles.countryPrograms
                                                        }
                                                    >
                                                        {areaLines(row)}
                                                    </ul>
                                                </li>,
                                            ]
                                          : []),
                                  ]);
                            return (
                                <li key={country ?? rows[0].programId}>
                                    <div className={styles.coverageRow}>
                                        <div className="min-w-0">
                                            <p
                                                className={
                                                    styles.coverageCountry
                                                }
                                            >
                                                {country ?? 'Reporting program'}
                                            </p>
                                            <p
                                                className={
                                                    styles.coverageProgram
                                                }
                                            >
                                                <span
                                                    className={
                                                        styles.programName
                                                    }
                                                >
                                                    {single
                                                        ? programById.get(
                                                              single.programId,
                                                          )?.name
                                                        : `${rows.length} programs`}
                                                </span>
                                            </p>
                                        </div>
                                        {figure(rows)}
                                    </div>
                                    {lines.length > 0 && (
                                        <ul className={styles.countryPrograms}>
                                            {lines}
                                        </ul>
                                    )}
                                </li>
                            );
                        },
                    )}
                </BreakdownList>
            )}
        </ProgressStatTile>
    );
}
