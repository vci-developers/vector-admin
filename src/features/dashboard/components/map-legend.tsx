import { SEVERITY_STEPS } from '@/features/dashboard/utils/specimen-severity';
import { useTranslations } from 'next-intl';
import {
    ACTIVE_COLOR,
    IDLE_COLOR,
    ZERO_CATCH_COLOR,
    type MapLayer,
} from './map-constants';

export default function MapLegend({ layers }: { layers: MapLayer[] }) {
    const t = useTranslations('MapSection');
    const ranges = SEVERITY_STEPS.map((step, index) => {
        const next = SEVERITY_STEPS[index + 1];
        return {
            ...step,
            label: next ? `${step.min}–${next.min - 1}` : `${step.min}+`,
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
                        {t('legendSpecimensTitle')}
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
                        <li className="flex items-center gap-1">
                            <span
                                aria-hidden="true"
                                className="size-3 rounded-[3px]"
                                style={{ background: IDLE_COLOR }}
                            />
                            {t('legendInactive')}
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}
