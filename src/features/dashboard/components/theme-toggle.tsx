'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    THEME_STORAGE_KEY,
    type ThemeChoice,
} from '@/features/dashboard/utils/theme-script';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';

const CHOICES = [
    { value: 'system', Icon: Monitor },
    { value: 'light', Icon: Sun },
    { value: 'dark', Icon: Moon },
] as const;

function readChoice(): ThemeChoice {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
        return 'system';
    }
}

function subscribe(onChange: () => void) {
    window.addEventListener('themechange', onChange);
    return () => window.removeEventListener('themechange', onChange);
}

/** System, Light or Dark; saved per browser and applied by themeScript. */
export default function ThemeToggle() {
    const t = useTranslations('App.theme');
    // The server can't know the saved choice, so hydration shows System.
    const choice = useSyncExternalStore(subscribe, readChoice, () => 'system');

    function choose(value: string) {
        if (!value) return;
        try {
            if (value === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
            else localStorage.setItem(THEME_STORAGE_KEY, value);
        } catch {
            // Storage blocked (private mode): the choice lasts until reload.
        }
        document.documentElement.dataset.theme =
            value === 'system'
                ? matchMedia('(prefers-color-scheme: dark)').matches
                    ? 'dark'
                    : 'light'
                : value;
        window.dispatchEvent(new Event('themechange'));
    }

    return (
        <ToggleGroup
            type="single"
            size="sm"
            value={choice}
            onValueChange={choose}
            aria-label={t('label')}
        >
            {CHOICES.map(({ value, Icon }) => (
                <ToggleGroupItem
                    key={value}
                    value={value}
                    aria-label={t(value)}
                >
                    <Icon aria-hidden="true" />
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}
