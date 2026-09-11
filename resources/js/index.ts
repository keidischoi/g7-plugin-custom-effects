import '../css/effects.css';
import { readInlineConfig, shouldStart, type EffectConfig, type EffectKind } from './config';
import { EffectsEngine } from './engine';
import {
    EFFECTS_PREFERENCE_KEY,
    readEffectsPreference,
    writeEffectsPreference,
} from './preference';
import { enhanceSchedulePickers } from './schedule-fields';
import { activeScheduledEffect, resolveActiveConfig, SCHEDULE_SYNC_MS } from './schedule';
import {
    SETTINGS_POLL_MS,
    listenForSettingsRevision,
    pingSettingsRevision,
    pullRemoteConfig,
    settingsSignature,
    watchAdminSettingsSave,
} from './live-settings';
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

let bootGeneration = 0;
let lastSettingsSignature = '';

function boot(): void {
    const generation = ++bootGeneration;
    window.__g7CustomEffects?.stop();

    const config = readInlineConfig(window);
    lastSettingsSignature = settingsSignature(config);
    const mobileQuery = window.matchMedia('(max-width: 768px), (pointer: coarse)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let userEnabled = readEffectsPreference(window.localStorage);
    let engine: EffectsEngine | null = null;
    let runningEffect: EffectKind | null = null;
    let headerToggle: HeaderToggleMount | null = null;

    const currentEffect = (): EffectKind => activeScheduledEffect(config) ?? config.effect;
    let runningSignature = '';

    const visualSignature = (item: EffectConfig): string => [
        item.effect,
        item.intensity,
        item.speed,
        item.opacity,
        item.wind,
        item.windDirection,
        item.color,
    ].join(':');

    const sync = (): void => {
        const resolved = resolveActiveConfig(config);
        const eligible = userEnabled
            && resolved !== null
            && shouldStart(resolved, {
                pathname: window.location.pathname,
                mobile: mobileQuery.matches,
                reducedMotion: reducedMotionQuery.matches,
            });

        if (!eligible || !resolved) {
            engine?.stop();
            engine = null;
            runningEffect = null;
            runningSignature = '';
            headerToggle?.refresh();
            return;
        }

        const signature = visualSignature(resolved);
        if (engine && runningSignature !== signature) {
            engine.stop();
            engine = null;
        }

        if (!engine) {
            engine = EffectsEngine.start(resolved, window);
            runningEffect = resolved.effect;
            runningSignature = signature;
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
    const isPluginSettingsPage = /\/admin(?:\/[a-z]{2})?(?:\/|$).*plugins/i.test(window.location.pathname)
        || /\/plugins\//i.test(window.location.pathname);
    const unregisterToggleAction = isUserPage && config.enabled
        ? registerToggleAction(window, toggle)
        : () => {};
    headerToggle = isUserPage && config.enabled
        ? new HeaderToggleMount(
            window,
            currentEffect,
            () => userEnabled,
            toggle,
            () => engine !== null,
        )
        : null;
    headerToggle?.start();
    const stopSchedulePickers = !isUserPage && isPluginSettingsPage
        ? enhanceSchedulePickers(window)
        : () => {};

    mobileQuery.addEventListener('change', sync);
    reducedMotionQuery.addEventListener('change', sync);
    window.addEventListener('popstate', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', sync);
    const scheduleTimer = window.setInterval(sync, SCHEDULE_SYNC_MS);

    const pullSettings = async (): Promise<void> => {
        if (generation !== bootGeneration) return;
        const next = await pullRemoteConfig(window);
        if (!next || generation !== bootGeneration) return;
        const signature = settingsSignature(next);
        if (signature === lastSettingsSignature) return;
        lastSettingsSignature = signature;
        boot();
    };

    const settingsTimer = window.setInterval(pullSettings, SETTINGS_POLL_MS);
    const stopRevisionListener = listenForSettingsRevision(window, () => {
        void pullSettings();
    });
    const stopAdminSaveWatch = isPluginSettingsPage
        ? watchAdminSettingsSave(window, () => {
            pingSettingsRevision(window);
            void pullSettings();
        })
        : () => {};

    window.__g7CustomEffects = {
        stop: () => {
            mobileQuery.removeEventListener('change', sync);
            reducedMotionQuery.removeEventListener('change', sync);
            window.removeEventListener('popstate', sync);
            window.removeEventListener('focus', sync);
            window.removeEventListener('storage', handleStorage);
            document.removeEventListener('visibilitychange', sync);
            window.clearInterval(scheduleTimer);
            window.clearInterval(settingsTimer);
            stopRevisionListener();
            stopAdminSaveWatch();
            unregisterToggleAction();
            headerToggle?.stop();
            stopSchedulePickers();
            engine?.stop();
            engine = null;
        },
    };

    sync();
    void pullSettings();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
