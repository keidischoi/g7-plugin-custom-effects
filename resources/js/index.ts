import '../css/effects.css';
import { readInlineConfig, shouldStart, type EffectConfig, type EffectKind } from './config';
import { EffectsEngine } from './engine';
import {
    EFFECTS_PREFERENCE_KEY,
    readEffectsPreference,
    writeEffectsPreference,
} from './preference';
import { mouseSignature, readMouseConfig } from './mouse-config';
import { startMouseEffects } from './mouse-runtime';
import { enhanceSchedulePickers } from './schedule-fields';
import { activeScheduledEffect, resolveActiveConfig, SCHEDULE_SYNC_MS } from './schedule';
import {
    SETTINGS_POLL_MS,
    createSettingsPuller,
    hasInlineSettings,
    listenForSettingsRevision,
    pingSettingsRevision,
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
// 1.1.2: 다시 부팅(설정 바뀜)해도 확인 간격·진행 중 요청을 이어 씀 → 부팅마다 새로 묻지 않음
const settingsPuller = createSettingsPuller(window);
const INITIAL_CHECK_DELAY_MS = 10_000;

function combinedSignature(config: EffectConfig): string {
    return `${settingsSignature(config)}|${mouseSignature(readMouseConfig(window))}`;
}

function boot(): void {
    const generation = ++bootGeneration;
    window.__g7CustomEffects?.stop();

    const config = readInlineConfig(window);
    lastSettingsSignature = combinedSignature(config);
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
    const mouseRuntime = startMouseEffects(window, { userPage: isUserPage });
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

    const pullSettings = async (force = false): Promise<void> => {
        if (generation !== bootGeneration) return;
        const next = await settingsPuller.pull(force);
        if (!next || generation !== bootGeneration) return;
        const signature = combinedSignature(next);
        if (signature === lastSettingsSignature) return;
        lastSettingsSignature = signature;
        boot();
    };

    const settingsTimer = window.setInterval(() => { void pullSettings(); }, SETTINGS_POLL_MS);
    // 탭으로 돌아오면 (마지막 확인이 오래됐을 때만) 한 번
    const onVisible = (): void => {
        if (!document.hidden) void pullSettings();
    };
    document.addEventListener('visibilitychange', onVisible);
    const stopRevisionListener = listenForSettingsRevision(window, () => {
        void pullSettings(true);
    });
    const stopAdminSaveWatch = isPluginSettingsPage
        ? watchAdminSettingsSave(window, () => {
            pingSettingsRevision(window);
            void pullSettings(true);
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
            document.removeEventListener('visibilitychange', onVisible);
            stopRevisionListener();
            stopAdminSaveWatch();
            unregisterToggleAction();
            headerToggle?.stop();
            mouseRuntime.stop();
            stopSchedulePickers();
            engine?.stop();
            engine = null;
        },
    };

    sync();
    // 페이지에 실린 설정(G7Config)으로 바로 그리고, 첫 화면이 다 뜬 뒤(10초)에 한 번만 확인 — 첫 화면 요청을 늘리지 않음.
    // 실린 설정이 없을 때만 바로 한 번.
    if (settingsPuller.lastAt() === 0) {
        if (!hasInlineSettings(window)) void pullSettings(true);
        else window.setTimeout(() => { void pullSettings(); }, INITIAL_CHECK_DELAY_MS);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
