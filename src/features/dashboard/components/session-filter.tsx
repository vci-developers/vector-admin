'use client';

import { sessionTypeSchema } from '@/api/session/validation/session-schema';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

const SESSION_TYPES = sessionTypeSchema.options;

/** The page-wide Session filter: which Session types, and the Test Site. */
export default function SessionFilter() {
    const t = useTranslations('Filters');
    const tTypes = useTranslations('SessionTypes');
    const [{ types, testSites }, setFilters] = useDashboardFilters();

    function toggle(type: (typeof SESSION_TYPES)[number]) {
        setFilters({
            types: types.includes(type)
                ? types.filter(selected => selected !== type)
                : SESSION_TYPES.filter(
                      option => option === type || types.includes(option),
                  ),
        });
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                    {types.length === 1
                        ? tTypes(types[0])
                        : t('sessionTypesSummary', { count: types.length })}
                    {testSites && ` · ${t('withTestSite')}`}
                    <ChevronDown />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
                <span
                    id="session-filter-legend"
                    className="text-muted-foreground block pb-1 pl-2 text-xs font-medium"
                >
                    {t('sessionTypes')}
                </span>
                <div
                    role="group"
                    aria-labelledby="session-filter-legend"
                    className="flex flex-col"
                >
                    {SESSION_TYPES.map(type => (
                        <label
                            key={type}
                            className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors select-none"
                        >
                            <Checkbox
                                checked={types.includes(type)}
                                onCheckedChange={() => toggle(type)}
                            />
                            {tTypes(type)}
                        </label>
                    ))}
                </div>
                <label className="hover:bg-muted mt-1 flex cursor-pointer items-start gap-2 rounded-md border-t px-2 py-1.5 pt-2 text-sm transition-colors select-none">
                    <Checkbox
                        className="mt-0.5"
                        checked={testSites}
                        onCheckedChange={checked =>
                            setFilters({ testSites: checked === true })
                        }
                    />
                    <span className="flex flex-col">
                        {t('includeTestSite')}
                        <span className="text-muted-foreground text-xs">
                            {t('testSiteHint')}
                        </span>
                    </span>
                </label>
                <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 w-full"
                    onClick={() => setFilters({ types: null, testSites: null })}
                >
                    {t('resetSessions')}
                </Button>
            </PopoverContent>
        </Popover>
    );
}
