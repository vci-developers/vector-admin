'use client';

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';

import type {
    CountryOutlineDto,
    CoverageFillDto,
} from '@/api/coverage/validation/coverage-schema';
import type { Program } from '@/api/program/validation/program-schema';
import type {
    PlacedDevice,
    PlacedSession,
} from '@/features/dashboard/utils/place-by-site';
import { buildOutsideMask } from '@/features/dashboard/utils/build-outside-mask';
import { coverageLabelPoint } from '@/features/dashboard/utils/coverage-label-point';
import { placeLabels } from '@/features/dashboard/utils/place-labels';
import {
    COVERAGE_STATUSES,
    type CoverageStatus,
} from '@/features/dashboard/utils/parse-coverage-sheets';
import type { CoverageUnitRef } from '@/features/dashboard/utils/search-map';
import {
    areaKey,
    buildAreaMarks,
    type AreaMark,
} from '@/features/dashboard/utils/build-area-marks';
import {
    AREA_SEVERITY_STEPS,
    specimenSeverity,
    type SeverityStep,
} from '@/features/dashboard/utils/specimen-severity';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    GeoJSON,
    MapContainer,
    Pane,
    Marker,
    Popup,
    TileLayer,
    useMap,
    useMapEvents,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import {
    ACTIVE_COLOR,
    COVERAGE_STYLES,
    IDLE_COLOR,
    ZERO_CATCH_COLOR,
    type MapLayer,
    type PointLayer,
} from './map-constants';
import LocationPath from './location-path';
import { DeviceDetails, SessionDetails } from './map-point-details';
import SpecimenSummary, { type SummarySession } from './specimen-summary';

/** A Coverage Unit picked on the map or in search, with its status. */
export type SelectedUnit = CoverageUnitRef & { status: CoverageStatus };

/** Points picked on the map; a unit selects the Sessions inside it. */
export type MapSelection = {
    layer: PointLayer;
    ids: number[];
    unit?: SelectedUnit;
} | null;
/** Points to zoom to; a new `seq` zooms again, even to the same points. */
export type MapFocus = {
    layer: PointLayer;
    ids: number[];
    seq: number;
    /** Zoom to this unit's shape instead of the points. */
    unit?: CoverageUnitRef;
} | null;

type SurveillanceMapProps = {
    layers: MapLayer[];
    coverageFills: CoverageFillDto[];
    /** The selected Programs' countries, outlined whatever layers are on. */
    outlines: CountryOutlineDto[];
    specimenPoints: PlacedSession[];
    devices: PlacedDevice[];
    /** Each device's Sessions in the period, whatever the map filters. */
    sessionsByDevice: Map<number, SummarySession[]>;
    programs: Map<number, Program>;
    /** Changes when the Program selection changes, so the map refits then only. */
    fitKey: string;
    /** Changes with the data; remounts clusters so their icons match it. */
    dataKey: string;
    selection: MapSelection;
    onSelect: (selection: MapSelection) => void;
    onSelectUnit: (unit: SelectedUnit) => void;
    focus: MapFocus;
    /** false for Stakeholders: summaries only, no Session's own details. */
    showSessions: boolean;
    /** One mark per Area (District or top hierarchy level), not per Session. */
    byArea: boolean;
    /** Active devices per Area key for its badge; else its device ids. */
    deviceCounts?: Map<string, number>;
    /** Planned devices per Area key, for its popup, where known. */
    devicePlans?: Map<string, number>;
};

const SHADOW = 'box-shadow:0 1px 3px rgba(0,0,0,.35)';

// Devices sit at their latest Session's GPS, usually the same point as a
// specimen mark, so device marks are drawn up and to the right like a badge.
const DEVICE_OFFSET = 22;

// Specimens are circles and devices rounded squares, so the layers stay
// distinct without relying on red vs green.
const shape = (
    size: number,
    radius: string,
    style: string,
    label = '',
    offset = 0,
) =>
    L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2 - offset, size / 2 + offset],
        html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${radius};font:600 11px/1 var(--font-geist-sans),sans-serif;${style}">${label}</span>`,
    });

function specimenStyle(count: number, bySite = false, steps?: SeverityStep[]) {
    const step = specimenSeverity(count, steps);
    return step
        ? `background:${step.fill};color:${step.text};${outline(bySite)}`
        : `background:#fff;color:${ZERO_CATCH_COLOR};${outline(bySite, ZERO_CATCH_COLOR)}`;
}

// Placed by Site, not GPS: dashed outline so estimates never pass for fixes.
const outline = (bySite: boolean, colour = '#fff') =>
    bySite ? `border:2px dashed #1f2937` : `border:2px solid ${colour}`;

