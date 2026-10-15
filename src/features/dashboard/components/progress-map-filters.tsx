import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { SlidersHorizontal } from 'lucide-react';
import ProgressMapSwitch from './progress-map-switch';

/** The Stakeholder map's filters, behind one button on the map. */
export default function ProgressMapFilters({
    stephensi,
    onStephensiChange,
    upcoming,
    onUpcomingChange,
}: {
    /** Null when no selected Program can detect it. */
    stephensi: boolean | null;
    onStephensiChange: (shown: boolean) => void;
    upcoming: boolean;
    onUpcomingChange: (shown: boolean) => void;
}) {
    const onCount = Number(Boolean(stephensi)) + Number(upcoming);

    return (
        <Popover>
            <PopoverTrigger asChild>
                {/* Sits on the map: solid in dark mode too, like the other overlays. */}
                <Button
                    variant="outline"
                    size="sm"
                    className="dark:bg-card/95 dark:hover:bg-accent shadow-sm"
                >
                    <SlidersHorizontal />
                    Filters
                    {onCount > 0 && (
                        <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs tabular-nums">
                            {onCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                collisionPadding={8}
                className="flex w-64 flex-col gap-1 p-2"
            >
                {stephensi !== null && (
                    <ProgressMapSwitch
                        id="progress-stephensi-toggle-label"
                        checked={stephensi}
                        onToggle={() => onStephensiChange(!stephensi)}
                    >
                        Show <span className="italic">An. stephensi</span>
                    </ProgressMapSwitch>
                )}
                <ProgressMapSwitch
                    id="progress-target-toggle-label"
                    checked={upcoming}
                    onToggle={() => onUpcomingChange(!upcoming)}
                >
                    Show upcoming locations
                </ProgressMapSwitch>
            </PopoverContent>
        </Popover>
    );
}
