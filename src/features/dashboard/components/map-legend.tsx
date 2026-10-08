import { COVERAGE_STATUSES } from '@/features/dashboard/utils/parse-coverage-sheets';
import {
    AREA_SEVERITY_STEPS,
    SEVERITY_STEPS,
} from '@/features/dashboard/utils/specimen-severity';
import { useFormatter, useTranslations } from 'next-intl';
import {
    ACTIVE_COLOR,
    COVERAGE_STYLES,
    ZERO_CATCH_COLOR,
    type MapLayer,
} from './map-constants';

export default function MapLegend({
    layers,
    byArea,
}: {
    layers: MapLayer[];
    /** Specimens are drawn per Area, on the Area scale. */
    byArea: boolean;
}) {
    const t = useTranslations('MapSection');
    const formatter = useFormatter();
    const steps = byArea ? AREA_SEVERITY_STEPS : SEVERITY_STEPS;
    const ranges = steps.map((step, index) => {
        const next = steps[index + 1];
        return {
            ...step,
            label: next
                ? `${formatter.number(step.min)}–${formatter.number(next.min - 1)}`
                : `${formatter.number(step.min)}+`,
        };
    });

    return (
        <div
            aria-label={t('legend')}
            className="bg-card/90 absolute bottom-3 left-3 z-[1000] flex flex-col gap-2 rounded-md border px-3 py-2 text-xs shadow-sm"
        >
            {layers.includes('specimens') && (
                <div>
                    <p className="mb-1 font-medium">
                        {t(
                            byArea
                                ? 'legendSpecimensAreaTitle'
                                : 'legendSpecimensTitle',
                        )}
                    </p>
                    <ul className="flex items-center gap-2">
                        <li className="flex items-center gap-1">
                            <span
                                aria-hidden="true"
                                className="size-3 rounded-full border-2 bg-white"
                                style={{ borderColor: ZERO_CATCH_COLOR }}
                            />
                            0
                        </li>
                        {ranges.map(range => (
                            <li
                                key={range.min}
                                className="flex items-center gap-1"
                            >
                                <span
                                    aria-hidden="true"
                                    className="size-3 rounded-full"
                                    style={{ background: range.fill }}
                                />
                                {range.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {layers.includes('devices') && (
                <div>
                    <p className="mb-1 font-medium">
                        {t('legendDevicesTitle')}
                    </p>
                    <ul className="flex items-center gap-3">
                        <li className="flex items-center gap-1">
                            <span
                                aria-hidden="true"
                                className="size-3 rounded-[3px]"
                                style={{ background: ACTIVE_COLOR }}
                            />
                            {t('legendActive')}
                        </li>
                    </ul>
                </div>
            )}
            {layers.includes('coverage') && (
                <div>
                    <p className="mb-1 font-medium">
                        {t('legendCoverageTitle')}
                    </p>
                    <ul className="flex max-w-56 flex-col gap-1.5">
                        {COVERAGE_STATUSES.map(status => {
                            const { color, fillOpacity } =
                                COVERAGE_STYLES[status];
                            return (
                                <li key={status} className="flex gap-1.5">
                                    <span
                                        aria-hidden="true"
                                        // Level with the label's first line.
                                        className="relative mt-px size-3 shrink-0 overflow-hidden rounded-[2px] border-2"
                                        style={{ borderColor: color }}
                                    >
                                        <span
                                            className="absolute inset-0"
                                            style={{
                                                background: color,
                                                opacity: fillOpacity,
                                            }}
                                        />
                                    </span>
                                    <span className="flex flex-col">
                                        {t(`coverageStatus.${status}`)}
                                        <span className="text-muted-foreground text-[11px] leading-tight">
                                            {t(`coverageStatusHint.${status}`)}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            {/* Area marks sit at their Sessions' mean, never at a Site. */}
            {(!byArea || layers.includes('devices')) && (
                <p className="flex items-center gap-1">
                    <span
                        aria-hidden="true"
                        className="size-3 rounded-full border-2 border-dashed border-gray-800"
                    />
                    {t('legendBySite')}
                </p>
            )}
        </div>
    );
}