const ring = (isSelected: boolean) =>
    `box-shadow:0 0 0 ${isSelected ? 3 : 1}px rgba(0,0,0,${isSelected ? 0.6 : 0.35})`;

const specimenIcon = (count: number, bySite: boolean, isSelected: boolean) =>
    shape(
        Math.min(28, 12 + 3 * Math.sqrt(count)),
        '9999px',
        `${specimenStyle(count, bySite)};${ring(isSelected)}`,
    );

const deviceIcon = (isActive: boolean, bySite: boolean, isSelected: boolean) =>
    shape(
        isSelected ? 16 : 13,
        '3px',
        `background:${isActive ? ACTIVE_COLOR : IDLE_COLOR};${outline(bySite)};${ring(isSelected)}`,
        '',
        DEVICE_OFFSET,
    );

const clusterSize = (value: number) =>
    value < 10 ? 30 : value < 100 ? 36 : value < 1000 ? 42 : 48;

/** Several Areas as one, for a cluster of overlapping marks. */
const mergeAreas = (areas: AreaMark[]): AreaMark => ({
    key: areas.map(a => a.key).join('|'),
    programId: areas[0]?.programId ?? 0,
    name: null,
    sessionIds: areas.flatMap(a => a.sessionIds),
    specimenCount: areas.reduce((sum, a) => sum + a.specimenCount, 0),
    deviceIds: areas.flatMap(a => a.deviceIds),
    deviceCount: areas.reduce((sum, a) => sum + a.deviceCount, 0),
    // Planned only when every merged Area has a plan.
    plannedDevices: areas.every(a => a.plannedDevices !== null)
        ? areas.reduce((sum, a) => sum + (a.plannedDevices ?? 0), 0)
        : null,
    latitude: areas[0]?.latitude ?? 0,
    longitude: areas[0]?.longitude ?? 0,
});

const areaSize = (count: number) => (count < 100 ? 28 : count < 1000 ? 34 : 40);

/**
 * One Area as a single mark: its specimens as a bubble on the Area scale and
 * its device count as a green badge on the bubble's shoulder, so nothing else
 * crowds round it. Its name is the Coverage Unit's label, set just below.
 */
