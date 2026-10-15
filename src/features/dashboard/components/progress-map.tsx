'use client';

import 'leaflet/dist/leaflet.css';

import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import localGeography from '@/features/dashboard/data/progress-geography.json';
import {
    buildProgressMapNodes,
    progressMapDetailDistrictKeys,
    type ProgressMapNode,
} from '@/features/dashboard/utils/build-progress-map-nodes';
import { coverageLabelPoint } from '@/features/dashboard/utils/coverage-label-point';
import { createProgressPinchZoom } from '@/features/dashboard/utils/create-progress-pinch-zoom';
import {
    progressScanFillColor,
    PROGRESS_SCAN_FILL_OPACITY,
} from '@/features/dashboard/utils/progress-map-colors';
import { formatProgressLocations } from '@/features/dashboard/utils/format-progress-locations';
import {
    progressBoundaryAttribution,
    type ProgressBoundarySource,
} from '@/features/dashboard/utils/progress-boundary-attribution';
import {
    multiPolygonSchema,
    type MultiPolygon,
} from '@/features/dashboard/utils/match-coverage-boundaries';
import {
    matchProgressDistrictBoundaries,
    progressAreaBoundaries,
    progressMapPlacement,
    type ProgressAreaBoundary,
    type ProgressAreaFeatureCollection,
    type ProgressDistrictFill,
    type ProgressMapPlacement,
} from '@/features/dashboard/utils/match-progress-district-boundaries';
import {
    placeLabels,
    type LabelBox,
} from '@/features/dashboard/utils/place-labels';
import { placeDistrictNames } from '@/features/dashboard/utils/place-district-names';
import {
    placeCountryCards,
    type CountryCardPlacement,
} from '@/features/dashboard/utils/place-country-cards';
import {
    progressMapExtent,
    progressMapMinimumZoom,
    PROGRESS_MAP_MAX_ZOOM,
} from '@/features/dashboard/utils/progress-map-extent';
import type { FeatureCollection } from 'geojson';
import L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    GeoJSON,
    MapContainer,
    Marker,
    Pane,
    TileLayer,
    Tooltip,
    useMap,
    useMapEvents,
} from 'react-leaflet';
import type { UpcomingArea } from '@/features/dashboard/utils/build-upcoming-areas';
import { stephensiGlowDelay } from '@/features/dashboard/utils/stephensi-glow';
import styles from './progress-map.module.css';

const number = new Intl.NumberFormat('en');
const UGANDA_CENTER: L.LatLngTuple = [1.5, 32.3];
const TRACKPAD_PINCH_PIXELS_PER_ZOOM_LEVEL = 40 / 3;
// At or below this zoom the map groups Districts into countries.
const OVERVIEW_MAX_ZOOM = 7;
// Amber keeps planned places apart from the green scan scale.
// SVG strokes cannot read CSS variables; the light --progress-stephensi.
const STEPHENSI_STROKE = '#b5176f';

const UPCOMING_STYLE: L.PathOptions = {
    color: '#b36b00',
    weight: 1.5,
    opacity: 0.85,
    dashArray: '4 4',
    fillColor: '#e8a33d',
    fillOpacity: 0.1,
};

// Isolate the Leaflet 1.9 continuous-gesture methods used by its TouchZoom
// handler. Unlike setZoomAround, _move transforms layers without a full reset.
type ContinuousPinchMap = L.Map & {
    _stop: () => void;
    _moveStart: (zoomChanged: boolean, noMoveStart: boolean) => void;
    _move: (
        center: L.LatLng,
        zoom: number,
        options: { pinch: true; round: false },
    ) => void;
    _moveEnd: (zoomChanged: boolean) => void;
    _limitCenter: (
        center: L.LatLng,
        zoom: number,
        bounds: L.LatLngBounds | undefined,
    ) => L.LatLng;
    _animatingZoom?: boolean;
};

type CountryGeometry = { country: string; geometry: MultiPolygon };
const COUNTRY_GEOMETRIES: CountryGeometry[] = localGeography.outlines.map(
    country => ({
        country: country.country,
        geometry: multiPolygonSchema.parse(country.geometry),
    }),
);
const UGANDA_DISTRICTS = localGeography.districts as FeatureCollection;
const DISTRICT_BOUNDARIES = new Map<string, ProgressAreaBoundary[]>([
    [
        'Uganda',
        localGeography.districts.features.map(feature => ({
            name: feature.properties.name,
            geometry: multiPolygonSchema.parse(feature.geometry),
        })),
    ],
]);

type ReportingAreaFile = ProgressAreaFeatureCollection & {
    source: ProgressBoundarySource;
};
const AREA_LOADERS: Record<string, () => Promise<ReportingAreaFile>> = {
    Ghana: () =>
        import('@/features/dashboard/data/progress-areas-ghana.json').then(
            module => module.default,
        ),
    Kenya: () =>
        import('@/features/dashboard/data/progress-areas-kenya.json').then(
            module => module.default,
        ),
    Colombia: () =>
        import('@/features/dashboard/data/progress-areas-colombia.json').then(
            module => module.default,
        ),
    Cameroon: () =>
        import('@/features/dashboard/data/progress-areas-cameroon.json').then(
            module => module.default,
        ),
};
const AREA_CACHE = new Map<
    string,
    { boundaries: ProgressAreaBoundary[]; attribution: string }
>();

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);

function districtLabel(district: ProgressDistrict) {
    return `${district.name}, ${district.country}: ${number.format(district.uniqueScans)} scans. Active reporting coverage: ${formatProgressLocations(district.coverageByProgram, count => number.format(count))}`;
}

function districtStyle(
    district: ProgressDistrict,
    maximum: number,
    selected: boolean,
): L.PathOptions {
    return {
        className: styles.districtArea,
        color: selected ? '#075341' : '#168367',
        weight: selected ? 2.7 : 1.35,
        opacity: selected ? 1 : 0.9,
        fillColor: progressScanFillColor(district.uniqueScans, maximum),
        fillOpacity: PROGRESS_SCAN_FILL_OPACITY,
        bubblingMouseEvents: false,
    };
}

function markDistrictAccessibility(
    group: L.GeoJSON | null,
    district: ProgressDistrict,
    selected: boolean,
    interactive: boolean,
) {
    group?.eachLayer(layer => {
        if (!(layer instanceof L.Path)) return;
        const element = layer.getElement() as SVGElement | undefined;
        if (!element) return;
        if (!interactive) {
            element.setAttribute('aria-hidden', 'true');
            return;
        }
        element.setAttribute('role', 'button');
        element.setAttribute('tabindex', '0');
        element.setAttribute('aria-label', districtLabel(district));
        element.setAttribute('aria-pressed', String(selected));
        element.setAttribute('data-map-kind', 'district-area');
        element.setAttribute('data-map-country', district.country);
        element.setAttribute(
            'data-district-keys',
            JSON.stringify([district.key]),
        );
        element.onfocus = () => layer.openTooltip();
        element.onblur = () => {
            if (!selected) layer.closeTooltip();
        };
    });
}

