import '../css/effects.css';
import { readInlineConfig, shouldStart } from './config';
import { EffectsEngine } from './engine';
import {
    EFFECTS_PREFERENCE_KEY,
    readEffectsPreference,
    writeEffectsPreference,
} from './preference';
import { isScheduleActive } from './schedule';
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

    const sync = (): void => {
        const eligible = userEnabled && isScheduleActive(config) && shouldStart(config, {
            pathname: window.location.pathname,
            mobile: mobileQuery.matches,
            reducedMotion: reducedMotionQuery.matches,
        });

        if (eligible && !engine) engine = EffectsEngine.start(config, window);
        if (!eligible && engine) {
            engine.stop();
            engine = null;
        }
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
    const headerToggle = isUserPage && config.enabled
        ? new HeaderToggleMount(window, config.effect, () => userEnabled, toggle)
        : null;
    headerToggle?.start();

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
