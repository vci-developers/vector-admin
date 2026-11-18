import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import { isStephensi } from './stephensi-totals';

/** The series key of specimens with no species: calibration ones. */
export const CALIBRATION_SPECIES = 'calibration';

/**
 * Paul Tol's discrete rainbow, as published, as `--progress-rainbow-N`. The
 * first ten are his ten-colour set; the rest come from the same scheme.
 */
const RAINBOW_SIZE = 17;

/**
 * Species seen so far keep one colour whatever else is shown, so a filter
 * never repaints them. Keys are lower-case, "An." spelled out.
 */
const KNOWN_SPECIES: Record<string, number> = {
    'anopheles gambiae': 1,
    culex: 2,
    mansonia: 3,
    'anopheles funestus': 4,
    'non-mosquito': 5,
    'anopheles other': 6,
    aedes: 7,
    'aedes aegypti': 8,
    'anopheles albimanus': 9,
    'aedes albopictus': 10,
};

function knownSpeciesKey(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/^an\.\s*/, 'anopheles ')
        .replace(/^ae\.\s*/, 'aedes ')
        .replace(/^cx\.\s*/, 'culex ');
}

export type SpeciesSeries = {
    /** The species name, or CALIBRATION_SPECIES. */
    key: string;
    name: string;
    stephensi: boolean;
};

export type SpeciesMonth = {
    month: string;
    /** Specimens per series key; series with none are left out. */
    specimens: Record<string, number>;
};

/** The series a species name is drawn in. */
export function seriesKeyOf(name: string | null): string {
    return name ?? CALIBRATION_SPECIES;
}

/**
 * Specimens per species per month for the chart's stacked bars, one series
 * per species, most specimens first, with calibration specimens last.
 */
export function buildSpeciesMonths(
    districts: readonly ProgressDistrict[],
    months: readonly string[],
): { series: SpeciesSeries[]; months: SpeciesMonth[] } {
    const totals = new Map<string | null, number>();
    const byMonth = new Map(
        months.map(month => [month, {} as Record<string, number>]),
    );
    for (const district of districts)
        for (const row of district.speciesMonthly) {
            const counts = byMonth.get(row.month);
            if (!counts) continue;
            for (const { name, specimens } of row.species) {
                if (specimens <= 0) continue;
                const key = seriesKeyOf(name);
                counts[key] = (counts[key] ?? 0) + specimens;
                totals.set(name, (totals.get(name) ?? 0) + specimens);
            }
        }

    const series = [...totals]
        .sort(
            (a, b) =>
                Number(a[0] === null) - Number(b[0] === null) ||
                b[1] - a[1] ||
                (a[0] ?? '').localeCompare(b[0] ?? ''),
        )
        .map(([name]) => ({
            key: seriesKeyOf(name),
            name: name ?? 'Calibration specimens',
            stephensi: name !== null && isStephensi(name),
        }));

    return {
        series,
        months: [...byMonth].map(([month, specimens]) => ({
            month,
            specimens,
        })),
    };
}

export type ColoredSeries = SpeciesSeries & { color: string };

/**
 * Stephensi keeps its own colour and calibration and catch-all species take
 * neutrals. A known species has its fixed rainbow colour; a new one takes the
 * first rainbow colour not in use, so none repeats until all are taken.
 */
export function colorSpeciesSeries(
    series: readonly SpeciesSeries[],
): ColoredSeries[] {
    const fixed = series.map(
        row => KNOWN_SPECIES[knownSpeciesKey(row.name)] as number | undefined,
    );
    const used = new Set(fixed.filter(index => index !== undefined));
    let spare = 0;
    const nextSpare = () => {
        do spare++;
        while (used.has(spare) && spare < RAINBOW_SIZE);
        used.add(spare);
        return ((spare - 1) % RAINBOW_SIZE) + 1;
    };
    return series.map((row, position) => {
        if (row.stephensi)
            return { ...row, color: 'var(--progress-stephensi)' };
        if (row.key === CALIBRATION_SPECIES)
            return { ...row, color: 'var(--progress-species-calibration)' };
        if (/^(other|unknown)$/i.test(row.name.trim()))
            return { ...row, color: 'var(--progress-species-other)' };
        const index = fixed[position] ?? nextSpare();
        return { ...row, color: `var(--progress-rainbow-${index})` };
    });
}