/** Fill only named, reporting districts that have an actual local boundary. */
function ReportingDistrictAreas({
    fills,
    attributions,
    detailDistrictKeys,
    selectedKey,
    onSelect,
    hoveredKey,
    onHover,
    areaLayers,
    stephensi,
    stephensiKey,
}: {
    fills: ProgressDistrictFill[];
    attributions: ReadonlyMap<string, string>;
    detailDistrictKeys: ReadonlySet<string>;
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
    hoveredKey: string | null;
    onHover: (key: string | null) => void;
    areaLayers: Map<string, L.GeoJSON>;
    stephensi?: ReadonlyMap<string, number>;
    /** The area outlined in the stephensi colour: its dot hovered or its view open. */
    stephensiKey: string | null;
}) {
    const maximum = Math.max(
        1,
        ...fills.map(fill => fill.district.uniqueScans),
    );
    return (
        <Pane name="progressReportingDistricts" style={{ zIndex: 430 }}>
            {fills.map(({ district, geometry }) => {
                const selected = district.key === selectedKey;
                const interactive = detailDistrictKeys.has(district.key);
                const showSelection = selected && interactive;
                const baseStyle = districtStyle(district, maximum, selected);
                // The area, its name tag and its marker share one hover.
                const style =
                    district.key === stephensiKey
                        ? {
                              ...baseStyle,
                              color: STEPHENSI_STROKE,
                              weight: 3,
                              opacity: 1,
                          }
                        : district.key === hoveredKey && !selected
                          ? {
                                ...baseStyle,
                                color: '#063b30',
                                weight: 2.6,
                                opacity: 1,
                            }
                          : baseStyle;
                const stephensiCount = stephensi?.get(district.key);
                const activate = () => onSelect(selected ? null : district.key);
                return (
                    <GeoJSON
                        key={`${district.key}:${interactive ? 'detail' : 'overview'}`}
                        data={geometry}
                        interactive={interactive}
                        attribution={attributions.get(district.country)}
                        ref={group => {
                            if (group) areaLayers.set(district.key, group);
                            else areaLayers.delete(district.key);
                            markDistrictAccessibility(
                                group,
                                district,
                                selected,
                                interactive,
                            );
                        }}
                        style={style}
                        bubblingMouseEvents={false}
                        eventHandlers={
                            interactive
                                ? {
                                      add: event =>
                                          markDistrictAccessibility(
                                              event.target as L.GeoJSON,
                                              district,
                                              selected,
                                              interactive,
                                          ),
                                      click: activate,
                                      keydown: event => {
                                          const original =
                                              event.originalEvent as KeyboardEvent;
                                          if (
                                              original.key !== 'Enter' &&
                                              original.key !== ' '
                                          )
                                              return;
                                          original.preventDefault();
                                          original.stopPropagation();
                                          if (!original.repeat) activate();
                                      },
                                      mouseover: () => onHover(district.key),
                                      mouseout: () => onHover(null),
                                  }
                                : undefined
                        }
                    >
                        {interactive && (
                            <Tooltip
                                key={`${district.key}:${showSelection}`}
                                pane="tooltipPane"
                                permanent={showSelection}
                                direction="top"
                                className={styles.tooltip}
                                opacity={1}
                            >
                                <div className={styles.tooltipContent}>
                                    <span className={styles.tooltipName}>
                                        {district.name}
                                    </span>
                                    <span className={styles.tooltipScans}>
                                        {number.format(district.uniqueScans)}{' '}
                                        scans
                                    </span>
                                    <span className={styles.tooltipLocations}>
                                        {formatProgressLocations(
                                            district.coverageByProgram,
                                            count => number.format(count),
                                        )}
                                    </span>
                                    {stephensiCount !== undefined && (
                                        <span
                                            className={styles.tooltipStephensi}
                                        >
                                            {number.format(stephensiCount)}{' '}
                                            <i>An. stephensi</i>
                                        </span>
                                    )}
                                </div>
                            </Tooltip>
                        )}
                    </GeoJSON>
                );
            })}
        </Pane>
    );
}

function markAccessibility(
    marker: L.Marker | null,
    label: string,
    selected: boolean,
    node: ProgressMapNode,
) {
    const element = marker?.getElement();
    element?.setAttribute('aria-label', label);
    element?.setAttribute('aria-pressed', String(selected));
    element?.setAttribute('title', label);
    element?.setAttribute('data-map-kind', node.kind);
    element?.setAttribute('data-map-country', node.country);
    element?.setAttribute(
        'data-district-keys',
        JSON.stringify(node.districtKeys),
    );
}

/** Soft, bounded halos emphasize volume at known reporting positions only. */
function glowDiameter(node: ProgressMapNode, maximum: number) {
    if (node.uniqueScans === 0) return 0;
    return 24 + 20 * Math.sqrt(node.uniqueScans / maximum);
}

function markerLayout(
    node: ProgressMapNode,
    width: number,
    placement?: CountryCardPlacement,
) {
    if (node.kind !== 'country')
        return {
            width: 32,
            height: 32,
            anchorX: 16,
            anchorY: 16,
            left: false,
            cardY: 0,
        };
    const cardWidth =
        placement?.cardWidth ?? Math.max(110, node.country.length * 8.5 + 24);
    const left = placement
        ? placement.side === 'left'
        : node.projected.x + cardWidth + 32 > width - 16;
    const offsetY = placement?.offsetY ?? 0;
    return {
        width: cardWidth + 36,
        height: 48 + Math.abs(offsetY),
        anchorX: left ? cardWidth + 18 : 18,
        anchorY: 24 + Math.max(0, -offsetY),
        cardY: Math.max(0, offsetY),
        left,
    };
}

function activityIcon(
    node: ProgressMapNode,
    maximum: number,
    selected: boolean,
    width: number,
    placement?: CountryCardPlacement,
) {
    const layout = markerLayout(node, width, placement);
    const glow = glowDiameter(node, maximum);
    const intensity = 0.5 + 0.5 * Math.sqrt(node.uniqueScans / maximum);
    const core =
        node.kind === 'cluster'
            ? `<span class="${styles.clusterCore}">${node.sourceDistricts.length}</span>`
            : `<span class="${styles.core}"></span>`;
    const leader =
        node.kind === 'country' && placement?.offsetY
            ? `<svg class="${styles.cardLeader}" width="${layout.width}" height="${layout.height}" aria-hidden="true"><line x1="${layout.anchorX}" y1="${layout.anchorY}" x2="${layout.left ? layout.width - 36 : 36}" y2="${layout.cardY + 24}" /></svg>`
            : '';
    return L.divIcon({
        className: styles.mark,
        iconSize: [layout.width, layout.height],
        iconAnchor: [layout.anchorX, layout.anchorY],
        html: `${leader}<span class="${styles.activitySpot}" style="left:${layout.anchorX}px;top:${layout.anchorY}px" data-selected="${selected}" data-empty="${node.uniqueScans === 0}"><span class="${styles.glow}" style="width:${glow}px;height:${glow}px;opacity:${intensity}"></span>${core}</span>${node.kind === 'country' ? `<span class="${styles.countryCard}" data-country-card data-side="${layout.left ? 'left' : 'right'}" style="top:${layout.cardY}px"><strong>${escapeHtml(node.country)}</strong><span>Explore areas <span aria-hidden="true">↗</span></span></span>` : ''}`,
    });
}

function useViewport() {
    const map = useMap();
    const read = useCallback(
        () => ({
            zoom: map.getZoom(),
            width: map.getSize().x,
            height: map.getSize().y,
            center: map.getCenter(),
        }),
        [map],
    );
    const [viewport, setViewport] = useState(read);
    const update = useCallback(() => setViewport(read()), [read]);
    // Keep listeners attached while new data causes the footprint to refit.
    // Synchronize once after mount, when the initial fit can precede listeners.
    useMapEvents(
        useMemo(
            () => ({ zoomend: update, moveend: update, resize: update }),
            [update],
        ),
    );
    useEffect(() => {
        const frame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frame);
    }, [update]);
    return viewport;
}

