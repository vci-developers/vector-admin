import type { Program } from '@/api/program/validation/program-schema';
import type { ProgressProgramDevices } from '@/api/progress/validation/progress-schema';
import {
    deviceFigures,
    devicesInSelection,
} from '@/features/dashboard/utils/build-progress-devices';
import { monthStartDate } from '@/features/dashboard/utils/month-key';
import { Smartphone } from 'lucide-react';
import { useFormatter } from 'next-intl';
import ProgramBreakdown from './program-breakdown';
import ProgressStatTile from './progress-stat-tile';
import styles from './progress-view.module.css';

/**
 * Active devices from the workbook, opening out to each Program's; against
 * the target only for a period that runs up to now.
 */
export default function ProgressDevicesTile({
    devices,
    selectedProgramIds,
    withTarget,
    programs,
    expanded,
    onToggle,
}: {
    devices: readonly ProgressProgramDevices[];
    /** The selected Area's Programs; null for every Program. */
    selectedProgramIds: readonly number[] | null;
    withTarget: boolean;
    programs: readonly Program[];
    expanded: boolean;
    onToggle: () => void;
}) {
    const formatter = useFormatter();
    const empty = (row: ProgressProgramDevices) =>
        deviceFigures([row], withTarget) === null;
    const inSelection = devicesInSelection(devices, selectedProgramIds);
    // Programs without devices this period stay listed, greyed out, last.
    const shown = [
        ...inSelection.filter(row => !empty(row)),
        ...inSelection.filter(empty),
    ];
    const totals = deviceFigures(shown, withTarget);

    const figure = (rows: readonly ProgressProgramDevices[]) => {
        const figures = deviceFigures(rows, withTarget);
        return figures === null ? (
            <span className={styles.noPeriodData}>
                No devices in this period
            </span>
        ) : (
            <p className={styles.deviceFigure}>
                <span className={styles.coverageCount}>
                    {formatter.number(figures.active)}
                </span>
                {figures.target !== null && (
                    <span className={styles.deviceFigurePlan}>
                        of {formatter.number(figures.target)}
                    </span>
                )}
            </p>
        );
    };

    return (
        <ProgressStatTile
            title="Devices"
            icon={Smartphone}
            value={totals?.active ?? 0}
            detail={
                totals === null ? (
                    'no devices in this period'
                ) : totals.target === null ? (
                    'active'
                ) : (
                    <>
                        active, of{' '}
                        <strong>{formatter.number(totals.target)}</strong>{' '}
                        projected
                        {totals.targetMonth !== null && (
                            <>
                                {' '}
                                by{' '}
                                <strong>
                                    {formatter.dateTime(
                                        monthStartDate(totals.targetMonth),
                                        {
                                            month: 'short',
                                            year: 'numeric',
                                            timeZone: 'UTC',
                                        },
                                    )}
                                </strong>
                            </>
                        )}
                    </>
                )
            }
            expanded={expanded}
            onToggle={onToggle}
        >
            {shown.length > 0 && (
                <ProgramBreakdown
                    rows={shown}
                    programs={
                        new Map(
                            programs.map(program => [
                                program.programId,
                                program,
                            ]),
                        )
                    }
                    label="Devices by country"
                    tone="coverage"
                    muted={empty}
                    figure={figure}
                />
            )}
        </ProgressStatTile>
    );
}
