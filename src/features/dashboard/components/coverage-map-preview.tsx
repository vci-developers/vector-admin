'use client';

import type {
    CountryOutlineDto,
    CoverageFillDto,
} from '@/api/coverage/validation/coverage-schema';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import MapLegend from './map-legend';

// Leaflet touches window on import.
const SurveillanceMap = dynamic(() => import('./surveillance-map'), {
    ssr: false,
});

const NO_SESSIONS = new Map();
const NO_PROGRAMS = new Map();

/** The coverage fills alone, shown while Sessions and devices load. */
export default function CoverageMapPreview({
    fills,
    outlines,
}: {
    fills: CoverageFillDto[];
    outlines: CountryOutlineDto[];
}) {
    const t = useTranslations('Dashboard');
    return (
        <>
            <SurveillanceMap
                layers={['coverage']}
                coverageFills={fills}
                outlines={outlines}
                specimenPoints={[]}
                devices={[]}
                sessionsByDevice={NO_SESSIONS}
                programs={NO_PROGRAMS}
                fitKey="preview"
                dataKey="preview"
                selection={null}
                onSelect={() => {}}
                onSelectUnit={() => {}}
                focus={null}
                showSessions={false}
                byArea={false}
            />
            <p className="bg-card/95 absolute top-3 right-3 z-[1000] flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs shadow-sm">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                {t('loadingPoints')}
            </p>
            <MapLegend byArea={false} layers={['coverage']} />
        </>
    );
}