/** Neutral local geography still draws when external tiles are unavailable. */
function GeographicContext({ countries }: { countries: CountryGeometry[] }) {
    const { zoom } = useViewport();
    return (
        <>
            <Pane
                name="progressCountryContext"
                style={{ zIndex: 390, pointerEvents: 'none' }}
            >
                {countries.map(country => (
                    <GeoJSON
                        key={country.country}
                        data={country.geometry}
                        interactive={false}
                        style={{
                            color: '#8ea99e',
                            weight: 1,
                            opacity: 0.65,
                            fillColor: '#d4e8dc',
                            fillOpacity: 0.2,
                        }}
                    />
                ))}
            </Pane>
            {zoom >= 6.5 &&
                countries.some(country => country.country === 'Uganda') && (
                    <Pane
                        name="progressDistrictContext"
                        style={{ zIndex: 400, pointerEvents: 'none' }}
                    >
                        <GeoJSON
                            data={UGANDA_DISTRICTS}
                            interactive={false}
                            style={{
                                color: '#bdcbc4',
                                weight: 0.5,
                                opacity: 0.32,
                                fill: false,
                            }}
                        />
                    </Pane>
                )}
        </>
    );
}

/** Workbook places Targeted for VectorCam; ReportingActivity places their tags. */
function UpcomingAreas({
    areas,
    areaLayers,
}: {
    areas: UpcomingArea[];
    areaLayers: Map<string, L.GeoJSON>;
}) {
    return (
        <>
            {/* Above the reporting areas (430), which an upcoming place never
                overlaps, so their layer cannot catch its hover. */}
            <Pane name="progressUpcomingAreas" style={{ zIndex: 435 }}>
                {areas.map(area => (
                    <GeoJSON
                        key={area.key}
                        data={area.geometry}
                        style={UPCOMING_STYLE}
                        ref={group => {
                            if (group) areaLayers.set(area.key, group);
                            else areaLayers.delete(area.key);
                        }}
                    >
                        {/* Overlays inherit their parent's pane otherwise. */}
                        <Tooltip
                            pane="tooltipPane"
                            direction="top"
                            // Clears the area's name tag, centred on the same point.
                            offset={[0, -16]}
                            className={`${styles.tooltip} ${styles.upcomingTooltip}`}
                            opacity={1}
                        >
                            <div className={styles.tooltipContent}>
                                <span className={styles.tooltipName}>
                                    {area.name}
                                </span>
                                <span className={styles.upcomingStatus}>
                                    Targeted for future VectorCam usage
                                </span>
                            </div>
                        </Tooltip>
                    </GeoJSON>
                ))}
            </Pane>
        </>
    );
}

/** On each District with An. stephensi, this dot replaces its scan marker. */
function StephensiSpots({
    districts,
    counts,
    selectedKey,
    onSelect,
    onHover,
}: {
    districts: ProgressDistrict[];
    counts: ReadonlyMap<string, number>;
    selectedKey: string | null;
    onSelect: (key: string) => void;
    onHover: (key: string | null) => void;
}) {
    // Smaller at overview scale, where a country is only a few dots wide.
    const compact = useViewport().zoom <= OVERVIEW_MAX_ZOOM;
    return (
        <Pane name="progressStephensi" style={{ zIndex: 650 }}>
            {districts.flatMap(district => {
                const specimens = counts.get(district.key);
                if (!specimens || !district.position) return [];
                const selected = district.key === selectedKey;
                const label = `${districtLabel(district)}. ${number.format(specimens)} An. stephensi`;
                const mark = (marker: L.Marker | null) => {
                    const element = marker?.getElement();
                    element?.setAttribute('aria-label', label);
                    element?.setAttribute('aria-pressed', String(selected));
                };
                return [
                    <Marker
                        key={district.key}
                        ref={mark}
                        pane="progressStephensi"
                        position={[
                            district.position.latitude,
                            district.position.longitude,
                        ]}
                        icon={L.divIcon({
                            className: styles.stephensiIcon,
                            iconSize: compact ? [32, 32] : [56, 56],
                            tooltipAnchor: [0, compact ? -6 : -10],
                            html: `<span class="${styles.stephensiGlow}" style="animation-delay:${stephensiGlowDelay()}"></span><span class="${styles.stephensiDot}" data-selected="${selected}" data-compact="${compact}"></span>`,
                        })}
                        keyboard
                        bubblingMouseEvents={false}
                        eventHandlers={{
                            add: event => mark(event.target as L.Marker),
                            click: () => onSelect(district.key),
                            mouseover: () => onHover(district.key),
                            mouseout: () => onHover(null),
                            // One tooltip at a time, even over a selected area's pinned one.
                            tooltipopen: event =>
                                (event.target as L.Marker)
                                    .getElement()
                                    ?.closest('.leaflet-container')
                                    ?.setAttribute(
                                        'data-stephensi-tooltip',
                                        '',
                                    ),
                            tooltipclose: event =>
                                (event.target as L.Marker)
                                    .getElement()
                                    ?.closest('.leaflet-container')
                                    ?.removeAttribute('data-stephensi-tooltip'),
                        }}
                    >
                        <Tooltip
                            pane="tooltipPane"
                            direction="top"
                            className={`${styles.tooltip} ${styles.stephensiTooltip}`}
                            opacity={1}
                        >
                            <div className={styles.tooltipContent}>
                                <span className={styles.tooltipName}>
                                    {district.name}
                                </span>
                                <span className={styles.tooltipScans}>
                                    {number.format(district.uniqueScans)} scans
                                </span>
                                <span className={styles.tooltipLocations}>
                                    {formatProgressLocations(
                                        district.coverageByProgram,
                                        count => number.format(count),
                                    )}
                                </span>
                                <span className={styles.tooltipStephensi}>
                                    {number.format(specimens)}{' '}
                                    <i>An. stephensi</i>
                                </span>
                                {!selected && (
                                    <span className={styles.tooltipHint}>
                                        Select to see its <i>An. stephensi</i>
                                    </span>
                                )}
                            </div>
                        </Tooltip>
                    </Marker>,
                ];
            })}
        </Pane>
    );
}

