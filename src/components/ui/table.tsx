'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';

function Table({
    className,
    containerClassName,
    ...props
}: React.ComponentProps<'table'> & { containerClassName?: string }) {
    return (
        <div
            data-slot="table-container"
            className={cn(
                'relative w-full overflow-x-auto',
                containerClassName,
            )}
        >
            <table
                data-slot="table"
                className={cn(
                    // Room for overlay scrollbars, which draw over content. A
                    // margin, not container padding, so sticky footers stay flush.
                    'mb-2 w-full caption-bottom text-sm [&_tr>:first-child]:pl-3 [&_tr>:last-child]:pr-4',
                    className,
                )}
                {...props}
            />
        </div>
    );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
    return (
        <thead
            data-slot="table-header"
            className={cn('[&_tr]:border-b', className)}
            {...props}
        />
    );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
    return (
        <tbody
            data-slot="table-body"
            className={cn('[&_tr:last-child]:border-0', className)}
            {...props}
        />
    );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
    return (
        <tfoot
            data-slot="table-footer"
            className={cn(
                // Extra bottom room: a sticky footer sits under the overlay
                // horizontal scrollbar while the table scrolls sideways.
                'bg-muted/50 border-t font-medium [&_td]:pb-4 [&>tr]:last:border-b-0',
                className,
            )}
            {...props}
        />
    );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
    return (
        <tr
            data-slot="table-row"
            className={cn(
                'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
                className,
            )}
            {...props}
        />
    );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
    return (
        <th
            data-slot="table-head"
            className={cn(
                'text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0',
                className,
            )}
            {...props}
        />
    );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
    return (
        <td
            data-slot="table-cell"
            className={cn(
                'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0',
                className,
            )}
            {...props}
        />
    );
}

function TableCaption({
    className,
    ...props
}: React.ComponentProps<'caption'>) {
    return (
        <caption
            data-slot="table-caption"
            className={cn('text-muted-foreground mt-4 text-sm', className)}
            {...props}
        />
    );
}

export {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
};
