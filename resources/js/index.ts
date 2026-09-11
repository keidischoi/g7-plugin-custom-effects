import '../css/effects.css';
import { readInlineConfig, shouldStart } from './config';
import { EffectsEngine } from './engine';

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
    let engine: EffectsEngine | null = null;

    const sync = (): void => {
        const eligible = shouldStart(config, {
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

    mobileQuery.addEventListener('change', sync);
    reducedMotionQuery.addEventListener('change', sync);
    window.addEventListener('popstate', sync);

    window.__g7CustomEffects = {
        stop: () => {
            mobileQuery.removeEventListener('change', sync);
            reducedMotionQuery.removeEventListener('change', sync);
            window.removeEventListener('popstate', sync);
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