/** Group at overview scale, then reveal districts without colliding markers. */
function ReportingActivity({
    districts,
    countries,
    fills,
    attributions,
    selectedKey,
    onSelect,
    upcoming,
    upcomingLayers,
    stephensi,
    stephensiKey,
}: {
    districts: ProgressDistrict[];
    countries: CountryGeometry[];
    fills: ProgressDistrictFill[];
    attributions: ReadonlyMap<string, string>;
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
    upcoming: UpcomingArea[];
    upcomingLayers: Map<string, L.GeoJSON>;
    stephensi?: ReadonlyMap<string, number>;
    stephensiKey: string | null;
}) {
    const map = useMap();
    const viewport = useViewport();
    // Re-read on each viewport update (moveend, zoomend, resize).
    const leaderOrigin = map.containerPointToLayerPoint([0, 0]);
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    // Filled by the area refs; read only in event handlers.
    const [areaLayers] = useState(() => new Map<string, L.GeoJSON>());
    const allNodes = useMemo(
        () =>
            buildProgressMapNodes({
                districts,
                zoom: viewport.zoom,
                project: position =>
                    map.latLngToContainerPoint([
                        position.latitude,
                        position.longitude,
                    ]),
                overviewZoom: 6,
                overviewMaxZoom: OVERVIEW_MAX_ZOOM,
                overviewFootprint: viewport.width < 520 ? 135 : 190,
                clusterDistance: 44,
            }),
        [districts, map, viewport],
    );
    const detailDistrictKeys = useMemo(
        () => progressMapDetailDistrictKeys(allNodes),
        [allNodes],
    );
    const filledKeys = useMemo(
        () => new Set(fills.map(fill => fill.district.key)),
        [fills],
    );
    const fillBounds = useMemo(
        () =>
            new Map(
                fills.map(fill => [
                    fill.district.key,
                    L.latLngBounds(
                        fill.geometry.coordinates.flatMap(polygon =>
                            polygon.flatMap(ring =>
                                ring.map(
                                    ([longitude, latitude]) =>
                                        [latitude, longitude] as L.LatLngTuple,
                                ),
                            ),
                        ),
                    ),
                ]),
            ),
        [fills],
    );
    const nodes = useMemo(() => {
        const overview = allNodes.filter(node => node.kind === 'country');
        const overviewKeys = new Set(
            overview.flatMap(node => node.districtKeys),
        );
        return [
            ...overview,
            ...buildProgressMapNodes({
                districts: districts.filter(
                    district =>
                        !filledKeys.has(district.key) &&
                        !overviewKeys.has(district.key),
                ),
                zoom: viewport.zoom,
                project: position =>
                    map.latLngToContainerPoint([
                        position.latitude,
                        position.longitude,
                    ]),
                overviewZoom: 0,
                overviewMaxZoom: 0,
                clusterDistance: 44,
            }),
        ];
    }, [allNodes, districts, filledKeys, viewport, map]);
    const maximum = Math.max(1, ...nodes.map(node => node.uniqueScans));
    const selectedDistrict = districts.find(row => row.key === selectedKey);
    const cards = useMemo(
        () =>
            placeCountryCards(
                nodes
                    .filter(node => node.kind === 'country')
                    .map(node => ({
                        key: node.key,
                        country: node.country,
                        ...node.projected,
                    })),
                { width: viewport.width, height: viewport.height },
                [
                    {
                        key: 'zoom-control',
                        x: 38,
                        y: 57,
                        width: 50,
                        height: 86,
                    },
                    ...nodes
                        .filter(node => node.kind !== 'country')
                        .map(node => ({
                            key: node.key,
                            ...node.projected,
                            width: 32,
                            height: 32,
                        })),
                ],
            ),
        [nodes, viewport.width, viewport.height],
    );

    function explore(node: ProgressMapNode) {
        const points = node.sourceDistricts.map(
            district =>
                [
                    district.position!.latitude,
                    district.position!.longitude,
                ] as L.LatLngTuple,
        );
        map.fitBounds(points, {
            padding: viewport.width < 520 ? [42, 64] : [76, 72],
            maxZoom: Math.min(12, Math.max(8, map.getZoom() + 1.5)),
            animate: false,
        });
    }

    // A district chosen beside the chart must also become discoverable on the
    // map. Ordinary pan/zoom never re-applies this focus or changes the filter.
    const focusedKey = useRef<string | null>(null);
    useEffect(() => {
        if (!selectedKey) {
            focusedKey.current = null;
            return;
        }
        const fill = fills.find(row => row.district.key === selectedKey);
        const node = nodes.find(row => row.districtKeys.includes(selectedKey));
        if (!fill && !node) return;
        // A pending country chunk must not consume the selected key. A point
        // becoming an area gets one deliberate focus when its boundary arrives.
        const focusKey = `${selectedKey}:${fill ? 'area' : 'point'}`;
        if (focusedKey.current === focusKey) return;
        focusedKey.current = focusKey;
        if (fill) {
            const bounds = L.geoJSON(fill.geometry).getBounds();
            map.fitBounds(bounds, {
                padding: viewport.width < 520 ? [38, 72] : [72, 72],
                maxZoom: 9,
                animate: false,
            });
            return;
        }
        if (!node) return;
        if (node.kind !== 'district') {
            const selectedPoint = node.sourceDistricts.find(
                district => district.key === selectedKey,
            )?.position;
            if (
                selectedPoint &&
                map
                    .getBounds()
                    .pad(-0.2)
                    .contains(
                        L.latLng(
                            selectedPoint.latitude,
                            selectedPoint.longitude,
                        ),
                    )
            )
                return;
            const points = node.sourceDistricts.map(
                district =>
                    [
                        district.position!.latitude,
                        district.position!.longitude,
                    ] as L.LatLngTuple,
            );
            map.fitBounds(points, {
                padding: viewport.width < 520 ? [42, 88] : [76, 88],
                maxZoom: Math.min(12, Math.max(8, map.getZoom() + 1.5)),
                animate: false,
            });
        } else {
            const point = L.latLng(
                node.position.latitude,
                node.position.longitude,
            );
            if (!map.getBounds().pad(-0.2).contains(point))
                map.panTo(point, { animate: false });
        }
    }, [selectedKey, nodes, fills, map, viewport.width]);

    const labels = useMemo(() => {
        const onScreen = (box: LabelBox) =>
            box.x - box.width / 2 >= 12 &&
            box.x + box.width / 2 <= viewport.width - 12 &&
            box.y - box.height / 2 >= 12 &&
            box.y + box.height / 2 <= viewport.height - 24;
        const obstacles: LabelBox[] = nodes.flatMap(node => {
            const layout = markerLayout(
                node,
                viewport.width,
                cards.get(node.key),
            );
            const anchor = {
                key: node.key,
                x: node.projected.x,
                y: node.projected.y,
                width: 32,
                height: 32,
            };
            return node.kind === 'country'
                ? [
                      anchor,
                      {
                          key: `card:${node.key}`,
                          x:
                              node.projected.x -
                              layout.anchorX +
                              (layout.left ? 0 : 36) +
                              (layout.width - 36) / 2,
                          y:
                              node.projected.y -
                              layout.anchorY +
                              layout.cardY +
                              24,
                          width: layout.width - 36,
                          height: 48,
                      },
                  ]
                : [anchor];
        });
        obstacles.push({
            key: 'zoom-control',
            x: 38,
            y: 57,
            width: 50,
            height: 86,
        });
        const selectedNode = allNodes.find(node =>
            node.districtKeys.includes(selectedKey ?? ''),
        );
        const selectedFill = fills.find(
            fill => fill.district.key === selectedKey,
        );
        const selectedAt = selectedFill
            ? coverageLabelPoint(selectedFill.geometry)?.at
            : null;
        const selectedProjection = selectedAt
            ? map.latLngToContainerPoint(selectedAt)
            : selectedNode?.projected;
        if (selectedProjection && detailDistrictKeys.has(selectedKey ?? ''))
            obstacles.push({
                key: 'selection-tooltip',
                x: selectedProjection.x,
                y: selectedProjection.y - 66,
                width: Math.max(
                    184,
                    (selectedDistrict?.name.length ?? 0) * 7 + 30,
                ),
                height: 100,
            });
        const countryLabels = countries.flatMap(country => {
            if (
                nodes.some(
                    node =>
                        node.country === country.country &&
                        node.kind === 'country',
                )
            )
                return [];
            const point = coverageLabelPoint(country.geometry);
            if (!point) return [];
            const projected = map.latLngToContainerPoint(point.at);
            const box = {
                key: `label:${country.country}`,
                x: projected.x,
                y: projected.y,
                width: country.country.length * 9 + 12,
                height: 20,
            };
            return onScreen(box) && placeLabels([box], obstacles).has(box.key)
                ? [{ country: country.country, position: point.at, box }]
                : [];
        });
        obstacles.push(...countryLabels.map(label => label.box));
        // Country summaries and granular area names share one visibility rule.
        // Partly visible shapes may place a name inside the edge; places wholly
        // outside the viewport must not appear as misleading edge labels.
        const visibleBounds = map.getBounds();
        const ordered = districts
            .filter(district => detailDistrictKeys.has(district.key))
            .flatMap(district => {
                const fill = fills.find(
                    row => row.district.key === district.key,
                );
                const boundary = fillBounds.get(district.key);
                if (boundary && !visibleBounds.intersects(boundary)) return [];
                const at = fill ? coverageLabelPoint(fill.geometry)?.at : null;
                const position =
                    at ??
                    (district.position
                        ? ([
                              district.position.latitude,
                              district.position.longitude,
                          ] as L.LatLngTuple)
                        : null);
                return position && (fill || visibleBounds.contains(position))
                    ? [
                          {
                              district,
                              filled: Boolean(fill),
                              projected: map.latLngToContainerPoint(position),
                          },
                      ]
                    : [];
            })
            .toSorted(
                (a, b) =>
                    Number(b.district.key === selectedKey) -
                        Number(a.district.key === selectedKey) ||
                    a.projected.y - b.projected.y ||
                    a.projected.x - b.projected.x ||
                    a.district.key.localeCompare(b.district.key),
            );
        const fontSize = window.matchMedia('(max-width: 640px)').matches
            ? 11
            : 12;
        const textContext = document.createElement('canvas').getContext('2d');
        if (textContext) {
            const fontFamily = window.getComputedStyle(
                map.getContainer(),
            ).fontFamily;
            textContext.font = `800 ${fontSize}px ${fontFamily}`;
        }
        // Size collision boxes to the actual bold text plus padding and border.
        const textWidths = new Map(
            ordered.map(label => [
                label.district.key,
                Math.ceil(
                    textContext?.measureText(label.district.name).width ??
                        label.district.name.length * fontSize * 0.75,
                ) + 22,
            ]),
        );
        const placements = placeDistrictNames(
            ordered.map(label => ({
                key: label.district.key,
                x: label.projected.x,
                y: label.projected.y + (label.filled ? 0 : 24),
                width: textWidths.get(label.district.key)!,
                height: 24,
            })),
            viewport,
            obstacles,
        );
        // Upcoming tags move around the reporting names, never the reverse.
        const upcomingOrdered =
            viewport.zoom > OVERVIEW_MAX_ZOOM
                ? upcoming.flatMap(area => {
                      const at = coverageLabelPoint(area.geometry)?.at;
                      return at && visibleBounds.contains(at)
                          ? [
                                {
                                    area,
                                    projected: map.latLngToContainerPoint(at),
                                },
                            ]
                          : [];
                  })
                : [];
        const upcomingPlacements = placeDistrictNames(
            upcomingOrdered.map(label => ({
                key: label.area.key,
                x: label.projected.x,
                y: label.projected.y,
                // Sized like a District name: bold text plus padding and border.
                width:
                    Math.ceil(
                        textContext?.measureText(label.area.name).width ??
                            label.area.name.length * fontSize * 0.75,
                    ) + 22,
                height: 24,
            })),
            viewport,
            [...obstacles, ...placements.values()],
        );
        return {
            countries: countryLabels,
            upcoming: upcomingOrdered.map(label => {
                const box = upcomingPlacements.get(label.area.key)!;
                return {
                    ...label,
                    box,
                    fontSize,
                    position: map.containerPointToLatLng([box.x, box.y]),
                    leader: leaderEnd(box, label.projected),
                };
            }),
            districts: ordered.map(label => {
                const box = placements.get(label.district.key)!;
                return {
                    ...label,
                    box,
                    // Exceptionally long names stay complete on one line.
                    fontSize:
                        fontSize *
                        Math.min(
                            1,
                            Math.max(1, box.width - 22) /
                                Math.max(
                                    1,
                                    textWidths.get(label.district.key)! - 22,
                                ),
                        ),
                    position: map.containerPointToLatLng([box.x, box.y]),
                    leader: leaderEnd(box, label.projected),
                };
            }),
        };
    }, [
        nodes,
        allNodes,
        detailDistrictKeys,
        districts,
        fills,
        fillBounds,
        countries,
        selectedKey,
        selectedDistrict,
        viewport,
        cards,
        map,
        upcoming,
    ]);

    return (
        <>
            <ReportingDistrictAreas
                fills={fills}
                attributions={attributions}
                detailDistrictKeys={detailDistrictKeys}
                selectedKey={selectedKey}
                onSelect={onSelect}
                hoveredKey={hoveredKey}
                onHover={setHoveredKey}
                areaLayers={areaLayers}
                stephensi={stephensi}
                stephensiKey={stephensiKey}
            />
            {nodes.map(node => {
                const selected = node.districtKeys.includes(selectedKey ?? '');
                const district = node.sourceDistricts[0];
                // Its stephensi dot stands in for it.
                if (node.kind === 'district' && stephensi?.has(district.key))
                    return null;
                const zoomLabel = `Zoom to ${node.kind === 'country' ? node.country : `${node.sourceDistricts.length} nearby`} reporting areas.`;
                const label =
                    node.kind === 'district'
                        ? districtLabel(district)
                        : node.kind !== 'country' &&
                            selected &&
                            selectedDistrict
                          ? `${districtLabel(selectedDistrict)}. ${zoomLabel}`
                          : `${zoomLabel} ${number.format(node.uniqueScans)} mapped scans. Active reporting coverage: ${formatProgressLocations(node.coverageByProgram, count => number.format(count))}.`;
                const activate = () => {
                    if (node.kind === 'district')
                        onSelect(selected ? null : district.key);
                    else explore(node);
                };
                const shown =
                    node.kind === 'country'
                        ? node
                        : selected && selectedDistrict
                          ? selectedDistrict
                          : node.kind === 'district'
                            ? district
                            : node;
                // A country or cluster adds up the Districts it stands for.
                const stephensiTotal = (
                    'name' in shown ? [shown.key] : node.districtKeys
                ).reduce((sum, key) => sum + (stephensi?.get(key) ?? 0), 0);
                return (
                    <Marker
                        key={node.key}
                        ref={marker =>
                            markAccessibility(marker, label, selected, node)
                        }
                        position={[
                            node.position.latitude,
                            node.position.longitude,
                        ]}
                        icon={activityIcon(
                            node,
                            maximum,
                            selected,
                            viewport.width,
                            cards.get(node.key),
                        )}
                        title={label}
                        keyboard
                        bubblingMouseEvents={false}
                        zIndexOffset={
                            selected ? 1000 : node.kind === 'country' ? 100 : 0
                        }
                        eventHandlers={{
                            add: event =>
                                markAccessibility(
                                    event.target as L.Marker,
                                    label,
                                    selected,
                                    node,
                                ),
                            click: activate,
                            mouseover: () => {
                                if (node.kind === 'district')
                                    setHoveredKey(district.key);
                            },
                            mouseout: () => {
                                if (node.kind === 'district')
                                    setHoveredKey(null);
                            },
                            keydown: event => {
                                const original =
                                    event.originalEvent as KeyboardEvent;
                                if (
                                    original.key !== ' ' &&
                                    original.key !== 'Enter'
                                )
                                    return;
                                original.preventDefault();
                                original.stopPropagation();
                                if (!original.repeat) activate();
                            },
                        }}
                    >
                        <Tooltip
                            key={`${node.key}:${selectedKey}`}
                            permanent={
                                node.kind !== 'country' &&
                                selected &&
                                !filledKeys.has(selectedKey ?? '')
                            }
                            direction="top"
                            offset={[0, -24]}
                            className={styles.tooltip}
                            opacity={1}
                        >
                            <div className={styles.tooltipContent}>
                                <span className={styles.tooltipName}>
                                    {'name' in shown
                                        ? shown.name
                                        : node.kind === 'country'
                                          ? node.country
                                          : `${node.sourceDistricts.length} nearby areas`}
                                </span>
                                <span className={styles.tooltipScans}>
                                    {number.format(shown.uniqueScans)} scans
                                </span>
                                <span className={styles.tooltipLocations}>
                                    {formatProgressLocations(
                                        shown.coverageByProgram,
                                        count => number.format(count),
                                    )}
                                </span>
                                {stephensiTotal > 0 && (
                                    <span className={styles.tooltipStephensi}>
                                        {number.format(stephensiTotal)}{' '}
                                        <i>An. stephensi</i>
                                    </span>
                                )}
                                {node.kind !== 'district' &&
                                    (node.kind === 'country' || !selected) && (
                                        <span className={styles.tooltipHint}>
                                            Mapped reporting areas · Select to
                                            zoom in
                                        </span>
                                    )}
                            </div>
                        </Tooltip>
                    </Marker>
                );
            })}
            <Pane
                name="progressCountryLabels"
                style={{ zIndex: 450, pointerEvents: 'none' }}
            >
                {labels.countries.map(label => (
                    <Marker
                        key={label.country}
                        position={label.position}
                        icon={L.divIcon({
                            className: styles.countryLabel,
                            iconSize: [0, 0],
                            html: `<span data-map-label="country">${escapeHtml(label.country)}</span>`,
                        })}
                        interactive={false}
                        keyboard={false}
                    />
                ))}
            </Pane>
            {/* Inside the map pane, so tooltips (650) stay above the lines. */}
            <Pane
                name="progressLabelLeaders"
                style={{ zIndex: 625, pointerEvents: 'none' }}
            >
                <svg
                    className={styles.labelLeaders}
                    // Leader points are container points; offset to layer space.
                    style={{
                        transform: `translate(${leaderOrigin.x}px, ${leaderOrigin.y}px)`,
                    }}
                    width={viewport.width}
                    height={viewport.height}
                    viewBox={`0 0 ${viewport.width} ${viewport.height}`}
                    aria-hidden="true"
                    focusable="false"
                >
                    {labels.districts.map(label =>
                        label.leader ? (
                            <g
                                key={label.district.key}
                                data-hovered={label.district.key === hoveredKey}
                            >
                                <line
                                    x1={label.projected.x}
                                    y1={label.projected.y}
                                    x2={label.leader.x}
                                    y2={label.leader.y}
                                />
                                {/* The dot marks the area; the name sits at the other end. */}
                                <circle
                                    cx={label.projected.x}
                                    cy={label.projected.y}
                                    r={2.5}
                                />
                            </g>
                        ) : null,
                    )}
                    {labels.upcoming.map(label =>
                        label.leader ? (
                            <g key={label.area.key} data-upcoming="true">
                                <line
                                    x1={label.projected.x}
                                    y1={label.projected.y}
                                    x2={label.leader.x}
                                    y2={label.leader.y}
                                />
                                <circle
                                    cx={label.projected.x}
                                    cy={label.projected.y}
                                    r={2.5}
                                />
                            </g>
                        ) : null,
                    )}
                </svg>
            </Pane>
            <Pane
                name="progressDistrictLabels"
                style={{ zIndex: 630, pointerEvents: 'none' }}
            >
                {labels.districts.map(label => (
                    <Marker
                        key={label.district.key}
                        position={label.position}
                        icon={L.divIcon({
                            className: styles.districtLabel,
                            iconSize: [0, 0],
                            html: `<span data-map-label="district" data-district-key="${escapeHtml(label.district.key)}" data-filled="${label.filled}" data-displaced="${Boolean(label.leader)}" data-selected="${label.district.key === selectedKey}" data-hovered="${label.district.key === hoveredKey}" style="width:${label.box.width}px;min-height:${label.box.height}px;font-size:${label.fontSize}px">${escapeHtml(label.district.name)}</span>`,
                        })}
                        // Same toggle as the area; the area keeps keyboard focus.
                        keyboard={false}
                        bubblingMouseEvents={false}
                        eventHandlers={{
                            click: () =>
                                onSelect(
                                    label.district.key === selectedKey
                                        ? null
                                        : label.district.key,
                                ),
                            mouseover: () => {
                                setHoveredKey(label.district.key);
                                areaLayers
                                    .get(label.district.key)
                                    ?.openTooltip();
                            },
                            mouseout: () => {
                                setHoveredKey(null);
                                // A selected area's tooltip is permanent.
                                if (label.district.key !== selectedKey)
                                    areaLayers
                                        .get(label.district.key)
                                        ?.closeTooltip();
                            },
                        }}
                    />
                ))}
            </Pane>
            <Pane
                name="progressUpcomingTags"
                style={{ zIndex: 628, pointerEvents: 'none' }}
            >
                {labels.upcoming.map(label => (
                    <Marker
                        key={label.area.key}
                        position={label.position}
                        icon={L.divIcon({
                            className: `${styles.districtLabel} ${styles.upcomingTag}`,
                            iconSize: [0, 0],
                            html: `<span data-displaced="${Boolean(label.leader)}" style="width:${label.box.width}px;min-height:${label.box.height}px;font-size:${label.fontSize}px">${escapeHtml(label.area.name)}</span>`,
                        })}
                        // The tag opens its area's tooltip; it selects nothing.
                        keyboard={false}
                        eventHandlers={{
                            mouseover: () =>
                                upcomingLayers
                                    .get(label.area.key)
                                    ?.openTooltip(),
                            mouseout: () =>
                                upcomingLayers
                                    .get(label.area.key)
                                    ?.closeTooltip(),
                        }}
                    />
                ))}
            </Pane>
        </>
    );
}

