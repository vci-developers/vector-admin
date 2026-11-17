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
    progressStephensiFillColor,
    PROGRESS_SCAN_FILL_OPACITY,
    PROGRESS_STARTED_BORDER,
} from '@/features/dashboard/utils/progress-map-colors';
import {
    formatProgressLocations,
    formatSentinelSites,
    totalSentinelSites,
} from '@/features/dashboard/utils/format-progress-locations';
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
    progressMapExtent,
    progressMapMinimumZoom,
    PROGRESS_MAP_MAX_ZOOM,
} from '@/features/dashboard/utils/progress-map-extent';
import type { FeatureCollection } from 'geojson';
import L from 'leaflet';
import {
    createContext,
    use,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
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
import styles from './progress-map.module.css';

const number = new Intl.NumberFormat('en');

/**
 * What the map's counts are: scans, or one species' specimens while the
 * timeline plays with that species chosen. `text` is for screen readers.
 */
export type MapCountUnit = { label: ReactNode; text: string };
const SCANS: MapCountUnit = { label: 'scans', text: 'scans' };
const CountUnitContext = createContext<MapCountUnit>(SCANS);

function CountUnit() {
    return use(CountUnitContext).label;
}
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
    _getBoundsCenterZoom: (
        bounds: L.LatLngBounds,
        options: L.FitBoundsOptions,
    ) => { center: L.LatLng; zoom: number };
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

/** "3 sentinel sites" above the households, or nothing when unknown. */
function sentinelSitesLine(rows: ProgressDistrict['sentinelSitesByProgram']) {
    const total = totalSentinelSites(rows);
    return total === null ? null : (
        <span className={styles.tooltipLocations}>
            {formatSentinelSites(total, count => number.format(count))}
        </span>
    );
}

type CountryDevices = ReadonlyMap<string, number>;

/** "4 active devices" for a country with a count; nothing otherwise. */
function devicesLine(active: number | undefined) {
    return active === undefined ? null : (
        <span className={styles.tooltipLocations}>
            {number.format(active)} active {active === 1 ? 'device' : 'devices'}
        </span>
    );
}

/** Households and the like; none while the map shows part of the period. */
type CoverageRows = ProgressDistrict['coverageByProgram'];

/**
 * Collection sites repeat the sentinel site line (Pilgrim falls back to
 * them), so the tags only name households, municipalities and the like.
 */
function namedCoverage(rows: CoverageRows) {
    return rows.filter(row => row.unit !== 'collection-site');
}

function coverageLine(all: CoverageRows) {
    const rows = namedCoverage(all);
    return rows.length === 0 ? null : (
        <span className={styles.tooltipLocations}>
            {formatProgressLocations(rows, count => number.format(count))}
        </span>
    );
}

function coverageSentence(all: CoverageRows) {
    const rows = namedCoverage(all);
    return rows.length === 0
        ? ''
        : ` Active reporting coverage: ${formatProgressLocations(rows, count => number.format(count))}.`;
}

function districtLabel(district: ProgressDistrict) {
    return `${district.name}, ${district.country}: ${number.format(district.uniqueScans)} scans.${coverageSentence(district.coverageByProgram)}`;
}

/**
 * Each country that is a single marker at this zoom, shaded whole against the
 * top country's scans for the period. Zooming in hands over to its Districts.
 */
function CountryFills({
    countries,
    districts,
    nodes,
    scansAsOf,
    devices,
    startedCountries,
    selectedCountry,
    shade,
    onExplore,
    onClearArea,
    onCountrySelect,
}: {
    countries: CountryGeometry[];
    districts: readonly ProgressDistrict[];
    nodes: readonly ProgressMapNode[];
    scansAsOf?: ReadonlyMap<string, number>;
    devices?: CountryDevices;
    startedCountries?: ReadonlySet<string>;
    /** Stays clickable when zoomed in, so a click inside it isn't "outside". */
    selectedCountry: string | null;
    shade?: StephensiShade;
    onExplore: (node: ProgressMapNode) => void;
    onClearArea: () => void;
    /** A country with no node of its own, as when zoomed in to stephensi. */
    onCountrySelect?: (country: string) => void;
}) {
    const most = Math.max(1, ...nodes.map(node => node.uniqueScans));
    const mostStephensi = shade
        ? Math.max(
              1,
              ...nodes.map(node =>
                  shadeSum(shade.totals, node.sourceDistricts),
              ),
          )
        : 1;
    return (
        <Pane name="progressCountryFills" style={{ zIndex: 420 }}>
            {countries.map(country => {
                const node = nodes.find(row => row.country === country.country);
                const chosen = country.country === selectedCountry;
                // Zoomed in, the country is a backdrop to its Districts: no
                // shade of its own, but its tooltip still adds them all up.
                const inCountry = districts.filter(
                    row => row.country === country.country,
                );
                const total = inCountry.reduce(
                    (sum, row) =>
                        sum + (scansAsOf?.get(row.key) ?? row.uniqueScans),
                    0,
                );
                const scans =
                    node?.sourceDistricts.reduce(
                        (sum, row) =>
                            sum + (scansAsOf?.get(row.key) ?? row.uniqueScans),
                        0,
                    ) ?? 0;
                const purple = shade?.countries.has(country.country) ?? false;
                const specimens =
                    shade && purple && node
                        ? shadeSum(shade.counts, node.sourceDistricts)
                        : 0;
                return (
                    <GeoJSON
                        key={country.country}
                        data={country.geometry}
                        ref={group => {
                            // Zoomed in, the Districts above take their own
                            // clicks; the rest of the country still selects it.
                            group?.eachLayer(layer => {
                                const shape = (layer as L.Path).getElement();
                                if (shape instanceof SVGElement)
                                    shape.style.pointerEvents =
                                        node || chosen || onCountrySelect
                                            ? 'auto'
                                            : 'none';
                            });
                        }}
                        eventHandlers={{
                            click: () => {
                                if (node) onExplore(node);
                                else if (chosen) onClearArea();
                                else onCountrySelect?.(country.country);
                            },
                        }}
                        style={{
                            className: styles.districtArea,
                            fillColor:
                                shade && purple
                                    ? progressStephensiFillColor(
                                          specimens,
                                          mostStephensi,
                                          shade.even,
                                      )
                                    : progressScanFillColor(
                                          scans,
                                          most,
                                          scansAsOf !== undefined,
                                      ),
                            // With the stephensi filter, only stephensi shows.
                            fillOpacity:
                                (shade ? specimens : scans) > 0
                                    ? PROGRESS_SCAN_FILL_OPACITY
                                    : 0,
                            // On the timeline a country's border comes in
                            // with its first upload.
                            stroke: startedCountries !== undefined,
                            color: PROGRESS_STARTED_BORDER,
                            weight: 1.2,
                            opacity: startedCountries?.has(country.country)
                                ? 0.9
                                : 0,
                            bubblingMouseEvents: false,
                        }}
                    >
                        {/* Stays bound: Leaflet's focus handler needs it. */}
                        <Tooltip
                            pane="tooltipPane"
                            sticky
                            direction="top"
                            className={styles.tooltip}
                            opacity={1}
                        >
                            <div className={styles.tooltipContent}>
                                <span className={styles.tooltipName}>
                                    {country.country}
                                </span>
                                <span className={styles.tooltipScans}>
                                    {number.format(total)} <CountUnit />
                                </span>
                                {sentinelSitesLine(
                                    inCountry.flatMap(
                                        district =>
                                            district.sentinelSitesByProgram,
                                    ),
                                )}
                                {node && coverageLine(node.coverageByProgram)}
                                {devicesLine(devices?.get(country.country))}
                                {node && (
                                    <span className={styles.tooltipHint}>
                                        {chosen
                                            ? 'Mapped reporting areas · Select to zoom in'
                                            : `Select to see ${country.country} only`}
                                    </span>
                                )}
                            </div>
                        </Tooltip>
                    </GeoJSON>
                );
            })}
        </Pane>
    );
}

type StephensiHeatData = {
    /** Specimens so far by District key, from the timeline. */
    counts: ReadonlyMap<string, number>;
    /** Specimens over the whole period, which sets the strongest patch. */
    totals: ReadonlyMap<string, number>;
};

/**
 * With the An. stephensi filter on, an area where it was found shades purple by
 * its specimens instead of green by scans; other areas keep their green. Seen
 * whole, a country with any shades purple.
 */
type StephensiShade = {
    /** Countries with An. stephensi in the period. */
    countries: ReadonlySet<string>;
    /** Specimens by District key, so far on the timeline. */
    counts: ReadonlyMap<string, number>;
    /** Specimens over the whole period, which sets the darkest shade. */
    totals: ReadonlyMap<string, number>;
    /** The timeline's even scale, as for scans. */
    even: boolean;
};

function shadeSum(
    values: ReadonlyMap<string, number>,
    districts: readonly ProgressDistrict[],
) {
    return districts.reduce((sum, row) => sum + (values.get(row.key) ?? 0), 0);
}

/** Half the patch's full size in the stylesheet. */
const HEAT_RADIUS = 28;

/**
 * One soft patch, cut off at its country's border. It stays mounted so its
 * strength can fade between months.
 */
function StephensiHeatSpot({
    latitude,
    longitude,
    strength,
    country,
}: {
    latitude: number;
    longitude: number;
    strength: number;
    country?: CountryGeometry;
}) {
    const map = useMap();
    const { zoom } = useViewport();
    const marker = useRef<L.Marker>(null);
    const [icon] = useState(() =>
        L.divIcon({
            className: styles.stephensiHeat,
            iconSize: [0, 0],
            html: '<span><i></i></span>',
        }),
    );
    useEffect(() => {
        const patch = marker.current?.getElement()?.firstElementChild;
        if (!(patch instanceof HTMLElement)) return;
        patch.style.setProperty(
            '--heat-opacity',
            String(strength === 0 ? 0 : 0.35 + 0.5 * strength),
        );
        patch.style.setProperty('--heat-scale', String(0.35 + 0.65 * strength));
    }, [strength]);
    // The border's distance from the patch changes only with the zoom.
    useEffect(() => {
        const patch = marker.current?.getElement()?.firstElementChild;
        if (!(patch instanceof HTMLElement) || !country) return;
        const anchor = map.latLngToLayerPoint([latitude, longitude]);
        const rings = country.geometry.coordinates.flat().map(ring => {
            const points = ring.map(([lng, lat]) => {
                const { x, y } = map
                    .latLngToLayerPoint([lat, lng])
                    .subtract(anchor);
                return `${(x + HEAT_RADIUS).toFixed(1)} ${(y + HEAT_RADIUS).toFixed(1)}`;
            });
            return `M${points.join('L')}Z`;
        });
        patch.style.clipPath = `path(evenodd, '${rings.join('')}')`;
    }, [map, zoom, latitude, longitude, country]);
    return (
        <Marker
            ref={marker}
            position={[latitude, longitude]}
            icon={icon}
            interactive={false}
            keyboard={false}
        />
    );
}

/** Stands in for the An. stephensi dots while the timeline is open. */
function StephensiHeat({
    districts,
    countries,
    heat,
    filledKeys,
}: {
    districts: ProgressDistrict[];
    countries: CountryGeometry[];
    heat: StephensiHeatData;
    /** Shaded purple already; patches are for places without a boundary. */
    filledKeys: ReadonlySet<string>;
}) {
    const most = Math.max(1, ...heat.totals.values());
    return (
        <Pane
            name="progressStephensiHeat"
            style={{ zIndex: 440, pointerEvents: 'none' }}
        >
            {districts.flatMap(({ key, position, country }) =>
                position && heat.totals.has(key) && !filledKeys.has(key) ? (
                    <StephensiHeatSpot
                        key={key}
                        latitude={position.latitude}
                        longitude={position.longitude}
                        strength={Math.sqrt((heat.counts.get(key) ?? 0) / most)}
                        country={countries.find(row => row.country === country)}
                    />
                ) : (
                    []
                ),
            )}
        </Pane>
    );
}

function districtStyle(
    district: ProgressDistrict,
    maximum: number,
    selected: boolean,
    scansAsOf?: ReadonlyMap<string, number>,
    shade?: StephensiShade,
): L.PathOptions {
    const scans = scansAsOf?.get(district.key) ?? district.uniqueScans;
    const specimens = shade?.counts.get(district.key) ?? 0;
    // The stephensi filter shows stephensi alone: other areas are outlines.
    if (shade && specimens === 0)
        return {
            className: styles.districtArea,
            color: selected ? '#075341' : '#9aa8a2',
            weight: selected ? 2.7 : 0.8,
            opacity: selected ? 1 : 0.6,
            fillOpacity: 0,
            bubblingMouseEvents: false,
        };
    if (shade) {
        return {
            className: styles.districtArea,
            color: STEPHENSI_STROKE,
            weight: selected ? 2.7 : 1.35,
            opacity: 0.9,
            fillColor: progressStephensiFillColor(
                specimens,
                Math.max(1, ...shade.totals.values()),
                shade.even,
            ),
            fillOpacity: PROGRESS_SCAN_FILL_OPACITY,
            bubblingMouseEvents: false,
        };
    }
    return {
        className: styles.districtArea,
        color: selected ? '#075341' : '#168367',
        weight: selected ? 2.7 : 1.35,
        opacity: selected ? 1 : 0.9,
        fillColor: progressScanFillColor(
            scans,
            maximum,
            scansAsOf !== undefined,
        ),
        // On the timeline, a place not reporting yet is only an outline.
        fillOpacity: scansAsOf && scans === 0 ? 0 : PROGRESS_SCAN_FILL_OPACITY,
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
    overviewCountries,
    selectedKey,
    onSelect,
    hoveredKey,
    onHover,
    areaLayers,
    stephensi,
    stephensiKey,
    scansAsOf,
    shade,
    startedCountries,
}: {
    fills: ProgressDistrictFill[];
    attributions: ReadonlyMap<string, string>;
    detailDistrictKeys: ReadonlySet<string>;
    /** Shown whole at this zoom, so their Districts stay hidden. */
    overviewCountries: ReadonlySet<string>;
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
    hoveredKey: string | null;
    onHover: (key: string | null) => void;
    areaLayers: Map<string, L.GeoJSON>;
    stephensi?: ReadonlyMap<string, number>;
    /** The area outlined in the stephensi colour: its dot hovered or its view open. */
    stephensiKey: string | null;
    scansAsOf?: ReadonlyMap<string, number>;
    shade?: StephensiShade;
    /** On the timeline, areas wait for their country's first upload. */
    startedCountries?: ReadonlySet<string>;
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
                const baseStyle = districtStyle(
                    district,
                    maximum,
                    selected,
                    scansAsOf,
                    shade,
                );
                // The area, its name tag and its marker share one hover.
                const style =
                    overviewCountries.has(district.country) ||
                    (startedCountries !== undefined &&
                        !startedCountries.has(district.country))
                        ? { ...baseStyle, opacity: 0, fillOpacity: 0 }
                        : district.key === stephensiKey
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
                                direction="top"
                                className={styles.tooltip}
                                opacity={1}
                            >
                                <div className={styles.tooltipContent}>
                                    <span className={styles.tooltipName}>
                                        {district.name}
                                    </span>
                                    <span className={styles.tooltipScans}>
                                        {number.format(
                                            scansAsOf?.get(district.key) ??
                                                district.uniqueScans,
                                        )}{' '}
                                        <CountUnit />
                                    </span>
                                    {sentinelSitesLine(
                                        district.sentinelSitesByProgram,
                                    )}
                                    {coverageLine(district.coverageByProgram)}
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

/** An area or cluster marker; countries have none, only a name. */
function activityIcon(
    node: ProgressMapNode,
    maximum: number,
    selected: boolean,
) {
    const glow = glowDiameter(node, maximum);
    const intensity = 0.5 + 0.5 * Math.sqrt(node.uniqueScans / maximum);
    const core =
        node.kind === 'cluster'
            ? `<span class="${styles.clusterCore}">${node.sourceDistricts.length}</span>`
            : `<span class="${styles.core}"></span>`;
    return L.divIcon({
        className: styles.mark,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        html: `<span class="${styles.activitySpot}" style="left:16px;top:16px" data-selected="${selected}" data-empty="${node.uniqueScans === 0}"><span class="${styles.glow}" style="width:${glow}px;height:${glow}px;opacity:${intensity}"></span>${core}</span>`,
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

/**
 * Neutral local geography still draws when external tiles are unavailable.
 * On the timeline a country's outline stays hidden until its first upload.
 */
function GeographicContext({
    countries,
    startedCountries,
}: {
    countries: CountryGeometry[];
    startedCountries?: ReadonlySet<string>;
}) {
    const { zoom } = useViewport();
    return (
        <>
            <Pane
                name="progressCountryContext"
                style={{ zIndex: 390, pointerEvents: 'none' }}
            >
                {countries.map(country => {
                    const shown =
                        startedCountries?.has(country.country) ?? true;
                    return (
                        <GeoJSON
                            key={country.country}
                            data={country.geometry}
                            interactive={false}
                            style={{
                                className: styles.countryContext,
                                color: '#8ea99e',
                                weight: 1,
                                opacity: shown ? 0.65 : 0,
                                fillColor: '#d4e8dc',
                                fillOpacity: shown ? 0.2 : 0,
                            }}
                        />
                    );
                })}
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

/** Group at overview scale, then reveal districts without colliding markers. */
function ReportingActivity({
    districts,
    countries,
    fills,
    attributions,
    selectedKey,
    onSelect,
    selectedCountry,
    onCountrySelect,
    upcoming,
    upcomingLayers,
    stephensi,
    stephensiKey,
    scansAsOf,
    devices,
    startedCountries,
    timelineOpen,
    shade,
}: {
    districts: ProgressDistrict[];
    countries: CountryGeometry[];
    fills: ProgressDistrictFill[];
    attributions: ReadonlyMap<string, string>;
    shade?: StephensiShade;
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
    selectedCountry: string | null;
    onCountrySelect?: (country: string | null) => void;
    upcoming: UpcomingArea[];
    upcomingLayers: Map<string, L.GeoJSON>;
    stephensi?: ReadonlyMap<string, number>;
    stephensiKey: string | null;
    scansAsOf?: ReadonlyMap<string, number>;
    devices?: CountryDevices;
    startedCountries?: ReadonlySet<string>;
    timelineOpen: boolean;
}) {
    const map = useMap();
    const viewport = useViewport();
    const unit = use(CountUnitContext);
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
                // A chosen country always opens to its areas, however large
                // (Colombia frames below the zoom where countries merge).
                overviewZoom: selectedCountry ? 0 : 6,
                overviewMaxZoom: selectedCountry ? 0 : OVERVIEW_MAX_ZOOM,
                overviewFootprint: viewport.width < 520 ? 135 : 190,
                clusterDistance: 44,
            }),
        [districts, map, viewport, selectedCountry],
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
    const countryNodes = nodes.filter(node => node.kind === 'country');
    const overviewCountries = new Set(countryNodes.map(node => node.country));
    const selectedDistrict = districts.find(row => row.key === selectedKey);
    // A new icon rebuilds its marker, so the timeline's months reuse these.
    const icons = useMemo(
        () =>
            new Map(
                nodes.map(node => {
                    const icon = (selected: boolean) =>
                        activityIcon(node, maximum, selected);
                    return [node.key, [icon(false), icon(true)]];
                }),
            ),
        [nodes, maximum],
    );

    // A country's first click chooses it; once chosen, a click zooms in.
    function explore(node: ProgressMapNode) {
        if (
            node.kind === 'country' &&
            onCountrySelect &&
            node.country !== selectedCountry
        ) {
            // Fly now; the country's data lands where the map already is.
            awaitRefocus(map);
            onCountrySelect(node.country);
            return;
        }
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
                ...selectionFit(map),
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
        // Countries have no marker now, only their name, so only areas block.
        const obstacles: LabelBox[] = nodes
            .filter(node => node.kind !== 'country')
            .map(node => ({
                key: node.key,
                x: node.projected.x,
                y: node.projected.y,
                width: 32,
                height: 32,
            }));
        obstacles.push({
            key: 'zoom-control',
            x: 38,
            y: 57,
            width: 50,
            height: 86,
        });
        const countryLabels = countries.flatMap(country => {
            // Inside a chosen country its areas speak; its name is the page's.
            if (country.country === selectedCountry) return [];
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
            // Names may touch each other (Uganda and Kenya at world scale);
            // on the timeline, the tags that would block one are hidden.
            return onScreen(box) &&
                (timelineOpen || placeLabels([box], obstacles).has(box.key))
                ? [{ country: country.country, position: point.at, box }]
                : [];
        });
        // Touching names ease apart a few pixels: the higher (or western)
        // one up, the other down.
        for (const [index, first] of countryLabels.entries())
            for (const second of countryLabels.slice(index + 1)) {
                if (placeLabels([second.box], [first.box]).has(second.box.key))
                    continue;
                const [upper, lower] =
                    first.box.y < second.box.y ||
                    (first.box.y === second.box.y && first.box.x < second.box.x)
                        ? [first, second]
                        : [second, first];
                upper.box.y -= LABEL_EASE_PX;
                lower.box.y += LABEL_EASE_PX;
            }
        for (const label of countryLabels) {
            const at = map.containerPointToLatLng([label.box.x, label.box.y]);
            label.position = [at.lat, at.lng];
        }
        obstacles.push(...countryLabels.map(label => label.box));
        // Country summaries and granular area names share one visibility rule.
        // Partly visible shapes may place a name inside the edge; places wholly
        // outside the viewport must not appear as misleading edge labels.
        const visibleBounds = map.getBounds();
        const ordered = districts
            .filter(
                district =>
                    detailDistrictKeys.has(district.key) &&
                    // Named only once its country's first upload is in.
                    (startedCountries?.has(district.country) ?? true),
            )
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
            // Busiest first: where names collide, theirs stay.
            .toSorted(
                (a, b) =>
                    Number(b.district.key === selectedKey) -
                        Number(a.district.key === selectedKey) ||
                    b.district.uniqueScans - a.district.uniqueScans ||
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
        // Names sit on their areas, never moved out to tags: one that would
        // collide is left off, and its area's tooltip still names it.
        const nameBoxes = ordered.map(label => ({
            key: label.district.key,
            x: label.projected.x,
            y: label.projected.y + (label.filled ? 0 : 24),
            width: textWidths.get(label.district.key)!,
            height: 24,
        }));
        const shownNames = placeLabels(nameBoxes, obstacles);
        const placements = new Map(
            nameBoxes
                .filter(box => shownNames.has(box.key))
                .map(box => [box.key, box]),
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
            districts: ordered.flatMap(label => {
                const box = placements.get(label.district.key);
                if (!box) return [];
                return [
                    {
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
                                        textWidths.get(label.district.key)! -
                                            22,
                                    ),
                            ),
                        position: map.containerPointToLatLng([box.x, box.y]),
                    },
                ];
            }),
        };
    }, [
        timelineOpen,
        startedCountries,
        nodes,
        detailDistrictKeys,
        districts,
        fills,
        fillBounds,
        countries,
        selectedKey,
        selectedCountry,
        viewport,
        map,
        upcoming,
    ]);

    return (
        <>
            <ReportingDistrictAreas
                fills={fills}
                attributions={attributions}
                detailDistrictKeys={detailDistrictKeys}
                overviewCountries={overviewCountries}
                selectedKey={selectedKey}
                onSelect={onSelect}
                hoveredKey={hoveredKey}
                onHover={setHoveredKey}
                areaLayers={areaLayers}
                stephensi={stephensi}
                stephensiKey={stephensiKey}
                scansAsOf={scansAsOf}
                shade={shade}
                startedCountries={startedCountries}
            />
            {/* A country is its shaded shape and name, as on Prism: no tag. */}
            {/* The stephensi filter shows stephensi alone: no scan markers. */}
            {nodes
                .filter(node => node.kind !== 'country' && !shade)
                .map(node => {
                    const selected = node.districtKeys.includes(
                        selectedKey ?? '',
                    );
                    const district = node.sourceDistricts[0];
                    const zoomLabel = `Zoom to ${node.kind === 'country' ? node.country : `${node.sourceDistricts.length} nearby`} reporting areas.`;
                    const nodeScans = node.sourceDistricts.reduce(
                        (sum, row) =>
                            sum + (scansAsOf?.get(row.key) ?? row.uniqueScans),
                        0,
                    );
                    const label = scansAsOf
                        ? `${node.kind === 'district' ? district.name : zoomLabel} ${number.format(nodeScans)} ${unit.text} so far.`
                        : node.kind === 'district'
                          ? districtLabel(district)
                          : node.kind !== 'country' &&
                              selected &&
                              selectedDistrict
                            ? `${districtLabel(selectedDistrict)}. ${zoomLabel}`
                            : `${zoomLabel} ${number.format(node.uniqueScans)} mapped scans.${coverageSentence(node.coverageByProgram)}`;
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
                            icon={icons.get(node.key)![selected ? 1 : 0]}
                            title={label}
                            keyboard
                            bubblingMouseEvents={false}
                            zIndexOffset={
                                selected
                                    ? 1000
                                    : node.kind === 'country'
                                      ? 100
                                      : 0
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
                                        {number.format(
                                            scansAsOf
                                                ? nodeScans
                                                : shown.uniqueScans,
                                        )}{' '}
                                        <CountUnit />
                                    </span>
                                    {sentinelSitesLine(
                                        // A country or cluster adds up its Districts.
                                        'name' in shown
                                            ? shown.sentinelSitesByProgram
                                            : node.sourceDistricts.flatMap(
                                                  district =>
                                                      district.sentinelSitesByProgram,
                                              ),
                                    )}
                                    {coverageLine(shown.coverageByProgram)}
                                    {node.kind === 'country' &&
                                        devicesLine(devices?.get(node.country))}
                                    {stephensiTotal > 0 && (
                                        <span
                                            className={styles.tooltipStephensi}
                                        >
                                            {number.format(stephensiTotal)}{' '}
                                            <i>An. stephensi</i>
                                        </span>
                                    )}
                                    {node.kind !== 'district' &&
                                        (node.kind === 'country' ||
                                            !selected) && (
                                            <span
                                                className={styles.tooltipHint}
                                            >
                                                Mapped reporting areas · Select
                                                to zoom in
                                            </span>
                                        )}
                                </div>
                            </Tooltip>
                        </Marker>
                    );
                })}
            <CountryFills
                districts={districts}
                devices={devices}
                startedCountries={startedCountries}
                countries={countries}
                nodes={countryNodes}
                scansAsOf={scansAsOf}
                selectedCountry={selectedCountry}
                shade={shade}
                onExplore={explore}
                onClearArea={() => onSelect(null)}
                onCountrySelect={
                    onCountrySelect &&
                    (country => {
                        awaitRefocus(map);
                        onCountrySelect(country);
                    })
                }
            />
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
                            html: `<span data-map-label="country" data-started="${startedCountries?.has(label.country) ?? true}">${escapeHtml(label.country)}</span>`,
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
                            html: `<span data-map-label="district" data-district-key="${escapeHtml(label.district.key)}" data-filled="${label.filled}" data-selected="${label.district.key === selectedKey}" data-hovered="${label.district.key === hoveredKey}" style="width:${label.box.width}px;min-height:${label.box.height}px;font-size:${label.fontSize}px">${escapeHtml(label.district.name)}</span>`,
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
                            html: `<span style="width:${label.box.width}px;min-height:${label.box.height}px;font-size:${label.fontSize}px">${escapeHtml(label.area.name)}</span>`,
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

/** A selected area's frame: roomier, and clear of the timeline bar too. */
function selectionFit(map: L.Map): L.FitBoundsOptions {
    const side = map.getSize().x < 520 ? 38 : 72;
    const credit = map.attributionControl?.getContainer()?.offsetHeight ?? 0;
    return {
        paddingTopLeft: [side, 72],
        paddingBottomRight: [side, credit + TIMELINE_CLEARANCE],
    };
}

/** How far apart two touching country names ease. */
const LABEL_EASE_PX = 4;

/**
 * How the whole footprint, or a chosen country, is framed: clear of the
 * timeline bar and the credit under it.
 */
function overviewFit(map: L.Map): L.FitBoundsOptions {
    const side = map.getSize().x < 520 ? 32 : 42;
    const credit = map.attributionControl?.getContainer()?.offsetHeight ?? 0;
    return {
        paddingTopLeft: [side, 48],
        paddingBottomRight: [side, credit + TIMELINE_CLEARANCE],
        maxZoom: 8.5,
    };
}

/** Matches the map pane's fade in the stylesheet. */
const REFOCUS_FADE_MS = 160;
/** A render or two for the new zoom's markers and areas. */
const REFOCUS_SETTLE_MS = 80;
const REFOCUS_TIMERS = new WeakMap<L.Map, number>();

/**
 * Moves to a country or back to the world as Prism does: no flight (far out,
 * a flight shrinks into a map with no tiles yet), but a quick fade out, a jump,
 * and a fade back in. A later call before the jump re-aims it.
 */
function refocus(map: L.Map, bounds: L.LatLngBounds, fit: L.FitBoundsOptions) {
    const container = map.getContainer();
    container.dataset.refocusing = 'true';
    const hold = REFOCUS_HOLDS.get(map);
    if (hold !== undefined) window.clearTimeout(hold);
    REFOCUS_HOLDS.delete(map);
    const pending = REFOCUS_TIMERS.get(map);
    if (pending !== undefined) window.clearTimeout(pending);
    REFOCUS_TIMERS.set(
        map,
        window.setTimeout(() => {
            REFOCUS_TIMERS.delete(map);
            if (!container.isConnected) return;
            withoutLimitPan(map, () =>
                map.fitBounds(bounds, { ...fit, animate: false }),
            );
            // Fade back in once the markers and areas have redrawn for the
            // new zoom, so the old zoom's country shapes don't flash.
            window.setTimeout(() => {
                if (!REFOCUS_TIMERS.has(map))
                    container.dataset.refocusing = 'false';
            }, REFOCUS_SETTLE_MS);
        }, REFOCUS_FADE_MS),
    );
}

const REFOCUS_GIVE_UP_MS = 4000;
const REFOCUS_HOLDS = new WeakMap<L.Map, number>();

/**
 * Fades the map out at once and holds it there until the new data's
 * footprint arrives and `refocus` jumps to it; gives up if it never does.
 */
function awaitRefocus(map: L.Map) {
    const container = map.getContainer();
    container.dataset.refocusing = 'true';
    const pending = REFOCUS_HOLDS.get(map);
    if (pending !== undefined) window.clearTimeout(pending);
    REFOCUS_HOLDS.set(
        map,
        window.setTimeout(() => {
            REFOCUS_HOLDS.delete(map);
            if (!REFOCUS_TIMERS.has(map))
                container.dataset.refocusing = 'false';
        }, REFOCUS_GIVE_UP_MS),
    );
}

/** Already about where `bounds` frames, so a snap goes unnoticed. */
function framesAlready(
    map: L.Map,
    bounds: L.LatLngBounds,
    fit: L.FitBoundsOptions,
) {
    const zoom = map.getBoundsZoom(
        bounds,
        false,
        L.point(fit.paddingTopLeft as L.PointTuple).add(
            L.point(fit.paddingBottomRight as L.PointTuple),
        ),
    );
    return (
        Math.abs(Math.min(zoom, fit.maxZoom ?? zoom) - map.getZoom()) < 0.5 &&
        map.getBounds().contains(bounds.getCenter())
    );
}

/** What the timeline bar and its gaps take from the bottom of the map. */
const TIMELINE_CLEARANCE = 100;
/** Matches the quick colour reset in the stylesheet. */
const REWIND_MS = 300;

/**
 * Runs `move` without Leaflet's animated pan into the pan limit. That pan
 * starts on any move (a resize, or the stop of an earlier pan inside a refit),
 * outlives the refit, and carries the view off-centre (Uganda from stephensi).
 */
function withoutLimitPan(map: L.Map, move: () => void) {
    const enforcing = map as L.Map & { _enforcingBounds?: boolean };
    enforcing._enforcingBounds = true;
    try {
        move();
    } finally {
        enforcing._enforcingBounds = false;
    }
}

/** Keep navigation near the displayed geography without refitting on pan/zoom. */
function setMaxBoundsQuietly(map: L.Map, bounds: L.LatLngBounds) {
    withoutLimitPan(map, () => map.setMaxBounds(bounds));
}

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
            // Room beyond the footprint for the fit's margins (the timeline
            // bar's above all), or the limit pushes a country under the bar.
            setMaxBoundsQuietly(map, bounds.pad(0.5));
            const minZoom = progressMapMinimumZoom(extent!, {
                width: size.x,
                height: size.y,
            });
            // Leaflet would animate up to a raised minimum, and that animation
            // ending would undo a refit made meanwhile (see refocus).
            if (map.getZoom() < minZoom)
                map.setZoom(minZoom, { animate: false });
            map.setMinZoom(minZoom);
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

const WORLD_RING = [
    [-180, -90],
    [180, -90],
    [180, 90],
    [-180, 90],
    [-180, -90],
];

/**
 * Veils the world outside the countries on the map, so the basemap's other
 * place names all but disappear while its land and coasts still show.
 */
function WorldVeil({ countries }: { countries: CountryGeometry[] }) {
    const mask = useMemo(
        () => ({
            type: 'Polygon' as const,
            coordinates: [
                WORLD_RING,
                ...countries.flatMap(country =>
                    country.geometry.coordinates.map(polygon => polygon[0]),
                ),
            ],
        }),
        [countries],
    );
    return (
        <Pane
            name="progressWorldVeil"
            style={{ zIndex: 384, pointerEvents: 'none' }}
        >
            <GeoJSON
                key={countries.map(country => country.country).join(',')}
                data={mask}
                interactive={false}
                style={{
                    stroke: false,
                    fillColor: '#f6f7f6',
                    fillOpacity: WORLD_VEIL_OPACITY,
                    fillRule: 'evenodd',
                }}
            />
        </Pane>
    );
}

/** How much of the basemap outside our countries shows through: 0.35. */
const WORLD_VEIL_OPACITY = 0.65;

/** Washes out the map around a chosen country, so it stands alone. */
function CountryFocus({
    country,
    shown,
}: {
    country: CountryGeometry;
    /** False once the country is left: fades while the world loads. */
    shown: boolean;
}) {
    const map = useMap();
    useEffect(() => {
        const pane = map.getPane('progressCountryFocus');
        if (!pane) return;
        pane.style.transition = 'opacity 400ms ease';
        pane.style.opacity = shown ? '1' : '0';
    }, [map, shown]);
    const mask = useMemo(
        () => ({
            type: 'Polygon' as const,
            coordinates: [
                WORLD_RING,
                ...country.geometry.coordinates.map(polygon => polygon[0]),
            ],
        }),
        [country],
    );
    return (
        <Pane
            name="progressCountryFocus"
            style={{ zIndex: 385, pointerEvents: 'none' }}
        >
            <GeoJSON
                key={country.country}
                data={mask}
                interactive={false}
                style={{
                    className: styles.countryFocus,
                    stroke: false,
                    fillColor: '#f6f7f6',
                    fillOpacity: 0.6,
                    fillRule: 'evenodd',
                }}
            />
        </Pane>
    );
}

/** Refits for a new reporting footprint, while keeping a user's pan and zoom. */
function ReportingFootprint({
    districts,
    countries,
    fills,
    selectedKey,
    selectedCountry,
    playing,
    timelineOpen,
}: {
    districts: ProgressDistrict[];
    countries: CountryGeometry[];
    fills: ProgressDistrictFill[];
    selectedKey: string | null;
    selectedCountry: string | null;
    /** The timeline is running: frame every country as tightly as fits. */
    playing: boolean;
    timelineOpen: boolean;
}) {
    const map = useMap();
    const wasPlaying = useRef(false);
    // Leaving a country fades out at once, before paint: otherwise, while the
    // world's data loads, a wide country (Colombia) shows as one solid shape.
    const lastCountry = useRef(selectedCountry);
    useLayoutEffect(() => {
        if (lastCountry.current && !selectedCountry) awaitRefocus(map);
        lastCountry.current = selectedCountry;
    }, [map, selectedCountry]);
    // Tags give way to the colours and country names on the timeline.
    useEffect(() => {
        map.getContainer().dataset.timeline = String(timelineOpen);
    }, [map, timelineOpen]);
    useEffect(() => {
        const container = map.getContainer();
        if (playing && !wasPlaying.current) {
            // Colours snap back for the restart, then fade at the normal pace.
            container.dataset.rewinding = 'true';
            window.setTimeout(() => {
                container.dataset.rewinding = 'false';
            }, REWIND_MS);
            const credit =
                map.attributionControl?.getContainer()?.offsetHeight ?? 0;
            // A selected area stays in view: play runs where you are.
            const frame = selectedKey
                ? []
                : [
                      ...countries.flatMap(countryFrame),
                      ...districts.flatMap(({ position }) =>
                          position
                              ? [
                                    [
                                        position.latitude,
                                        position.longitude,
                                    ] as L.LatLngTuple,
                                ]
                              : [],
                      ),
                  ];
            if (frame.length > 0) {
                // Aim where the map's limits let it stay, or it flies there
                // and then gets pulled back.
                const continuousMap = map as ContinuousPinchMap;
                const { center, zoom } = continuousMap._getBoundsCenterZoom(
                    L.latLngBounds(frame),
                    {
                        paddingTopLeft: L.point(14, 14),
                        paddingBottomRight: L.point(
                            14,
                            credit + TIMELINE_CLEARANCE,
                        ),
                        maxZoom: 8.5,
                    },
                );
                map.flyTo(
                    continuousMap._limitCenter(
                        center,
                        zoom,
                        map.options.maxBounds as L.LatLngBounds | undefined,
                    ),
                    zoom,
                    { duration: 0.8 },
                );
            }
        }
        wasPlaying.current = playing;
    }, [playing, countries, districts, selectedKey, map]);
    const fitted = useRef<{
        footprint: string;
        width: number;
        height: number;
        country: string | null;
        /** The countries framed, e.g. fewer with the stephensi filter on. */
        countries: string;
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
            // Choosing or leaving a country, or the set of countries changing
            // (the stephensi filter), fades through; other refits snap.
            const framed = countries.map(country => country.country).join(',');
            const moving =
                previous !== null &&
                (previous.country !== selectedCountry ||
                    previous.countries !== framed);
            fitted.current = {
                footprint: target,
                width: size.x,
                height: size.y,
                country: selectedCountry,
                countries: framed,
            };
            if (selectedFill) {
                map.fitBounds(L.geoJSON(selectedFill.geometry).getBounds(), {
                    ...selectionFit(map),
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
                        ...selectionFit(map),
                        maxZoom: 9,
                        animate: false,
                    },
                );
            } else if (points.length > 0 || context.length > 0) {
                // A chosen country is framed by its own outline, not by
                // reporting points that may sit outside it.
                const bounds = L.latLngBounds(
                    selectedCountry && context.length > 0
                        ? context
                        : [...context, ...points],
                );
                // Whole shapes, so a large area isn't framed by its centre.
                for (const fill of fills)
                    bounds.extend(L.geoJSON(fill.geometry).getBounds());
                const fit = overviewFit(map);
                // A fade still under way (its areas landing) is re-aimed.
                if (
                    REFOCUS_TIMERS.has(map) ||
                    REFOCUS_HOLDS.has(map) ||
                    (moving && !framesAlready(map, bounds, fit))
                )
                    refocus(map, bounds, fit);
                else
                    withoutLimitPan(map, () =>
                        map.fitBounds(bounds, { ...fit, animate: false }),
                    );
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
            withoutLimitPan(map, () => map.invalidateSize({ pan: false }));
            fitFootprint();
        });
        observer.observe(map.getContainer());
        return () => {
            observer.disconnect();
        };
    }, [
        districts,
        countries,
        fills,
        selectedKey,
        selectedCountry,
        footprint,
        map,
    ]);

    return null;
}

/** Lets what floats over the map sit above the credits, however they wrap. */
function ShareCreditHeight() {
    const map = useMap();
    useEffect(() => {
        const credit = map.attributionControl?.getContainer();
        const holder = map.getContainer().parentElement;
        if (!credit || !holder) return;
        const observer = new ResizeObserver(() =>
            holder.style.setProperty(
                '--map-credit-height',
                `${credit.offsetHeight}px`,
            ),
        );
        observer.observe(credit);
        return () => observer.disconnect();
    }, [map]);
    return null;
}

/** A click on empty map clears the area, or outside a chosen country, it. */
function ClearSelection({
    onSelect,
    onReturn,
}: {
    onSelect: (key: string | null) => void;
    /** Back to every location; omitted when the map already shows them. */
    onReturn?: () => void;
}) {
    useMapEvents({
        click: () => {
            if (onReturn) onReturn();
            else onSelect(null);
        },
    });
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
    selectedCountry = null,
    onCountrySelect,
    onReturnToGlobal,
    onPlacementChange,
    stephensi,
    stephensiFocused = false,
    scansAsOf,
    playing = false,
    timelineOpen = false,
    stephensiHeat,
    devices,
    startedCountries,
    countUnit = SCANS,
}: {
    districts: ProgressDistrict[];
    /** What `uniqueScans` and `scansAsOf` count; scans unless told otherwise. */
    countUnit?: MapCountUnit;
    /** On the timeline: countries with an upload so far; the rest stay faint. */
    startedCountries?: ReadonlySet<string>;
    /** Active devices per country, for the country tags. */
    devices?: CountryDevices;
    /** The play panel is open: tags step back, even when paused or at the end. */
    timelineOpen?: boolean;
    /** While the timeline is open: soft pink patches instead of `stephensi` dots. */
    stephensiHeat?: StephensiHeatData;
    /** The timeline's scans by District, recolouring areas in place. */
    scansAsOf?: ReadonlyMap<string, number>;
    /** The timeline is playing: the map frames every country. */
    playing?: boolean;
    upcoming?: UpcomingArea[];
    /** Specimens per District key; when given, only these are shaded. */
    stephensi?: ReadonlyMap<string, number>;
    /** Whether the selected District's stephensi view is open. */
    stephensiFocused?: boolean;
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
    /** The country clicked on the map; null for the global view. */
    selectedCountry?: string | null;
    onCountrySelect?: (country: string | null) => void;
    /** A click outside: back to every location, when narrowed. */
    onReturnToGlobal?: () => void;
    onPlacementChange?: (placement: ProgressMapPlacement) => void;
}) {
    const countryKey = [...new Set(districts.map(district => district.country))]
        .toSorted()
        .join('|');
    const [loadedAreas, setLoadedAreas] = useState(() => new Map(AREA_CACHE));
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
    const shade = useMemo<StephensiShade | undefined>(() => {
        const scale = stephensiHeat
            ? { ...stephensiHeat, even: true }
            : stephensi
              ? { counts: stephensi, totals: stephensi, even: false }
              : undefined;
        if (!scale) return undefined;
        const countries = new Set(
            districts
                .filter(district => (scale.totals.get(district.key) ?? 0) > 0)
                .map(district => district.country),
        );
        return { ...scale, countries };
    }, [districts, stephensi, stephensiHeat]);
    const filledKeys = useMemo(
        () => new Set(fills.map(fill => fill.district.key)),
        [fills],
    );
    // The stephensi filter shows where it is: only its areas stay on the map,
    // and the map frames them, not their whole countries. A chosen country
    // keeps all its areas.
    // A chosen country's outline and name show from the first month on the
    // timeline, before its first upload.
    const startedOrChosen = useMemo(
        () =>
            startedCountries && selectedCountry
                ? new Set([...startedCountries, selectedCountry])
                : startedCountries,
        [startedCountries, selectedCountry],
    );
    const stephensiOnly = shade !== undefined && shade.countries.size > 0;
    const { shownDistricts, shownFills } = useMemo(() => {
        if (!stephensiOnly)
            return { shownDistricts: mappedDistricts, shownFills: fills };
        const kept = (district: ProgressDistrict) =>
            (shade.totals.get(district.key) ?? 0) > 0 ||
            district.country === selectedCountry;
        return {
            shownDistricts: mappedDistricts.filter(kept),
            shownFills: fills.filter(row => kept(row.district)),
        };
    }, [stephensiOnly, shade, mappedDistricts, fills, selectedCountry]);
    const countries = useMemo(() => {
        const names = new Set(
            shownDistricts
                .filter(district => district.position !== null)
                .map(district => district.country),
        );
        return COUNTRY_GEOMETRIES.filter(country => names.has(country.country));
    }, [shownDistricts]);

    // Waits for the country's data, so the wash and the flight land together,
    // and stays (fading) after Return until the world's data replaces it.
    const focusedCountry =
        countries.length === 1 &&
        (selectedCountry === null || countries[0].country === selectedCountry)
            ? countries[0]
            : undefined;

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
        <CountUnitContext value={countUnit}>
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
                <WorldVeil countries={countries} />
                {focusedCountry && (
                    <CountryFocus
                        country={focusedCountry}
                        shown={focusedCountry.country === selectedCountry}
                    />
                )}
                <GeographicContext
                    countries={countries}
                    startedCountries={startedOrChosen}
                />
                <ReportingNavigation
                    districts={shownDistricts}
                    countries={countries}
                />
                <ReportingFootprint
                    playing={playing}
                    timelineOpen={timelineOpen}
                    districts={shownDistricts}
                    countries={countries}
                    fills={shownFills}
                    selectedKey={selectedKey}
                    selectedCountry={selectedCountry}
                />
                <UpcomingAreas areas={upcoming} areaLayers={upcomingLayers} />
                <ShareCreditHeight />
                <ClearSelection
                    onSelect={onSelect}
                    onReturn={onReturnToGlobal}
                />
                <FitTooltipsInMap />
                <ReportingActivity
                    districts={shownDistricts}
                    countries={countries}
                    fills={shownFills}
                    attributions={attributions}
                    selectedKey={selectedKey}
                    onSelect={onSelect}
                    selectedCountry={selectedCountry}
                    onCountrySelect={onCountrySelect}
                    scansAsOf={scansAsOf}
                    devices={devices}
                    startedCountries={startedOrChosen}
                    timelineOpen={timelineOpen}
                    shade={shade}
                    upcoming={upcoming}
                    upcomingLayers={upcomingLayers}
                    stephensi={stephensi}
                    stephensiKey={
                        stephensi && stephensiFocused ? selectedKey : null
                    }
                />
                {stephensiHeat && (
                    <StephensiHeat
                        districts={shownDistricts}
                        countries={countries}
                        heat={stephensiHeat}
                        filledKeys={filledKeys}
                    />
                )}
            </MapContainer>
        </CountUnitContext>
    );
}
