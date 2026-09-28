'use client';

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';

export type MapLayer = 'specimens' | 'devices';

type DeviceRow = Dashboard['devices'][number];
export type PlacedDevice = DeviceRow & {
    position: NonNullable<DeviceRow['position']>;
};
export type SpecimenPoint = Dashboard['specimenPoints']['placed'][number];

type SurveillanceMapProps = {
    layer: MapLayer;
    specimenPoints: SpecimenPoint[];
    devices: PlacedDevice[];
    /** Changes when the Program selection changes, so the map refits then only. */
    fitKey: string;
    /** Changes with the data; remounts clusters so their icons match it. */
    dataKey: string;
    selectedIds: number[];
    onSelect: (ids: number[]) => void;
};

// Device status colors; the legend beside the map carries the meaning in text.
export const ACTIVE_COLOR = '#15803d';
export const IDLE_COLOR = '#6b7280';
const SPECIMEN_COLOR = 'var(--primary)';

const circle = (size: number, style: string, label = '') =>
    L.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;font:600 11px/1 var(--font-geist-sans),sans-serif;color:#fff;${style}">${label}</span>`,
    });

function specimenMarkerIcon(count: number, isSelected: boolean) {
    const size = Math.min(30, 12 + 3 * Math.sqrt(count));
    const ring = isSelected
        ? '0 0 0 3px rgba(0,0,0,.55)'
        : '0 0 0 1px rgba(0,0,0,.35)';
    // Zero-catch Sessions are hollow so they read as "collected, nothing caught".
    const fill =
        count === 0
            ? 'background:#fff;border:2px solid'
            : `background:${SPECIMEN_COLOR};border:2px solid #fff`;
    return circle(
        size,
        `${fill} ${count === 0 ? SPECIMEN_COLOR : ''};box-shadow:${ring}`,
    );
}

function deviceMarkerIcon(isActive: boolean, isSelected: boolean) {
    const size = isSelected ? 18 : 14;
    return circle(
        size,
        `background:${isActive ? ACTIVE_COLOR : IDLE_COLOR};border:2px solid #fff;box-shadow:0 0 0 ${isSelected ? 3 : 1}px rgba(0,0,0,.45)`,
    );
}

const clusterSize = (value: number) =>
    value < 10 ? 32 : value < 100 ? 38 : value < 1000 ? 44 : 50;
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

export default function SurveillanceMap({
    layer,
    specimenPoints,
    devices,
    fitKey,
    dataKey,
    selectedIds,
    onSelect,
}: SurveillanceMapProps) {
    const markerIds = useRef(new Map<L.Marker, number>());
    const selected = new Set(selectedIds);
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

    const childIds = (cluster: L.MarkerCluster) =>
        cluster.getAllChildMarkers().flatMap((marker: L.Marker) => {
            const id = markerIds.current.get(marker);
            return id === undefined ? [] : [id];
        });

    function clusterIcon(cluster: L.MarkerCluster) {
        const ids = childIds(cluster);
        if (layer === 'specimens') {
            const total = ids.reduce(
                (sum, id) => sum + (specimenCounts.get(id) ?? 0),
                0,
            );
            return circle(
                clusterSize(total),
                `background:${SPECIMEN_COLOR};border:3px solid rgba(255,255,255,.85);box-shadow:0 1px 3px rgba(0,0,0,.35)`,
                compact.format(total),
            );
        }
        const anyActive = ids.some(id => activeDevices.has(id));
        return circle(
            clusterSize(ids.length),
            `background:${anyActive ? ACTIVE_COLOR : IDLE_COLOR};border:3px solid rgba(255,255,255,.85);box-shadow:0 1px 3px rgba(0,0,0,.35)`,
            String(ids.length),
        );
    }

    const fitPoints: [number, number][] =
        layer === 'specimens'
            ? specimenPoints.map(p => [p.latitude, p.longitude])
            : devices.map(d => [d.position.latitude, d.position.longitude]);

    const registerMarker = (id: number) => (marker: L.Marker | null) => {
        if (marker) markerIds.current.set(marker, id);
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
            <FitToPoints points={fitPoints} fitKey={`${layer}:${fitKey}`} />
            <MarkerClusterGroup
                key={`${layer}:${dataKey}`}
                chunkedLoading
                disableClusteringAtZoom={layer === 'devices' ? 7 : 11}
                showCoverageOnHover={false}
                iconCreateFunction={clusterIcon}
                onClick={event =>
                    onSelect(
                        childIds(
                            (
                                event as L.LeafletMouseEvent & {
                                    layer: L.MarkerCluster;
                                }
                            ).layer,
                        ),
                    )
                }
            >
                {layer === 'specimens'
                    ? specimenPoints.map(point => (
                          <Marker
                              key={point.sessionId}
                              ref={registerMarker(point.sessionId)}
                              position={[point.latitude, point.longitude]}
                              icon={specimenMarkerIcon(
                                  point.specimenCount,
                                  selected.has(point.sessionId),
                              )}
                              eventHandlers={{
                                  click: () => onSelect([point.sessionId]),
                              }}
                          />
                      ))
                    : devices.map(device => (
                          <Marker
                              key={device.deviceId}
                              ref={registerMarker(device.deviceId)}
                              position={[
                                  device.position.latitude,
                                  device.position.longitude,
                              ]}
                              icon={deviceMarkerIcon(
                                  device.status === 'ACTIVE',
                                  selected.has(device.deviceId),
                              )}
                              eventHandlers={{
                                  click: () => onSelect([device.deviceId]),
                              }}
                          />
                      ))}
            </MarkerClusterGroup>
        </MapContainer>
    );
}
