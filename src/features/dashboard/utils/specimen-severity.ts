export type SeverityStep = {
    /** Smallest specimen count in this step. */
    min: number;
    fill: string;
    /** Label colour that stays readable on `fill`. */
    text: string;
};

// One-hue sequential red ramp, light to dark as counts rise.
export const SEVERITY_STEPS: SeverityStep[] = [
    { min: 1, fill: '#fca5a5', text: '#450a0a' },
    { min: 5, fill: '#f87171', text: '#450a0a' },
    { min: 20, fill: '#dc2626', text: '#ffffff' },
    { min: 50, fill: '#991b1b', text: '#ffffff' },
];

/** null for zero-catch Sessions, which the map draws hollow. */
export function specimenSeverity(count: number): SeverityStep | null {
    return SEVERITY_STEPS.findLast(step => count >= step.min) ?? null;
}