/** The mainland defines context; islands never pull the view from reporting. */
function countryFrame(country: CountryGeometry): L.LatLngTuple[] {
    let largest: MultiPolygon['coordinates'][number] | null = null;
    let area = -1;
    for (const polygon of country.geometry.coordinates) {
        const label = coverageLabelPoint({
            type: 'MultiPolygon',
            coordinates: [polygon],
        });
        if (label && label.area > area) {
            largest = polygon;
            area = label.area;
        }
    }
    return largest
        ? largest[0].map(([longitude, latitude]) => [latitude, longitude])
        : [];
}

/** Keep navigation near the displayed geography without refitting on pan/zoom. */
function ReportingNavigation({
    districts,
    countries,
}: {
    districts: ProgressDistrict[];
    countries: CountryGeometry[];
}) {
    const map = useMap();
    const extent = useMemo(
        () =>
            progressMapExtent([
                ...countries
                    .flatMap(countryFrame)
                    .map(([latitude, longitude]) => ({ latitude, longitude })),
                ...districts.flatMap(district =>
                    district.position ? [district.position] : [],
                ),
            ]),
        [districts, countries],
    );
    const applied = useRef<string | null>(null);
    useEffect(() => {
        if (!extent) return;
        const bounds = L.latLngBounds(
            [extent.south, extent.west],
            [extent.north, extent.east],
        );
        function updateLimits() {
            const size = map.getSize();
            if (size.x <= 0 || size.y <= 0) return;
            const key = `${extent!.south}:${extent!.west}:${extent!.north}:${extent!.east}:${size.x}:${size.y}`;
            if (applied.current === key) return;
            applied.current = key;
            map.setMaxBounds(bounds);
            map.setMinZoom(
                progressMapMinimumZoom(extent!, {
                    width: size.x,
                    height: size.y,
                }),
            );
        }
        updateLimits();
        map.on('resize', updateLimits);
        return () => {
            map.off('resize', updateLimits);
        };
    }, [extent, map]);

    useEffect(() => {
        const container = map.getContainer();
        const continuousMap = map as ContinuousPinchMap;
        let applying = false;
        const apply = (callback: () => void) => {
            applying = true;
            try {
                callback();
            } finally {
                applying = false;
            }
        };
        const gesture = createProgressPinchZoom<L.Point>({
            getZoom: () => map.getZoom(),
            getMinZoom: () => map.getMinZoom(),
            getMaxZoom: () => map.getMaxZoom(),
            start: () =>
                apply(() => {
                    continuousMap._stop();
                    continuousMap._moveStart(true, false);
                }),
            move: (zoom, anchor) =>
                apply(() => {
                    const half = map.getSize().divideBy(2);
                    const offset = anchor
                        .subtract(half)
                        .multiplyBy(1 - 1 / map.getZoomScale(zoom));
                    const center = map.containerPointToLatLng(half.add(offset));
                    const bounded = continuousMap._limitCenter(
                        center,
                        zoom,
                        map.options.maxBounds as L.LatLngBounds | undefined,
                    );
                    continuousMap._move(bounded, zoom, {
                        pinch: true,
                        round: false,
                    });
                }),
            finish: () =>
                apply(() => {
                    // Release deferred tile updates and redraw paths/labels once.
                    map.fire('zoom');
                    continuousMap._moveEnd(true);
                }),
        });
        const resetGesture = () => {
            if (!applying) gesture.cancel(true);
        };
        const markZooming = () => {
            container.dataset.mapZooming = 'true';
        };
        const markSettled = () => {
            delete container.dataset.mapZooming;
        };
        const pinchWheel = (event: WheelEvent) => {
            if (!event.ctrlKey) return;
            event.preventDefault();
            event.stopPropagation();
            if (continuousMap._animatingZoom) return;
            gesture.zoomBy(
                L.DomEvent.getWheelDelta(event) /
                    (map.options.wheelPxPerZoomLevel ??
                        TRACKPAD_PINCH_PIXELS_PER_ZOOM_LEVEL),
                map.mouseEventToContainerPoint(event),
            );
        };
        // Chromium trackpad pinches arrive as ctrl+wheel. Plain scrolling stays
        // with the page; only map-local pinch gestures suppress browser zoom.
        container.addEventListener('wheel', pinchWheel, { passive: false });
        map.on('movestart zoomstart', resetGesture);
        map.on('zoomstart', markZooming);
        map.on('zoomend', markSettled);
        return () => {
            container.removeEventListener('wheel', pinchWheel);
            map.off('movestart zoomstart', resetGesture);
            map.off('zoomstart', markZooming);
            map.off('zoomend', markSettled);
            gesture.cancel();
            markSettled();
        };
    }, [map]);
    return null;
}

