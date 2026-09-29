import { readMouseConfig, resolveMouseConfig, type MouseConfig } from './mouse-config';
import { MouseEffectsEngine } from './mouse-engine';
import {
    MOUSE_PREFERENCE_EVENT,
    MOUSE_PREFERENCE_KEY,
    MouseToggleMount,
    readMousePreference,
    registerMouseToggleAction,
    writeMousePreference,
} from './mouse-toggle';
import { SCHEDULE_SYNC_MS } from './schedule';

export interface MouseRuntime {
    stop: () => void;
}

/** Media query for devices without a precise hovering pointer (phones, tablets). */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

export function shouldRunMouseEffect(
    config: MouseConfig | null,
    options: { userEnabled: boolean; userPage: boolean; coarse: boolean; reducedMotion: boolean },
): config is MouseConfig {
    if (!config || !config.enabled || !options.userEnabled) return false;
    if (options.coarse) return false;
    if (!options.userPage && !config.adminEnabled) return false;
    if (config.respectReducedMotion && options.reducedMotion) return false;
    return true;
}

export function startMouseEffects(
    target: Window,
    options: { userPage: boolean },
): MouseRuntime {
    const config = readMouseConfig(target);
    const coarseQuery = target.matchMedia(COARSE_POINTER_QUERY);
    const reducedMotionQuery = target.matchMedia('(prefers-reduced-motion: reduce)');
    let userEnabled = readMousePreference(target.localStorage);
    let engine: MouseEffectsEngine | null = null;
    let runningSignature = '';
    let toggleMount: MouseToggleMount | null = null;

    const sync = (): void => {
        const resolved = config.enabled ? resolveMouseConfig(config) : null;
        const eligible = shouldRunMouseEffect(resolved, {
            userEnabled,
            userPage: options.userPage,
            coarse: coarseQuery.matches,
            reducedMotion: reducedMotionQuery.matches,
        });

        if (!eligible || !resolved) {
            engine?.stop();
            engine = null;
            runningSignature = '';
            toggleMount?.refresh();
            return;
        }

        const signature = `${resolved.effect}:${resolved.color}`;
        if (engine && signature !== runningSignature) {
            engine.stop();
            engine = null;
        }
        if (!engine) {
            engine = MouseEffectsEngine.start(resolved, target);
            runningSignature = signature;
        }
        toggleMount?.refresh();
    };

    const toggle = (): boolean => {
        userEnabled = !userEnabled;
        writeMousePreference(target.localStorage, userEnabled);
        sync();
        target.dispatchEvent(new CustomEvent(MOUSE_PREFERENCE_EVENT, {
            detail: { enabled: userEnabled },
        }));
        return userEnabled;
    };

    const handleStorage = (event: StorageEvent): void => {
        if (event.key !== MOUSE_PREFERENCE_KEY) return;
        userEnabled = readMousePreference(target.localStorage);
        sync();
        target.dispatchEvent(new CustomEvent(MOUSE_PREFERENCE_EVENT, {
            detail: { enabled: userEnabled },
        }));
    };

    // The header button only exists when the admin master switch is on.
    const showToggle = options.userPage && config.enabled;
    const unregisterAction = showToggle ? registerMouseToggleAction(target, toggle) : () => {};
    toggleMount = showToggle
        ? new MouseToggleMount(target, () => userEnabled, toggle, () => engine !== null)
        : null;
    toggleMount?.start();

    coarseQuery.addEventListener('change', sync);
    reducedMotionQuery.addEventListener('change', sync);
    target.addEventListener('storage', handleStorage);
    const scheduleTimer = config.scheduleEnabled
        ? target.setInterval(sync, SCHEDULE_SYNC_MS)
        : null;

    sync();

    return {
        stop: () => {
            coarseQuery.removeEventListener('change', sync);
            reducedMotionQuery.removeEventListener('change', sync);
            target.removeEventListener('storage', handleStorage);
            if (scheduleTimer !== null) target.clearInterval(scheduleTimer);
            unregisterAction();
            toggleMount?.stop();
            toggleMount = null;
            engine?.stop();
            engine = null;
        },
    };
}