function areaIcon(
    area: AreaMark,
    {
        specimens,
        devices,
        hasActive,
        isSelected,
    }: {
        specimens: boolean;
        devices: boolean;
        /** Any of its devices Active: green, else grey. */
        hasActive: boolean;
        isSelected: boolean;
    },
) {
    const hasBubble = specimens && area.sessionIds.length > 0;
    const hasBadge = devices && area.deviceCount > 0;
    const size = hasBubble ? areaSize(area.specimenCount) : 20;
    const font = 'font:600 11px/1 var(--font-geist-sans),sans-serif';
    const badge = (style: string) =>
        `<span style="position:absolute;${style};display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:5px;background:${hasActive ? ACTIVE_COLOR : IDLE_COLOR};color:#fff;border:2px solid #fff;${font};font-size:10px;${SHADOW}">${area.deviceCount}</span>`;
    const bubble = hasBubble
        ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:9999px;${font};${specimenStyle(area.specimenCount, false, AREA_SEVERITY_STEPS)};border-width:3px;${isSelected ? ring(true) : SHADOW}">${compact.format(area.specimenCount)}</span>`
        : '';
    const deviceBadge = hasBadge
        ? hasBubble
            ? badge('top:-6px;right:-12px')
            : badge(`inset:0;${isSelected ? ring(true) : SHADOW}`)
        : '';
    return L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<span style="position:relative;display:block;width:${size}px;height:${size}px">${bubble}${deviceBadge}</span>`,
    });
}
const compact = new Intl.NumberFormat('en', { notation: 'compact' });

function FitToPoints({
    points,
    fitKey,
}: {
    points: [number, number][];
    fitKey: string;
}) {
    const map = useMap();
    const fittedKey = useRef<string | null>(null);

    useEffect(() => {
        if (fittedKey.current === fitKey || points.length === 0) return;
        fittedKey.current = fitKey;
        map.fitBounds(points, { padding: [32, 32], maxZoom: 9 });
    }, [points, fitKey, map]);

    return null;
}

const PopupSummary = ({ sessions }: { sessions: SummarySession[] }) => (
    <div className="mt-2 border-t pt-2">
        <SpecimenSummary sessions={sessions} />
    </div>
);

/** What a click opened: one point, every point in a cluster, or an Area. */
type OpenPopup = {
    layer: PointLayer;
    ids: number[];
    cluster: L.MarkerCluster | null;
    area?: AreaMark;
};

// markercluster keeps the fanned-out cluster on its group but does not type it.
type SpiderfiableCluster = L.MarkerCluster & {
    _group?: { _spiderfied?: L.MarkerCluster | null };
};
const isSpreadOut = (cluster: L.MarkerCluster) =>
    (cluster as SpiderfiableCluster)._group?._spiderfied === cluster;

// Clicking a cluster no longer zooms by itself; this does it on request, or
// fans the points out when they share one spot and zooming cannot split them.
// Nothing is offered once the cluster is already fanned out.
function ClusterZoomButton({
    cluster,
    onDone,
}: {
    cluster: L.MarkerCluster;
    onDone: () => void;
}) {
    const t = useTranslations('MapSection');
    const map = useMap();
    const bounds = cluster.getBounds();
    const canZoom =
        !bounds.getNorthEast().equals(bounds.getSouthWest()) &&
        map.getZoom() < map.getMaxZoom();
    if (!canZoom && isSpreadOut(cluster)) return null;
    return (
        <Button
            size="xs"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => {
                onDone();
                if (canZoom) cluster.zoomToBounds({ padding: [40, 40] });
                else cluster.spiderfy();
            }}
        >
            {t(canZoom ? 'zoomIn' : 'spreadOut')}
        </Button>
    );
}

function ClusterContent({
    open,
    cluster,
    specimenPoints,
    devices,
    sessionsByDevice,
    showSessions,
    onDone,
}: {
    open: OpenPopup;
    showSessions: boolean;
    cluster: L.MarkerCluster;
    specimenPoints: PlacedSession[];
    devices: PlacedDevice[];
    sessionsByDevice: Map<number, SummarySession[]>;
    onDone: () => void;
}) {
    const t = useTranslations('MapSection');
    const ids = new Set(open.ids);
    const clusterDevices = devices.filter(d => ids.has(d.deviceId));
    const clusterSessions = specimenPoints.filter(p => ids.has(p.sessionId));
    const active = clusterDevices.filter(d => d.status === 'ACTIVE').length;
    return (
        <>
            <div className="mb-1">
                <LocationPath
                    items={
                        open.layer === 'specimens'
                            ? clusterSessions
                            : clusterDevices
                    }
                    // Stakeholders' counts are in the panel, framed as the tiles.
                    showCounts={showSessions}
                />
            </div>
            {/* Specimen clusters: the summary's first line already counts Sessions. */}
            {open.layer === 'devices' && (
                <>
                    <p className="text-sm font-medium">
                        {t('selectedDevices', { count: open.ids.length })}
                    </p>
                    <p className="text-muted-foreground text-xs">
                        {t('clusterStatus', {
                            active,
                            inactive: clusterDevices.length - active,
                        })}
                    </p>
                </>
            )}
            {open.layer === 'specimens' ? (
                <SpecimenSummary sessions={clusterSessions} />
            ) : (
                <PopupSummary
                    sessions={clusterDevices.flatMap(
                        d => sessionsByDevice.get(d.deviceId) ?? [],
                    )}
                />
            )}
            <ClusterZoomButton cluster={cluster} onDone={onDone} />
        </>
    );
}

function AreaContent({
    area,
    specimenPoints,
    devices,
}: {
    area: AreaMark;
    /** Only the layers on the map: an off layer passes []. */
    specimenPoints: PlacedSession[];
    devices: PlacedDevice[];
}) {
    const t = useTranslations('MapSection');
    const sessionIds = new Set(area.sessionIds);
    const deviceIds = new Set(area.deviceIds);
    const areaSessions = specimenPoints.filter(p =>
        sessionIds.has(p.sessionId),
    );
    const areaDevices = devices.filter(d => deviceIds.has(d.deviceId));
    return (
        <>
            <div className="mb-1">
                {/* Only Stakeholders see Areas; their counts are in the
                    panel, framed as the tiles. */}
                <LocationPath
                    items={areaSessions.length > 0 ? areaSessions : areaDevices}
                    showCounts={false}
                />
            </div>
            {areaDevices.length > 0 && area.deviceCount > 0 && (
                <p className="text-muted-foreground mb-1 text-xs">
                    {area.plannedDevices === null
                        ? t('devicesActive', { count: area.deviceCount })
                        : t('devicesOfPlanned', {
                              count: area.deviceCount,
                              planned: area.plannedDevices,
                          })}
                </p>
            )}
            {areaSessions.length > 0 && (
                <SpecimenSummary sessions={areaSessions} />
            )}
        </>
    );
}

function MapPopup({
    open,
    specimenPoints,
    devices,
    sessionsByDevice,
    programs,
    showSessions,
    onClose,
}: {
    open: OpenPopup | null;
    showSessions: boolean;
    specimenPoints: PlacedSession[];
    devices: PlacedDevice[];
    sessionsByDevice: Map<number, SummarySession[]>;
    programs: Map<number, Program>;
    onClose: (closed: OpenPopup) => void;
}) {
    if (!open) return null;
    // Device marks sit up and to the right of their point.
    const isDevice = open.layer === 'devices';
    const deviceOffset = (lift: number): [number, number] => [
        DEVICE_OFFSET,
        -DEVICE_OFFSET - lift,
    ];
    let target: {
        position: L.LatLngExpression;
        offset: [number, number];
        content: ReactNode;
    } | null = null;

    if (open.area) {
        target = {
            position: [open.area.latitude, open.area.longitude],
            offset: [0, -14],
            content: (
                <AreaContent
                    area={open.area}
                    specimenPoints={specimenPoints}
                    devices={devices}
                />
            ),
        };
    } else if (open.cluster) {
        target = {
            position: open.cluster.getLatLng(),
            offset: isDevice ? deviceOffset(12) : [0, -18],
            content: (
                <ClusterContent
                    open={open}
                    cluster={open.cluster}
                    specimenPoints={specimenPoints}
                    devices={devices}
                    sessionsByDevice={sessionsByDevice}
                    showSessions={showSessions}
                    onDone={() => onClose(open)}
                />
            ),
        };
    } else if (!isDevice) {
        const session = specimenPoints.find(p => p.sessionId === open.ids[0]);
        if (session) {
            target = {
                position: [session.latitude, session.longitude],
                offset: [0, -8],
                content: (
                    <>
                        <SessionDetails
                            session={session}
                            program={programs.get(session.programId)}
                            showSession={showSessions}
                        />
                        <PopupSummary sessions={[session]} />
                    </>
                ),
            };
        }
    } else {
        const device = devices.find(d => d.deviceId === open.ids[0]);
        if (device) {
            target = {
                position: [device.position.latitude, device.position.longitude],
                offset: deviceOffset(4),
                content: (
                    <>
                        <DeviceDetails
                            device={device}
                            program={programs.get(device.programId)}
                        />
                        <PopupSummary
                            sessions={
                                sessionsByDevice.get(device.deviceId) ?? []
                            }
                        />
                    </>
                ),
            };
        }
    }
    if (!target) return null;
    return (
        <Popup
            position={target.position}
            offset={target.offset}
            eventHandlers={{ remove: () => onClose(open) }}
        >
            {target.content}
        </Popup>
    );
}

/**
 * The selected countries picked out by fading the rest of the map, with no
 * border line of their own. Never clickable.
 */
function CountryFocus({ outlines }: { outlines: CountryOutlineDto[] }) {
    const mask = useMemo(
        () => buildOutsideMask(outlines.map(o => o.geometry)),
        [outlines],
    );
    if (outlines.length === 0) return null;
    // Keyed by the countries: react-leaflet's GeoJSON ignores new data.
    const key = outlines.map(o => o.country).join(',');
    return (
        // Below the coverage fills (400).
        <Pane name="outsideMask" style={{ zIndex: 390 }}>
            <GeoJSON
                key={key}
                data={mask}
                interactive={false}
                style={{
                    stroke: false,
                    fillColor: '#f8fafc',
                    fillOpacity: 0.45,
                }}
            />
        </Pane>
    );
}

const isUnit = (fill: CoverageFillDto, unit: CoverageUnitRef | undefined) =>
    unit?.programId === fill.programId && unit.unit === fill.unit;

/**
 * Leaflet measures its box once. The Stakeholder map stretches to fill the
 * window after that, so without this it keeps drawing tiles and shapes into
 * the old, shorter box and leaves a bare strip below.
 */
function FollowContainerSize() {
    const map = useMap();
    useEffect(() => {
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(map.getContainer());
        return () => observer.disconnect();
    }, [map]);
    return null;
}

/**
 * Markers are focusable, and the browser scrolls the page to show whatever
 * gains focus, so clicking a mark near the map's edge nudged the page. Leaflet
 * guards clicks on the map itself but not on its marks; this focuses a clicked
 * mark without scrolling, so it still takes keyboard focus.
 */
function KeepPageStillOnMarkClick() {
    const map = useMap();
    useEffect(() => {
        const container = map.getContainer();
        const onMouseDown = (event: MouseEvent) => {
            const mark = (event.target as Element).closest<HTMLElement>(
                '.leaflet-marker-icon',
            );
            if (!mark) return;
            event.preventDefault();
            mark.focus({ preventScroll: true });
        };
        container.addEventListener('mousedown', onMouseDown, true);
        return () =>
            container.removeEventListener('mousedown', onMouseDown, true);
    }, [map]);
    return null;
}

/**
 * A click on empty map clears the selection, as on any map. Points, clusters
 * and units don't pass their clicks on to the map, so they never clear it.
 */
function ClearOnEmptyClick({ onClear }: { onClear: () => void }) {
    useMapEvents({ click: onClear });
    return null;
}

function FlyToFocus({
    focus,
    positions,
    fills,
}: {
    focus: MapFocus;
    positions: Record<PointLayer, Map<number, L.LatLngTuple>>;
    fills: CoverageFillDto[];
}) {
    const map = useMap();
    const seq = focus?.seq;
    useEffect(() => {
        if (!focus) return;
        const fill = fills.find(f => isUnit(f, focus.unit));
        if (fill) {
            map.flyToBounds(L.geoJSON(fill.geometry).getBounds(), {
                padding: [48, 48],
                duration: 1,
            });
            return;
        }
        const points = focus.ids.flatMap(id => {
            const point = positions[focus.layer].get(id);
            return point ? [point] : [];
        });
        if (points.length > 0)
            map.flyToBounds(points, {
                padding: [48, 48],
                maxZoom: 14,
                // Leaflet's default scales with distance: seconds for a jump
                // across continents, with markers hidden the whole time.
                duration: 1,
            });
        // Only a new search pick zooms; data changes leave the view alone.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seq, map]);
    return null;
}

type ClusterClick = L.LeafletMouseEvent & { layer: L.MarkerCluster };

// Unit names, drawn above the fills and points so shading never hides one.
const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const unitLabel = (name: string, drop: number) =>
    L.divIcon({
        className: '',
        iconSize: [0, 0],
        html: `<span style="position:absolute;top:${drop}px;transform:translate(-50%,-50%);white-space:nowrap;font:600 12px/1 var(--font-geist-sans),sans-serif;color:#0f172a;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 2px #fff">${escapeHtml(name)}</span>`,
    });

/**
 * Coverage Units filled by status, under the points, with their names on top.
 * Multiply blending tints the map like a highlighter, so the tiles' own place
 * names stay readable through fills and outlines; hovering a unit thickens
 * its outline.
 */
// Names show between these zooms: further out a District name means little,
// further in the tiles print District names themselves.
const MIN_LABEL_ZOOM = 6;
const MAX_LABEL_ZOOM = 8;
// The label's box in pixels, from its 12 px semibold text plus a little air.
const labelBox = (name: string) => ({
    width: name.length * 7.6 + 10,
    height: 16,
});

function CoverageFills({
    fills,
    labelDrops,
    selected,
    onSelect,
}: {
    fills: CoverageFillDto[];
    /**
     * Pixels to lower a unit's name by, keyed by `areaKey`: an Area mark sits
     * where the name would, so the name goes just beneath it.
     */
    labelDrops: Map<string, number>;
    selected: CoverageUnitRef | undefined;
    onSelect: (unit: SelectedUnit) => void;
}) {
    const map = useMap();
    const [zoom, setZoom] = useState(() => map.getZoom());
    useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
    // When names collide, Active units keep theirs first, then Targeted, then
    // the rest; within a status the bigger District wins.
    const labels = useMemo(
        () =>
            fills
                .flatMap(fill => {
                    const point = coverageLabelPoint(fill.geometry);
                    return point
                        ? [
                              {
                                  key: areaKey(fill.programId, fill.unit),
                                  at: point.at,
                                  area: point.area,
                                  rank: COVERAGE_STATUSES.indexOf(fill.status),
                                  name: fill.unit,
                              },
                          ]
                        : [];
                })
                .sort((a, b) => a.rank - b.rank || b.area - a.area),
        [fills],
    );
    // Projected at the zoom alone, so panning never reshuffles the names.
    const shown = useMemo(() => {
        if (zoom < MIN_LABEL_ZOOM || zoom > MAX_LABEL_ZOOM) return new Set();
        return placeLabels(
            labels.map(label => {
                const { x, y } = map.project(label.at, zoom);
                return {
                    key: label.key,
                    x,
                    y: y + (labelDrops.get(label.key) ?? 0),
                    ...labelBox(label.name),
                };
            }),
        );
    }, [labels, zoom, map, labelDrops]);
    return (
        <>
            <Pane
                name="coverage"
                style={{ zIndex: 400, mixBlendMode: 'multiply' }}
            >
                {fills.map(fill => {
                    const style = COVERAGE_STYLES[fill.status];
                    const { color, fillOpacity } = style;
                    // The selected unit keeps the hover outline.
                    const weight = isUnit(fill, selected)
                        ? style.weight + 2
                        : style.weight;
                    return (
                        <GeoJSON
                            key={`${fill.programId}:${fill.unit}`}
                            data={fill.geometry}
                            // A unit click selects it; it must not reach the
                            // map, which clears the selection.
                            bubblingMouseEvents={false}
                            style={{
                                color,
                                weight,
                                opacity: 0.9,
                                fillColor: color,
                                fillOpacity,
                            }}
                            eventHandlers={{
                                mouseover: event =>
                                    (event.target as L.GeoJSON).setStyle({
                                        weight: style.weight + 2,
                                    }),
                                mouseout: event =>
                                    (event.target as L.GeoJSON).setStyle({
                                        weight,
                                    }),
                                click: () =>
                                    onSelect({
                                        programId: fill.programId,
                                        unit: fill.unit,
                                        status: fill.status,
                                    }),
                            }}
                        />
                    );
                })}
            </Pane>
            {/* Above the points (600), below popups (700); never clickable. */}
            <Pane
                name="coverageLabels"
                style={{ zIndex: 640, pointerEvents: 'none' }}
            >
                {labels
                    .filter(label => shown.has(label.key))
                    .map(label => (
                        <Marker
                            key={label.key}
                            position={label.at}
                            icon={unitLabel(
                                label.name,
                                labelDrops.get(label.key) ?? 0,
                            )}
                            interactive={false}
                            keyboard={false}
                        />
                    ))}
            </Pane>
        </>
    );
}

export default function SurveillanceMap({
    layers,
    coverageFills,
    outlines,
    specimenPoints,
    devices,
    sessionsByDevice,
    programs,
    fitKey,
    dataKey,
    selection,
    onSelect,
    onSelectUnit,
    focus,
    showSessions,
    byArea,
    deviceCounts,
    devicePlans,
}: SurveillanceMapProps) {
    // Every click opens a popup; the panel beside the map lists the same ids.
    const [openPopup, setOpenPopup] = useState<OpenPopup | null>(null);
    const select = (
        layer: PointLayer,
        ids: number[],
        cluster: L.MarkerCluster | null = null,
    ) => {
        setOpenPopup({ layer, ids, cluster });
        onSelect({ layer, ids });
    };
    // An Area selects its Sessions, or its devices when it has no Sessions
    // on the map.
    const selectArea = (area: AreaMark) => {
        const layer: PointLayer =
            showSpecimens && area.sessionIds.length > 0
                ? 'specimens'
                : 'devices';
        const ids = layer === 'specimens' ? area.sessionIds : area.deviceIds;
        setOpenPopup({ layer, ids, cluster: null, area });
        onSelect({ layer, ids });
    };
    const selectCluster = (
        layer: PointLayer,
        markers: Map<L.Marker, number>,
        event: L.LeafletEvent,
    ) => {
        const cluster = (event as ClusterClick).layer;
        select(layer, idsIn(cluster, markers), cluster);
    };
    const sessionMarkers = useRef(new Map<L.Marker, number>());
    const deviceMarkers = useRef(new Map<L.Marker, number>());
    const showSpecimens = layers.includes('specimens');
    const showDevices = layers.includes('devices');
    const showCoverage = layers.includes('coverage');
    const isSelected = (layer: PointLayer, id: number) =>
        selection?.layer === layer && selection.ids.includes(id);

    // Memoized by the React Compiler.
    const areas = byArea
        ? buildAreaMarks({
              sessions: showSpecimens ? specimenPoints : [],
              devices: showDevices ? devices : [],
              deviceCounts,
              devicePlans,
              anchors: new Map(
                  coverageFills.flatMap(fill => {
                      const point = coverageLabelPoint(fill.geometry);
                      return point
                          ? [
                                [
                                    areaKey(fill.programId, fill.unit),
                                    point.at,
                                ] as const,
                            ]
                          : [];
                  }),
              ),
          })
        : [];
    const isAreaSelected = (area: AreaMark) =>
        selection !== null &&
        (selection.layer === 'specimens' ? area.sessionIds : area.deviceIds)
            .length === selection.ids.length &&
        selection.ids.every(id =>
            (selection.layer === 'specimens'
                ? area.sessionIds
                : area.deviceIds
            ).includes(id),
        );
    const specimenCounts = useMemo(
        () => new Map(specimenPoints.map(p => [p.sessionId, p.specimenCount])),
        [specimenPoints],
    );
    // Stable position arrays: react-leaflet moves a marker whenever its
    // position prop is a new array, and the cluster group re-adds a moved
    // marker, which collapses a spread-out cluster on the next render.
    const sessionPositions = useMemo(
        () =>
            new Map(
                specimenPoints.map(p => [
                    p.sessionId,
                    [p.latitude, p.longitude] as L.LatLngTuple,
                ]),
            ),
        [specimenPoints],
    );
    const devicePositions = useMemo(
        () =>
            new Map(
                devices.map(d => [
                    d.deviceId,
                    [
                        d.position.latitude,
                        d.position.longitude,
                    ] as L.LatLngTuple,
                ]),
            ),
        [devices],
    );
    const activeDevices = useMemo(
        () =>
            new Set(
                devices.filter(d => d.status === 'ACTIVE').map(d => d.deviceId),
            ),
        [devices],
    );

    const areaMarkers = useRef(new Map<L.Marker, AreaMark>());
    const markOptions = (area: AreaMark, isSelected = false) => ({
        specimens: showSpecimens,
        devices: showDevices,
        hasActive: area.deviceIds.some(id => activeDevices.has(id)),
        isSelected,
    });
    // A unit's name goes just below its Area's bubble.
    const labelDrops = new Map(
        areas
            .filter(area => showSpecimens && area.sessionIds.length > 0)
            .map(area => [area.key, areaSize(area.specimenCount) / 2 + 9]),
    );
    // Areas whose marks would overlap merge, their counts added up.
    const areasIn = (cluster: L.MarkerCluster) =>
        mergeAreas(
            cluster
                .getAllChildMarkers()
                .flatMap(
                    (marker: L.Marker) => areaMarkers.current.get(marker) ?? [],
                ),
        );
    function areaCluster(cluster: L.MarkerCluster) {
        const merged = areasIn(cluster);
        return areaIcon(merged, markOptions(merged));
    }
    const selectAreaCluster = (event: L.LeafletEvent) => {
        const cluster = (event as ClusterClick).layer;
        const merged = areasIn(cluster);
        const layer: PointLayer =
            showSpecimens && merged.sessionIds.length > 0
                ? 'specimens'
                : 'devices';
        select(
            layer,
            layer === 'specimens' ? merged.sessionIds : merged.deviceIds,
            cluster,
        );
    };
    const idsIn = (cluster: L.MarkerCluster, markers: Map<L.Marker, number>) =>
        cluster.getAllChildMarkers().flatMap((marker: L.Marker) => {
            const id = markers.get(marker);
            return id === undefined ? [] : [id];
        });

    // Label = total specimens; colour = the worst Session inside, so a
    // hotspot still shows when zoomed out.
    function specimenCluster(cluster: L.MarkerCluster) {
        const counts = idsIn(cluster, sessionMarkers.current).map(
            id => specimenCounts.get(id) ?? 0,
        );
        const total = counts.reduce((sum, n) => sum + n, 0);
        return shape(
            clusterSize(total),
            '9999px',
            `${specimenStyle(Math.max(0, ...counts))};border-width:3px;${SHADOW}`,
            compact.format(total),
        );
    }

    function deviceCluster(cluster: L.MarkerCluster) {
        const ids = idsIn(cluster, deviceMarkers.current);
        const anyActive = ids.some(id => activeDevices.has(id));
        // Small fixed-size badge so it clears the specimen circle it sits beside.
        return shape(
            ids.length < 100 ? 24 : 30,
            '6px',
            `background:${anyActive ? ACTIVE_COLOR : IDLE_COLOR};color:#fff;font-size:10px;border:2px solid #fff;${SHADOW}`,
            String(ids.length),
            DEVICE_OFFSET,
        );
    }

    // Fill corners count towards the fit, so a coverage-only map still zooms in.
    const coverageCorners = useMemo(
        () =>
            coverageFills.flatMap(fill => {
                const positions = fill.geometry.coordinates.flat(2);
                const lats = positions.map(([, lat]) => lat);
                const lons = positions.map(([lon]) => lon);
                return [
                    [Math.min(...lats), Math.min(...lons)],
                    [Math.max(...lats), Math.max(...lons)],
                ] as [number, number][];
            }),
        [coverageFills],
    );

    const fitPoints: [number, number][] = [
        ...(showCoverage ? coverageCorners : []),
        ...(showSpecimens
            ? specimenPoints.map(
                  p => [p.latitude, p.longitude] as [number, number],
              )
            : []),
        ...(showDevices
            ? devices.map(
                  d =>
                      [d.position.latitude, d.position.longitude] as [
                          number,
                          number,
                      ],
              )
            : []),
    ];

    const registerSession = (id: number) => (marker: L.Marker | null) => {
        if (marker) sessionMarkers.current.set(marker, id);
    };
    const registerDevice = (id: number) => (marker: L.Marker | null) => {
        if (marker) deviceMarkers.current.set(marker, id);
    };

    return (
        <MapContainer
            center={[0, 20]}
            zoom={2}
            scrollWheelZoom
            className="h-full w-full"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CountryFocus outlines={outlines} />
            {showCoverage && (
                <CoverageFills
                    fills={coverageFills}
                    labelDrops={labelDrops}
                    selected={selection?.unit}
                    onSelect={onSelectUnit}
                />
            )}
            <FollowContainerSize />
            <KeepPageStillOnMarkClick />
            <ClearOnEmptyClick
                onClear={() => {
                    setOpenPopup(null);
                    if (selection) onSelect(null);
                }}
            />
            <FitToPoints
                points={fitPoints}
                fitKey={`${layers.join(',')}:${fitKey}`}
            />
            <FlyToFocus
                focus={focus}
                positions={{
                    specimens: sessionPositions,
                    devices: devicePositions,
                }}
                fills={showCoverage ? coverageFills : []}
            />
            {areas.length > 0 && (
                <MarkerClusterGroup
                    key={`areas:${dataKey}:${layers.join(',')}`}
                    maxClusterRadius={44}
                    showCoverageOnHover={false}
                    zoomToBoundsOnClick={false}
                    iconCreateFunction={areaCluster}
                    onClick={selectAreaCluster}
                >
                    {areas.map(area => (
                        <Marker
                            key={area.key}
                            ref={marker => {
                                if (marker)
                                    areaMarkers.current.set(marker, area);
                            }}
                            position={[area.latitude, area.longitude]}
                            icon={areaIcon(
                                area,
                                markOptions(area, isAreaSelected(area)),
                            )}
                            eventHandlers={{ click: () => selectArea(area) }}
                        />
                    ))}
                </MarkerClusterGroup>
            )}
            {showSpecimens && !byArea && (
                <MarkerClusterGroup
                    key={`specimens:${dataKey}`}
                    chunkedLoading
                    // Clustering never switches off: points sharing a GPS fix stay
                    // a cluster, and its popup's button fans them out.
                    maxClusterRadius={(zoom: number) => (zoom >= 11 ? 12 : 80)}
                    showCoverageOnHover={false}
                    zoomToBoundsOnClick={false}
                    iconCreateFunction={specimenCluster}
                    onClick={event =>
                        selectCluster(
                            'specimens',
                            sessionMarkers.current,
                            event,
                        )
                    }
                >
                    {specimenPoints.map(point => (
                        <Marker
                            key={point.sessionId}
                            ref={registerSession(point.sessionId)}
                            position={
                                sessionPositions.get(point.sessionId) ?? [
                                    point.latitude,
                                    point.longitude,
                                ]
                            }
                            icon={specimenIcon(
                                point.specimenCount,
                                point.placement.by === 'site',
                                isSelected('specimens', point.sessionId),
                            )}
                            eventHandlers={{
                                click: () =>
                                    select('specimens', [point.sessionId]),
                            }}
                        />
                    ))}
                </MarkerClusterGroup>
            )}
            {showDevices && !byArea && (
                <MarkerClusterGroup
                    key={`devices:${dataKey}`}
                    chunkedLoading
                    maxClusterRadius={(zoom: number) => (zoom >= 7 ? 12 : 80)}
                    showCoverageOnHover={false}
                    zoomToBoundsOnClick={false}
                    iconCreateFunction={deviceCluster}
                    onClick={event =>
                        selectCluster('devices', deviceMarkers.current, event)
                    }
                >
                    {devices.map(device => (
                        <Marker
                            key={device.deviceId}
                            ref={registerDevice(device.deviceId)}
                            position={
                                devicePositions.get(device.deviceId) ?? [
                                    device.position.latitude,
                                    device.position.longitude,
                                ]
                            }
                            icon={deviceIcon(
                                device.status === 'ACTIVE',
                                device.placement.by === 'site',
                                isSelected('devices', device.deviceId),
                            )}
                            eventHandlers={{
                                click: () =>
                                    select('devices', [device.deviceId]),
                            }}
                        />
                    ))}
                </MarkerClusterGroup>
            )}
            <MapPopup
                // Hidden once the selection moves on (e.g. a filter change).
                open={
                    openPopup &&
                    selection?.layer === openPopup.layer &&
                    selection.ids === openPopup.ids
                        ? openPopup
                        : null
                }
                specimenPoints={showSpecimens ? specimenPoints : []}
                devices={showDevices ? devices : []}
                sessionsByDevice={sessionsByDevice}
                programs={programs}
                showSessions={showSessions}
                onClose={closed =>
                    // Only clear if no other popup has opened since.
                    setOpenPopup(current =>
                        current === closed ? null : current,
                    )
                }
            />
        </MapContainer>
    );
}