/** Refits for a new reporting footprint, while keeping a user's pan and zoom. */
function ReportingFootprint({
    districts,
    countries,
    fills,
    selectedKey,
}: {
    districts: ProgressDistrict[];
    countries: CountryGeometry[];
    fills: ProgressDistrictFill[];
    selectedKey: string | null;
}) {
    const map = useMap();
    const fitted = useRef<{
        footprint: string;
        width: number;
        height: number;
    } | null>(null);
    const footprint = useMemo(
        () =>
            districts
                .filter(district => district.position !== null)
                .map(
                    district =>
                        `${district.key}:${district.position!.latitude}:${district.position!.longitude}`,
                )
                .sort()
                .join('|') +
            ':' +
            countries.map(country => country.country).join(','),
        [districts, countries],
    );

    useEffect(() => {
        const selectedDistrict = districts.find(
            district => district.key === selectedKey,
        );
        const selectedFill = fills.find(
            fill => fill.district.key === selectedKey,
        );
        const target = selectedKey
            ? `${selectedKey}:${selectedDistrict?.position?.latitude}:${selectedDistrict?.position?.longitude}:${selectedFill ? 'area' : 'point'}`
            : `${footprint}:all`;
        const points = districts.flatMap(district =>
            district.position
                ? [
                      [
                          district.position.latitude,
                          district.position.longitude,
                      ] as L.LatLngTuple,
                  ]
                : [],
        );
        const context = countries.flatMap(countryFrame);
        function fitFootprint() {
            const size = map.getSize();
            if (size.x <= 0 || size.y <= 0) return;
            // A selected area can be waiting for its optional country chunk.
            // Other geometry arriving must not replace that focus with overview.
            if (selectedKey && !selectedFill && !selectedDistrict?.position)
                return;
            const previous = fitted.current;
            if (
                previous?.footprint === target &&
                Math.abs(previous.width - size.x) < 2 &&
                Math.abs(previous.height - size.y) < 2
            )
                return;
            fitted.current = {
                footprint: target,
                width: size.x,
                height: size.y,
            };
            if (selectedFill) {
                map.fitBounds(L.geoJSON(selectedFill.geometry).getBounds(), {
                    padding: size.x < 520 ? [38, 72] : [72, 72],
                    maxZoom: 9,
                    animate: false,
                });
            } else if (selectedDistrict?.position) {
                map.fitBounds(
                    [
                        [
                            selectedDistrict.position.latitude,
                            selectedDistrict.position.longitude,
                        ],
                    ],
                    {
                        padding: size.x < 520 ? [38, 72] : [72, 72],
                        maxZoom: 9,
                        animate: false,
                    },
                );
            } else if (points.length > 0 || context.length > 0) {
                map.fitBounds([...context, ...points], {
                    padding: size.x < 520 ? [32, 38] : [42, 38],
                    maxZoom: 8.5,
                    animate: false,
                });
            } else {
                map.setView(UGANDA_CENTER, 6, { animate: false });
            }
        }

        map.getContainer().setAttribute('role', 'region');
        map.getContainer().setAttribute(
            'aria-label',
            'VectorCam reporting activity. Pinch or use the zoom controls to explore. Select a country to zoom in, or a reporting area to see its monthly scans.',
        );
        fitFootprint();
        const observer = new ResizeObserver(() => {
            map.invalidateSize({ pan: false });
            fitFootprint();
        });
        observer.observe(map.getContainer());
        return () => {
            observer.disconnect();
        };
    }, [districts, countries, fills, selectedKey, footprint, map]);

    return null;
}

