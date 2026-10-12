import { cn } from '@/utils/cn';
import { ChevronDown } from 'lucide-react';

/**
 * The keyboard control for a headline tile; the tile itself handles the
 * click, which this button's own click bubbles to.
 */
export default function HeadlineExpandButton({
    title,
    expanded,
}: {
    title: string;
    expanded: boolean;
}) {
    return (
        <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} ${title} details`}
            className="focus-visible:ring-ring absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-md px-2 opacity-60 transition-opacity outline-none group-hover:opacity-100 focus-visible:ring-2"
        >
            <ChevronDown
                className={cn(
                    'size-5 transition-transform',
                    expanded && 'rotate-180',
                )}
                aria-hidden="true"
            />
        </button>
    );
}
