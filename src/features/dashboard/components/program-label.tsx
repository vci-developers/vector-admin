import type { Program } from '@/api/program/validation/program-schema';
import { cn } from '@/utils/cn';

type ProgramLabelProps = {
    program: Pick<Program, 'name' | 'country'> | undefined;
    className?: string;
};

/** A Program as shown everywhere: its country, with the Program name below. */
export default function ProgramLabel({
    program,
    className,
}: ProgramLabelProps) {
    if (!program) return null;
    return (
        <span className={cn('flex min-w-0 flex-col', className)}>
            <span>{program.country || program.name}</span>
            {program.country && (
                <span className="text-muted-foreground text-xs">
                    {program.name}
                </span>
            )}
        </span>
    );
}