function ClearSelection({
    onSelect,
}: {
    onSelect: (key: string | null) => void;
}) {
    useMapEvents({ click: () => onSelect(null) });
    return null;
}

/** Where a moved name's leader meets its box; null when it barely moved. */
function leaderEnd(box: LabelBox, from: { x: number; y: number }) {
    const end = {
        x: Math.max(
            box.x - box.width / 2,
            Math.min(box.x + box.width / 2, from.x),
        ),
        y: Math.max(
            box.y - box.height / 2,
            Math.min(box.y + box.height / 2, from.y),
        ),
    };
    return Math.hypot(from.x - end.x, from.y - end.y) > 10 ? end : null;
}

type TooltipSide = 'top' | 'bottom' | 'right' | 'left';
const TOOLTIP_SIDES: TooltipSide[] = ['top', 'bottom', 'right', 'left'];
const tooltipDefaults = new WeakMap<
    L.Tooltip,
    { direction: TooltipSide; offset: L.Point }
>();

/** Pixels outside the map plus the square root of any zoom-control overlap. */
function tooltipClash(box: DOMRect, frame: DOMRect, control?: DOMRect) {
    const outside =
        Math.max(0, frame.left - box.left) +
        Math.max(0, box.right - frame.right) +
        Math.max(0, frame.top - box.top) +
        Math.max(0, box.bottom - frame.bottom);
    const overlap = control
        ? Math.max(
              0,
              Math.min(box.right, control.right) -
                  Math.max(box.left, control.left),
          ) *
          Math.max(
              0,
              Math.min(box.bottom, control.bottom) -
                  Math.max(box.top, control.top),
          )
        : 0;
    return outside + Math.sqrt(overlap);
}

/**
 * Opens each tooltip on the first side that keeps it inside the map and off
 * the zoom control, else on the side that clips least; closing restores it.
 */
