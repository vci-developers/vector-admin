import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const ITEM =
    'text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground h-7 cursor-pointer rounded-full px-3 text-xs data-[state=on]:shadow-sm';

/** Switches the chart panel between every species and An. stephensi only. */
export default function ProgressSpeciesToggle({
    stephensi,
    onChange,
}: {
    stephensi: boolean;
    onChange: (stephensi: boolean) => void;
}) {
    return (
        <ToggleGroup
            type="single"
            size="sm"
            spacing={1}
            value={stephensi ? 'stephensi' : 'all'}
            // Radix sends '' when the pressed item is clicked again; keep it.
            onValueChange={value => value && onChange(value === 'stephensi')}
            aria-label="Species shown"
            className="bg-muted/70 shrink-0 rounded-full p-1"
        >
            <ToggleGroupItem value="all" className={ITEM}>
                All species
            </ToggleGroupItem>
            <ToggleGroupItem
                value="stephensi"
                className={`${ITEM} italic data-[state=on]:text-(--progress-stephensi)`}
            >
                An. stephensi
            </ToggleGroupItem>
        </ToggleGroup>
    );
}
