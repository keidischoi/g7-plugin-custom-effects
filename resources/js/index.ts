import '../css/effects.css';
import { readInlineConfig, shouldStart, type EffectKind } from './config';
import { EffectsEngine } from './engine';
import {
    EFFECTS_PREFERENCE_KEY,
    readEffectsPreference,
    writeEffectsPreference,
} from './preference';
import { enhanceSchedulePickers } from './schedule-fields';
import { activeScheduledEffect } from './schedule';
import {
    HeaderToggleMount,
    PREFERENCE_EVENT,
    registerToggleAction,
} from './toggle-button';

interface EffectsRuntime {
    stop: () => void;
}

declare global {
    interface Window {
        __g7CustomEffects?: EffectsRuntime;
    }
}

function boot(): void {
    window.__g7CustomEffects?.stop();

    const config = readInlineConfig(window);
    const mobileQuery = window.matchMedia('(max-width: 768px), (pointer: coarse)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let userEnabled = readEffectsPreference(window.localStorage);
    let engine: EffectsEngine | null = null;
    let runningEffect: EffectKind | null = null;
    let headerToggle: HeaderToggleMount | null = null;

    const currentEffect = (): EffectKind => activeScheduledEffect(config) ?? config.effect;

    const sync = (): void => {
        const scheduledEffect = activeScheduledEffect(config);
        const eligible = userEnabled
            && scheduledEffect !== null
            && shouldStart(config, {
                pathname: window.location.pathname,
                mobile: mobileQuery.matches,
                reducedMotion: reducedMotionQuery.matches,
            });

        if (!eligible) {
            engine?.stop();
            engine = null;
            runningEffect = null;
            headerToggle?.refresh();
            return;
        }

        if (engine && runningEffect !== scheduledEffect) {
            engine.stop();
            engine = null;
        }

        if (!engine) {
            engine = EffectsEngine.start({ ...config, effect: scheduledEffect }, window);
            runningEffect = scheduledEffect;
        }

        headerToggle?.refresh();
    };

    const notifyPreferenceChange = (): void => {
        window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, {
            detail: { enabled: userEnabled },
        }));
    };

    const toggle = (): boolean => {
        userEnabled = !userEnabled;
        writeEffectsPreference(window.localStorage, userEnabled);
        sync();
        notifyPreferenceChange();
        return userEnabled;
    };

    const handleStorage = (event: StorageEvent): void => {
        if (event.key !== EFFECTS_PREFERENCE_KEY) return;
        userEnabled = readEffectsPreference(window.localStorage);
        sync();
        notifyPreferenceChange();
    };

    const isUserPage = !/^\/(?:[a-z]{2}\/)?admin(?:\/|$)/i.test(window.location.pathname);
    const unregisterToggleAction = isUserPage && config.enabled
        ? registerToggleAction(window, toggle)
        : () => {};
    headerToggle = isUserPage && config.enabled
        ? new HeaderToggleMount(window, currentEffect, () => userEnabled, toggle)
        : null;
    headerToggle?.start();
    const stopSchedulePickers = isUserPage ? () => {} : enhanceSchedulePickers(window);

    mobileQuery.addEventListener('change', sync);
    reducedMotionQuery.addEventListener('change', sync);
    window.addEventListener('popstate', sync);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', sync);
    const scheduleTimer = window.setInterval(sync, 30_000);

    window.__g7CustomEffects = {
        stop: () => {
            mobileQuery.removeEventListener('change', sync);
            reducedMotionQuery.removeEventListener('change', sync);
            window.removeEventListener('popstate', sync);
            window.removeEventListener('storage', handleStorage);
            document.removeEventListener('visibilitychange', sync);
            window.clearInterval(scheduleTimer);
            unregisterToggleAction();
            headerToggle?.stop();
            stopSchedulePickers();
            engine?.stop();
            engine = null;
        },
    };

    sync();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
