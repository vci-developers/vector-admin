'use client';

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { specimenSeverity } from '@/features/dashboard/utils/specimen-severity';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import {
    ACTIVE_COLOR,
    IDLE_COLOR,
    ZERO_CATCH_COLOR,
    type MapLayer,
} from './map-constants';

type DeviceRow = Dashboard['devices'][number];
export type PlacedDevice = DeviceRow & {
    position: NonNullable<DeviceRow['position']>;
};
export type SpecimenPoint = Dashboard['specimenPoints']['placed'][number];

export type MapSelection = { layer: MapLayer; ids: number[] } | null;

type SurveillanceMapProps = {
    layers: MapLayer[];
    specimenPoints: SpecimenPoint[];
    devices: PlacedDevice[];
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

function specimenStyle(count: number) {
    const step = specimenSeverity(count);
    return step
        ? `background:${step.fill};color:${step.text};border:2px solid #fff`
        : `background:#fff;color:${ZERO_CATCH_COLOR};border:2px solid ${ZERO_CATCH_COLOR}`;
}

const ring = (isSelected: boolean) =>
    `box-shadow:0 0 0 ${isSelected ? 3 : 1}px rgba(0,0,0,${isSelected ? 0.6 : 0.35})`;

const specimenIcon = (count: number, isSelected: boolean) =>
    shape(
        Math.min(28, 12 + 3 * Math.sqrt(count)),
        '9999px',
        `${specimenStyle(count)};${ring(isSelected)}`,
    );

const deviceIcon = (isActive: boolean, isSelected: boolean) =>
    shape(
        isSelected ? 16 : 13,
        '3px',
        `background:${isActive ? ACTIVE_COLOR : IDLE_COLOR};border:2px solid #fff;${ring(isSelected)}`,
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

type ClusterClick = L.LeafletMouseEvent & { layer: L.MarkerCluster };

export default function SurveillanceMap({
    layers,
    specimenPoints,
    devices,
    fitKey,
    dataKey,
    selection,
    onSelect,
}: SurveillanceMapProps) {
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
                    // a cluster and fan out on click instead of hiding each other.
                    maxClusterRadius={(zoom: number) => (zoom >= 11 ? 12 : 80)}
                    showCoverageOnHover={false}
                    iconCreateFunction={specimenCluster}
                    onClick={event =>
                        onSelect({
                            layer: 'specimens',
                            ids: idsIn(
                                (event as ClusterClick).layer,
                                sessionMarkers.current,
                            ),
                        })
                    }
                >
                    {specimenPoints.map(point => (
                        <Marker
                            key={point.sessionId}
                            ref={registerSession(point.sessionId)}
                            position={[point.latitude, point.longitude]}
                            icon={specimenIcon(
                                point.specimenCount,
                                isSelected('specimens', point.sessionId),
                            )}
                            eventHandlers={{
                                click: () =>
                                    onSelect({
                                        layer: 'specimens',
                                        ids: [point.sessionId],
                                    }),
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
                    iconCreateFunction={deviceCluster}
                    onClick={event =>
                        onSelect({
                            layer: 'devices',
                            ids: idsIn(
                                (event as ClusterClick).layer,
                                deviceMarkers.current,
                            ),
                        })
                    }
                >
                    {devices.map(device => (
                        <Marker
                            key={device.deviceId}
                            ref={registerDevice(device.deviceId)}
                            position={[
                                device.position.latitude,
                                device.position.longitude,
                            ]}
                            icon={deviceIcon(
                                device.status === 'ACTIVE',
                                isSelected('devices', device.deviceId),
                            )}
                            eventHandlers={{
                                click: () =>
                                    onSelect({
                                        layer: 'devices',
                                        ids: [device.deviceId],
                                    }),
                            }}
                        />
                    ))}
                </MarkerClusterGroup>
            )}
        </MapContainer>
    );
}
