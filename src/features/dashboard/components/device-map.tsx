'use client';

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';

import type { DeviceRow } from '@/features/dashboard/utils/classify-devices';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';

type PlacedDevice = DeviceRow & {
    position: NonNullable<DeviceRow['position']>;
};

type DeviceMapProps = {
    devices: PlacedDevice[];
    /** Changes when the Program selection changes, so the map refits then only. */
    fitKey: string;
    selectedDeviceIds: number[];
    onSelect: (deviceIds: number[]) => void;
};

// Status colors; the legend beside the map carries the meaning in text.
const ACTIVE_COLOR = '#15803d';
const IDLE_COLOR = '#6b7280';

function markerIcon(isActive: boolean, isSelected: boolean) {
    const size = isSelected ? 18 : 14;
    return L.divIcon({
        className: '',
        iconSize: [size, size],
        html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${isActive ? ACTIVE_COLOR : IDLE_COLOR};border:2px solid #fff;box-shadow:0 0 0 ${isSelected ? 2 : 1}px rgba(0,0,0,.45)"></span>`,
    });
}

function FitToDevices({
    devices,
    fitKey,
}: {
    devices: PlacedDevice[];
    fitKey: string;
}) {
    const map = useMap();
    const fittedKey = useRef<string | null>(null);

    // Refit when the Program selection changes, not when the month does.
    useEffect(() => {
        if (fittedKey.current === fitKey || devices.length === 0) return;
        fittedKey.current = fitKey;
        map.fitBounds(
            devices.map(d => [d.position.latitude, d.position.longitude]),
            { padding: [32, 32], maxZoom: 9 },
        );
    }, [devices, fitKey, map]);

    return null;
}

export default function DeviceMap({
    devices,
    fitKey,
    selectedDeviceIds,
    onSelect,
}: DeviceMapProps) {
    const markerDevices = useRef(new Map<L.Marker, PlacedDevice>());
    const selected = new Set(selectedDeviceIds);

    function clusterIcon(cluster: L.MarkerCluster) {
        const children = cluster.getAllChildMarkers();
        const anyActive = children.some(
            marker => markerDevices.current.get(marker)?.status === 'ACTIVE',
        );
        const count = children.length;
        const size = count < 10 ? 32 : count < 100 ? 38 : 44;
        return L.divIcon({
            className: '',
            iconSize: [size, size],
            html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${anyActive ? ACTIVE_COLOR : IDLE_COLOR};color:#fff;font:600 12px/1 var(--font-geist-sans),sans-serif;border:3px solid rgba(255,255,255,.85);box-shadow:0 1px 3px rgba(0,0,0,.35)">${count}</span>`,
        });
    }

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
            <FitToDevices devices={devices} fitKey={fitKey} />
            <MarkerClusterGroup
                chunkedLoading
                disableClusteringAtZoom={7}
                showCoverageOnHover={false}
                iconCreateFunction={clusterIcon}
                onClick={event => {
                    const cluster = (
                        event as L.LeafletMouseEvent & {
                            layer: L.MarkerCluster;
                        }
                    ).layer;
                    onSelect(
                        cluster
                            .getAllChildMarkers()
                            .flatMap((marker: L.Marker) => {
                                const device =
                                    markerDevices.current.get(marker);
                                return device ? [device.deviceId] : [];
                            }),
                    );
                }}
            >
                {devices.map(device => (
                    <Marker
                        key={device.deviceId}
                        ref={marker => {
                            if (marker)
                                markerDevices.current.set(marker, device);
                        }}
                        position={[
                            device.position.latitude,
                            device.position.longitude,
                        ]}
                        icon={markerIcon(
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
