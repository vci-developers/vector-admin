'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { Card } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    listDeployedModels,
    versionLabels,
    type DeployedModel,
} from '@/features/dashboard/utils/deployed-models';
import { cn } from '@/utils/cn';
import { useTranslations } from 'next-intl';
import { SUMMARY_CELL } from './kpi-tiles';
import { InfoTip } from './metric-info';

/**
 * One build's version; hover or focus for where each of the Program's builds
 * runs (this one in bold), then this build's model and classes.
 */
function VersionLabel({
    model,
    models,
    label,
    country,
    className,
}: {
    model: DeployedModel;
    models: DeployedModel[];
    label: string;
    country: string;
    className?: string;
}) {
    const t = useTranslations('DeployedModels');
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'focus-visible:ring-ring/50 rounded-sm font-semibold whitespace-nowrap tabular-nums underline decoration-dotted decoration-1 underline-offset-4 outline-none focus-visible:ring-[3px]',
                        className,
                    )}
                >
                    {label}
                </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-72 text-left">
                <ul className="mb-1">
                    {models.map(build => (
                        <li
                            key={build.version}
                            className={cn(
                                build === model ? 'font-medium' : 'opacity-80',
                            )}
                        >
                            {t('deployedIn', {
                                version: build.version,
                                place: build.areas?.join(', ') ?? country,
                            })}
                        </li>
                    ))}
                </ul>
                <p>{model.model}</p>
                <p className="opacity-80">
                    {t('classes', { count: model.classes.length })}:{' '}
                    {model.classes.join(', ')}
                </p>
            </TooltipContent>
        </Tooltip>
    );
}

/**
 * The app version each shown Program runs, from its latest release notes.
 * One Program: its version as the tile's figure. Several: a chip each, coded
 * by country, wrapping across the tile so it stays as short as the others.
 */
export default function DeployedModelsTile({
    programs,
}: {
    programs: Program[];
}) {
    const t = useTranslations('DeployedModels');
    const rows = listDeployedModels(programs);
    const single = rows.length === 1;

    return (
        <Card className={SUMMARY_CELL}>
            <p className="text-muted-foreground text-xs font-medium text-pretty">
                {t('title')}{' '}
                <InfoTip label={t('about')}>
                    <p>{t('description')}</p>
                </InfoTip>
            </p>
            {rows.length === 0 ? (
                <p className="text-muted-foreground self-end text-xs">
                    {t('none')}
                </p>
            ) : (
                <TooltipProvider delayDuration={150}>
                    <ul
                        className={cn(
                            'flex flex-wrap items-baseline',
                            // One Program's version is the tile's figure;
                            // several Programs' chips sit under the figures.
                            single
                                ? 'self-end text-2xl'
                                : 'row-start-3 content-start gap-1 self-start text-xs',
                        )}
                    >
                        {rows.map(({ program, code, models }) => (
                            <li
                                key={program.programId}
                                className={cn(
                                    'flex flex-wrap items-baseline gap-x-1.5',
                                    !single && 'rounded border px-1.5 py-0.5',
                                )}
                            >
                                {!single && (
                                    <span className="text-muted-foreground">
                                        {code}
                                    </span>
                                )}
                                {versionLabels(models).map((label, index) => (
                                    <VersionLabel
                                        key={label}
                                        model={models[index]}
                                        models={models}
                                        label={label}
                                        country={
                                            program.country || program.name
                                        }
                                        // As a figure, a variant sits small
                                        // beside it, like a tile's working.
                                        className={
                                            single && index > 0
                                                ? 'text-muted-foreground text-xs font-medium'
                                                : undefined
                                        }
                                    />
                                ))}
                            </li>
                        ))}
                    </ul>
                </TooltipProvider>
            )}
        </Card>
    );
}
