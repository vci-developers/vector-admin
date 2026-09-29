/** Why a selected Program has no specimens on the map. */
export type SpecimenGap =
    | { kind: 'noSessions' }
    | { kind: 'filtered'; specimens: number; sessions: number }
    | { kind: 'noLocation'; sessions: number };

/** Why a selected Program has no devices on the map. */
export type DeviceGap =
    | { kind: 'filtered'; devices: number }
    | { kind: 'noLocation'; devices: number };

export type ProgramMapGap = {
    programId: number;
    specimens: SpecimenGap | null;
    devices: DeviceGap | null;
};

type Stage<Item> = {
    /** Before the map filters. */
    all: Item[];
    /** After the map filters, placed or not. */
    shown: Item[];
    /** After the map filters, with a map position. */
    placed: Item[];
};
type WithProgram = { programId: number };

const itemsOf = <Item extends WithProgram>(items: Item[], programId: number) =>
    items.filter(item => item.programId === programId);

/**
 * Names each selected Program that has nothing on a visible layer, and why:
 * the map filters never change the Program Filter, so an empty Program must be
 * called out rather than silently missing.
 */
export function findMapGaps({
    programIds,
    sessions,
    devices,
}: {
    programIds: number[];
    /** Null when the specimens layer is off. */
    sessions: Stage<WithProgram & { specimenCount: number }> | null;
    /** Null when the devices layer is off. */
    devices: Stage<WithProgram> | null;
}): ProgramMapGap[] {
    return programIds.flatMap(programId => {
        let specimens: SpecimenGap | null = null;
        if (sessions) {
            const all = itemsOf(sessions.all, programId);
            const shown = itemsOf(sessions.shown, programId);
            if (all.length === 0) specimens = { kind: 'noSessions' };
            else if (shown.length === 0) {
                specimens = {
                    kind: 'filtered',
                    sessions: all.length,
                    specimens: all.reduce((sum, s) => sum + s.specimenCount, 0),
                };
            } else if (itemsOf(sessions.placed, programId).length === 0) {
                specimens = { kind: 'noLocation', sessions: shown.length };
            }
        }

        let deviceGap: DeviceGap | null = null;
        if (devices) {
            const all = itemsOf(devices.all, programId);
            const shown = itemsOf(devices.shown, programId);
            // A Program whose devices were never used has nothing to place.
            if (all.length > 0 && shown.length === 0) {
                deviceGap = { kind: 'filtered', devices: all.length };
            } else if (
                shown.length > 0 &&
                itemsOf(devices.placed, programId).length === 0
            ) {
                deviceGap = { kind: 'noLocation', devices: shown.length };
            }
        }

        return specimens || deviceGap
            ? [{ programId, specimens, devices: deviceGap }]
            : [];
    });
}
