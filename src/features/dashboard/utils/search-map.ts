import {
    normalizePlaceName,
    type CoverageStatus,
} from './parse-coverage-sheets';
import type { LocationLevel } from './site-location-path';

type MapLayer = 'specimens' | 'devices';

type Searchable = { siteId: number | null; location: LocationLevel[] };
type SearchableSession = Searchable & { sessionId: number; programId: number };
type SearchableDevice = Searchable & { deviceId: number };

/** A Coverage Unit on the map, named as in the team's workbook. */
export type CoverageUnitRef = { programId: number; unit: string };
/** `sessionIds` come from every Session on the map, shown layer or not. */
type SearchableUnit = CoverageUnitRef & {
    status: CoverageStatus;
    sessionIds: number[];
};

/** What picking a result selects on the map. */
type Target = { layer: MapLayer; ids: number[] };

export type MapSearchResult = Target & { key: string } & (
        | {
              kind: 'place';
              name: string;
              level: string;
              /** The places above it, broadest first. */
              context: string[];
          }
        | { kind: 'site'; siteId: number; name: string | null }
        | { kind: 'session'; id: number }
        | { kind: 'device'; id: number }
        | {
              kind: 'unit';
              unit: CoverageUnitRef;
              status: CoverageStatus;
          }
    );

const MAX_RESULTS = 8;

// Specimen points when there are any, else devices, so a place selects one
// layer the way a map click does.
function targetOf(sessionIds: number[], deviceIds: number[]): Target | null {
    if (sessionIds.length > 0) return { layer: 'specimens', ids: sessionIds };
    if (deviceIds.length > 0) return { layer: 'devices', ids: deviceIds };
    return null;
}

type Group = { sessionIds: number[]; deviceIds: number[] };

function groupBy<Key>(
    sessions: SearchableSession[],
    devices: SearchableDevice[],
    keysOf: (item: Searchable) => Key[],
): Map<Key, Group> {
    const groups = new Map<Key, Group>();
    const add = (item: Searchable, push: (group: Group) => void) => {
        for (const key of keysOf(item)) {
            let group = groups.get(key);
            if (!group) {
                group = { sessionIds: [], deviceIds: [] };
                groups.set(key, group);
            }
            push(group);
        }
    };
    for (const s of sessions) add(s, g => g.sessionIds.push(s.sessionId));
    for (const d of devices) add(d, g => g.deviceIds.push(d.deviceId));
    return groups;
}

/**
 * The Sessions collected in a Coverage Unit: those in its Program whose Site's
 * top-level place has the unit's name (case, spaces and hyphens ignored).
 */
export function unitSessionIds(
    unit: CoverageUnitRef,
    sessions: SearchableSession[],
): number[] {
    const name = normalizePlaceName(unit.unit);
    return sessions
        .filter(
            s =>
                s.programId === unit.programId &&
                s.location[0] !== undefined &&
                normalizePlaceName(s.location[0].name) === name,
        )
        .map(s => s.sessionId);
}

const pathKey = (path: LocationLevel[]) =>
    path.map(({ level, name }) => `${level}=${name}`).join('/');

/**
 * What the map holds that matches the query, best first: a number finds
 * Sessions, devices and Sites by id ("#353" works too); words find Coverage
 * Units and places at any level of the Site hierarchy. Only what is on the
 * map is searched.
 */
export function searchMap(
    query: string,
    sessions: SearchableSession[],
    devices: SearchableDevice[],
    units: SearchableUnit[] = [],
): MapSearchResult[] {
    const text = query.trim().toLocaleLowerCase();
    if (!text) return [];

    const number = /^#?(\d+)$/.exec(text)?.[1];
    if (number) {
        const matches = (id: number) => String(id).startsWith(number);
        const bySite = groupBy(sessions, devices, item =>
            item.siteId !== null && matches(item.siteId) ? [item.siteId] : [],
        );
        const found: { id: number; result: MapSearchResult }[] = [
            ...sessions
                .filter(s => matches(s.sessionId))
                .map(s => ({
                    id: s.sessionId,
                    result: {
                        key: `session:${s.sessionId}`,
                        kind: 'session' as const,
                        id: s.sessionId,
                        layer: 'specimens' as const,
                        ids: [s.sessionId],
                    },
                })),
            ...devices
                .filter(d => matches(d.deviceId))
                .map(d => ({
                    id: d.deviceId,
                    result: {
                        key: `device:${d.deviceId}`,
                        kind: 'device' as const,
                        id: d.deviceId,
                        layer: 'devices' as const,
                        ids: [d.deviceId],
                    },
                })),
            ...[...bySite].flatMap(([siteId, group]) => {
                const target = targetOf(group.sessionIds, group.deviceIds);
                const item =
                    sessions.find(s => s.siteId === siteId) ??
                    devices.find(d => d.siteId === siteId);
                return target
                    ? [
                          {
                              id: siteId,
                              result: {
                                  key: `site:${siteId}`,
                                  kind: 'site' as const,
                                  siteId,
                                  name: item?.location.at(-1)?.name ?? null,
                                  ...target,
                              },
                          },
                      ]
                    : [];
            }),
        ];
        // Exact ids first, then the closest (shortest) ids.
        const exact = (id: number) => Number(String(id) === number);
        return found
            .sort((a, b) => exact(b.id) - exact(a.id) || a.id - b.id)
            .slice(0, MAX_RESULTS)
            .map(({ result }) => result);
    }

    const paths = new Map<string, LocationLevel[]>();
    const byPlace = groupBy(sessions, devices, item =>
        item.location.flatMap((place, index) => {
            if (!place.name.toLocaleLowerCase().includes(text)) return [];
            const path = item.location.slice(0, index + 1);
            const key = pathKey(path);
            paths.set(key, path);
            return [key];
        }),
    );
    // A unit stands in for the top-level place of the same name; it can be
    // found even with no points, and selects its Sessions.
    const unitResults: MapSearchResult[] = units
        .filter(u => u.unit.toLocaleLowerCase().includes(text))
        .map(u => ({
            key: `unit:${u.programId}:${u.unit}`,
            kind: 'unit' as const,
            unit: { programId: u.programId, unit: u.unit },
            status: u.status,
            layer: 'specimens' as const,
            ids: u.sessionIds,
        }));
    const unitNames = new Set(units.map(u => normalizePlaceName(u.unit)));
    const placeResults: MapSearchResult[] = [...byPlace].flatMap(
        ([key, group]) => {
            const target = targetOf(group.sessionIds, group.deviceIds);
            const path = paths.get(key)!;
            const place = path.at(-1)!;
            if (
                path.length === 1 &&
                unitNames.has(normalizePlaceName(place.name))
            )
                return [];
            return target
                ? [
                      {
                          key: `place:${key}`,
                          kind: 'place' as const,
                          name: place.name,
                          level: place.level,
                          context: path.slice(0, -1).map(p => p.name),
                          ...target,
                      },
                  ]
                : [];
        },
    );
    const nameOf = (result: MapSearchResult) =>
        result.kind === 'unit'
            ? result.unit.unit
            : result.kind === 'place'
              ? result.name
              : '';
    return [...unitResults, ...placeResults]
        .sort(
            (a, b) =>
                Number(nameOf(b).toLocaleLowerCase().startsWith(text)) -
                    Number(nameOf(a).toLocaleLowerCase().startsWith(text)) ||
                b.ids.length - a.ids.length ||
                nameOf(a).localeCompare(nameOf(b)),
        )
        .slice(0, MAX_RESULTS);
}