function FitTooltipsInMap() {
    const map = useMap();
    useMapEvents({
        tooltipopen: ({ tooltip }) => {
            const element = tooltip.getElement();
            const preferred = tooltip.options.direction;
            if (!element || !TOOLTIP_SIDES.includes(preferred as TooltipSide))
                return;
            const defaults = tooltipDefaults.get(tooltip) ?? {
                direction: preferred as TooltipSide,
                offset: L.point(tooltip.options.offset ?? [0, 0]),
            };
            tooltipDefaults.set(tooltip, defaults);
            const gap = Math.max(
                Math.abs(defaults.offset.x),
                Math.abs(defaults.offset.y),
            );
            const offsets: Record<TooltipSide, L.PointTuple> = {
                top: [0, -gap],
                bottom: [0, gap],
                right: [gap, 0],
                left: [-gap, 0],
            };
            const frame = map.getContainer().getBoundingClientRect();
            const control = map
                .getContainer()
                .querySelector('.leaflet-control-zoom')
                ?.getBoundingClientRect();
            const sides = [
                defaults.direction,
                ...TOOLTIP_SIDES.filter(side => side !== defaults.direction),
            ];
            let best: { side: TooltipSide; clash: number } | null = null;
            for (const side of sides) {
                tooltip.options.direction = side;
                tooltip.options.offset = offsets[side];
                tooltip.update();
                const clash = tooltipClash(
                    element.getBoundingClientRect(),
                    frame,
                    control,
                );
                if (!best || clash < best.clash) best = { side, clash };
                if (clash === 0) break;
            }
            if (best && tooltip.options.direction !== best.side) {
                tooltip.options.direction = best.side;
                tooltip.options.offset = offsets[best.side];
                tooltip.update();
            }
            // No side fits a tall tooltip near an edge: slide it inside.
            const box = element.getBoundingClientRect();
            const margin = 8;
            const dx =
                Math.max(0, frame.left + margin - box.left) -
                Math.max(0, box.right - (frame.right - margin));
            const dy =
                Math.max(0, frame.top + margin - box.top) -
                Math.max(0, box.bottom - (frame.bottom - margin));
            if (dx !== 0 || dy !== 0)
                L.DomUtil.setPosition(
                    element,
                    L.DomUtil.getPosition(element).add([dx, dy]),
                );
        },
        tooltipclose: ({ tooltip }) => {
            const defaults = tooltipDefaults.get(tooltip);
            if (!defaults) return;
            tooltip.options.direction = defaults.direction;
            tooltip.options.offset = defaults.offset;
        },
    });
    return null;
}

export default function ProgressMap({
    districts,
    upcoming = [],
    selectedKey,
    onSelect,
    onPlacementChange,
    stephensi,
    onStephensiSelect,
    stephensiFocused = false,
}: {
    districts: ProgressDistrict[];
    upcoming?: UpcomingArea[];
    /** Specimens per District key; when given, each gets a rippling dot. */
    stephensi?: ReadonlyMap<string, number>;
    /** A click on a stephensi dot; plain selection when omitted. */
    onStephensiSelect?: (key: string) => void;
    /** Whether the selected District's stephensi view is open. */
    stephensiFocused?: boolean;
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
    onPlacementChange?: (placement: ProgressMapPlacement) => void;
}) {
    const countryKey = [...new Set(districts.map(district => district.country))]
        .toSorted()
        .join('|');
    const [loadedAreas, setLoadedAreas] = useState(() => new Map(AREA_CACHE));
    const [stephensiHoverKey, setStephensiHoverKey] = useState<string | null>(
        null,
    );
    // Upcoming outlines fill it; their tags read it in hover handlers.
    const [upcomingLayers] = useState(() => new Map<string, L.GeoJSON>());
    useEffect(() => {
        let current = true;
        const countries = countryKey
            .split('|')
            .filter(country => AREA_LOADERS[country]);
        const missing = countries.filter(country => !AREA_CACHE.has(country));
        void Promise.all(
            missing.map(async country => {
                try {
                    const file = await AREA_LOADERS[country]();
                    AREA_CACHE.set(country, {
                        boundaries: progressAreaBoundaries(file),
                        attribution: progressBoundaryAttribution(file.source),
                    });
                } catch {
                    // A failed optional boundary chunk keeps recorded point fallback.
                    AREA_CACHE.set(country, {
                        boundaries: [],
                        attribution: '',
                    });
                }
            }),
        ).then(() => {
            if (current) setLoadedAreas(new Map(AREA_CACHE));
        });
        return () => {
            current = false;
        };
    }, [countryKey]);
    useEffect(() => {
        if (
            selectedKey !== null &&
            !districts.some(district => district.key === selectedKey)
        )
            onSelect(null);
    }, [districts, selectedKey, onSelect]);
    const boundaries = useMemo(() => {
        const result = new Map(DISTRICT_BOUNDARIES);
        loadedAreas.forEach((areas, country) =>
            result.set(country, areas.boundaries),
        );
        return result;
    }, [loadedAreas]);
    const attributions = useMemo(
        () =>
            new Map(
                [...loadedAreas].map(([country, areas]) => [
                    country,
                    areas.attribution,
                ]),
            ),
        [loadedAreas],
    );
    const loadingAreas = countryKey
        .split('|')
        .some(country => AREA_LOADERS[country] && !loadedAreas.has(country));
    const { fills } = useMemo(
        () => matchProgressDistrictBoundaries(districts, boundaries),
        [districts, boundaries],
    );
    useEffect(() => {
        // Wait for the selected countries' local boundary chunks before
        // declaring an area unplaced. The source ties the notice to this DTO.
        if (!loadingAreas)
            onPlacementChange?.(progressMapPlacement(districts, fills));
    }, [districts, fills, loadingAreas, onPlacementChange]);
    const mappedDistricts = useMemo(
        () =>
            districts.map(district => {
                if (district.position) return district;
                const fill = fills.find(
                    row => row.district.key === district.key,
                );
                const at = fill ? coverageLabelPoint(fill.geometry)?.at : null;
                return at
                    ? {
                          ...district,
                          position: { latitude: at[0], longitude: at[1] },
                      }
                    : district;
            }),
        [districts, fills],
    );
    const countries = useMemo(() => {
        const names = new Set(
            mappedDistricts
                .filter(district => district.position !== null)
                .map(district => district.country),
        );
        return COUNTRY_GEOMETRIES.filter(country => names.has(country.country));
    }, [mappedDistricts]);

    if (!mappedDistricts.some(district => district.position))
        return (
            <div className={styles.emptyMap}>
                <p>
                    {loadingAreas
                        ? 'Loading reporting map'
                        : 'Map locations unavailable'}
                </p>
                <span>
                    Reporting totals are included. Choose a reporting area
                    beside the chart to see its activity.
                </span>
            </div>
        );

    return (
        <MapContainer
            center={UGANDA_CENTER}
            zoom={6}
            scrollWheelZoom={false}
            touchZoom
            bounceAtZoomLimits={false}
            maxBoundsViscosity={1}
            minZoom={1}
            maxZoom={PROGRESS_MAP_MAX_ZOOM}
            worldCopyJump={false}
            className={styles.canvas}
            zoomSnap={0}
            zoomDelta={0.5}
            wheelPxPerZoomLevel={TRACKPAD_PINCH_PIXELS_PER_ZOOM_LEVEL}
        >
            <TileLayer
                attribution='<span class="progress-map-credit"><span class="progress-map-credit-source">&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors</span></span>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
                updateWhenIdle
                updateWhenZooming={false}
                noWrap
                opacity={0.58}
                errorTileUrl={L.Util.emptyImageUrl}
            />
            <GeographicContext countries={countries} />
            <ReportingNavigation
                districts={mappedDistricts}
                countries={countries}
            />
            <ReportingFootprint
                districts={mappedDistricts}
                countries={countries}
                fills={fills}
                selectedKey={selectedKey}
            />
            <UpcomingAreas areas={upcoming} areaLayers={upcomingLayers} />
            <ClearSelection onSelect={onSelect} />
            <FitTooltipsInMap />
            <ReportingActivity
                districts={mappedDistricts}
                countries={countries}
                fills={fills}
                attributions={attributions}
                selectedKey={selectedKey}
                onSelect={onSelect}
                upcoming={upcoming}
                upcomingLayers={upcomingLayers}
                stephensi={stephensi}
                stephensiKey={
                    stephensi
                        ? (stephensiHoverKey ??
                          (stephensiFocused ? selectedKey : null))
                        : null
                }
            />
            {stephensi && (
                <StephensiSpots
                    districts={mappedDistricts}
                    counts={stephensi}
                    selectedKey={selectedKey}
                    onSelect={onStephensiSelect ?? onSelect}
                    onHover={setStephensiHoverKey}
                />
            )}
        </MapContainer>
    );
}
