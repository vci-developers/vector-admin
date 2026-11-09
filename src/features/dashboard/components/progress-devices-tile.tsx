import type { Program } from '@/api/program/validation/program-schema';
import type { ProgressProgramDevices } from '@/api/progress/validation/progress-schema';
import { deviceFigures } from '@/features/dashboard/utils/build-progress-devices';
import { Smartphone } from 'lucide-react';
import { useFormatter } from 'next-intl';
import ProgramBreakdown from './program-breakdown';
import ProgressStatTile from './progress-stat-tile';
import styles from './progress-view.module.css';

const unplanned = (row: ProgressProgramDevices) => row.planned === null;

/** Active devices against the plan, opening out to each Program's. */
export default function ProgressDevicesTile({
    devices,
    selectedProgramIds,
    programs,
    expanded,
    onToggle,
}: {
    devices: readonly ProgressProgramDevices[];
    /** The selected Area's Programs; null for every Program. */
    selectedProgramIds: readonly number[] | null;
    programs: readonly Program[];
    expanded: boolean;
    onToggle: () => void;
}) {
    const formatter = useFormatter();
    const inSelection = devices.filter(
        row =>
            !selectedProgramIds || selectedProgramIds.includes(row.programId),
    );
    // Programs without a plan this period stay listed, greyed out, last.
    const shown = [
        ...inSelection.filter(row => !unplanned(row)),
        ...inSelection.filter(unplanned),
    ];
    const { active, planned } = deviceFigures(shown);

    const figure = (rows: readonly ProgressProgramDevices[]) => {
        const totals = deviceFigures(rows);
        return totals.planned === null ? (
            <span className={styles.noPeriodData}>
                No devices planned in this period
            </span>
        ) : (
            <p className={styles.deviceFigure}>
                <span className={styles.coverageCount}>
                    {formatter.number(totals.active)}
                </span>
                <span className={styles.deviceFigurePlan}>
                    of {formatter.number(totals.planned)}
                </span>
            </p>
        );
    };

    return (
        <ProgressStatTile
            title="Devices"
            icon={Smartphone}
            value={active}
            detail={
                planned === null
                    ? 'no devices planned'
                    : `active, of ${formatter.number(planned)} planned`
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
                    muted={unplanned}
                    figure={figure}
                />
            )}
        </ProgressStatTile>
    );
}
