'use client';

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';

import type { Program } from '@/api/program/validation/program-schema';
import type {
    PlacedDevice,
    PlacedSession,
} from '@/features/dashboard/utils/place-by-site';
import { specimenSeverity } from '@/features/dashboard/utils/specimen-severity';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import {
    ACTIVE_COLOR,
    IDLE_COLOR,
    ZERO_CATCH_COLOR,
    type MapLayer,
} from './map-constants';
import { DeviceDetails, SessionDetails } from './map-point-details';
import SpecimenSummary, { type SummarySession } from './specimen-summary';

export type MapSelection = { layer: MapLayer; ids: number[] } | null;

type SurveillanceMapProps = {
    layers: MapLayer[];
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

function specimenStyle(count: number, bySite = false) {
    const step = specimenSeverity(count);
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

/** What a click opened: one point, or every point in a cluster. */
type OpenPopup = {
    layer: MapLayer;
    ids: number[];
    cluster: L.MarkerCluster | null;
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
    onDone,
}: {
    open: OpenPopup;
    cluster: L.MarkerCluster;
    specimenPoints: PlacedSession[];
    devices: PlacedDevice[];
    sessionsByDevice: Map<number, SummarySession[]>;
    onDone: () => void;
}) {
    const t = useTranslations('MapSection');
    const ids = new Set(open.ids);
    const clusterDevices = devices.filter(d => ids.has(d.deviceId));
    const active = clusterDevices.filter(d => d.status === 'ACTIVE').length;
    return (
        <>
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
                <SpecimenSummary
                    sessions={specimenPoints.filter(p => ids.has(p.sessionId))}
                />
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

function MapPopup({
    open,
    specimenPoints,
    devices,
    sessionsByDevice,
    programs,
    onClose,
}: {
    open: OpenPopup | null;
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

    if (open.cluster) {
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

type ClusterClick = L.LeafletMouseEvent & { layer: L.MarkerCluster };

export default function SurveillanceMap({
    layers,
    specimenPoints,
    devices,
    sessionsByDevice,
    programs,
    fitKey,
    dataKey,
    selection,
    onSelect,
}: SurveillanceMapProps) {
    // Every click opens a popup; the panel beside the map lists the same ids.
    const [openPopup, setOpenPopup] = useState<OpenPopup | null>(null);
    const select = (
        layer: MapLayer,
        ids: number[],
        cluster: L.MarkerCluster | null = null,
    ) => {
        setOpenPopup({ layer, ids, cluster });
        onSelect({ layer, ids });
    };
    const selectCluster = (
        layer: MapLayer,
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
    const isSelected = (layer: MapLayer, id: number) =>
        selection?.layer === layer && selection.ids.includes(id);

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

    const fitPoints: [number, number][] = [
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
            <FitToPoints
                points={fitPoints}
                fitKey={`${layers.join(',')}:${fitKey}`}
            />
            {showSpecimens && (
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
            {showDevices && (
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
