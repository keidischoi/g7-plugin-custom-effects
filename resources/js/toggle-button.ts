import type { EffectKind } from './config';

export const TOGGLE_ACTION = 'g7-plugin-custom-effects.toggle';
export const PREFERENCE_EVENT = 'g7-custom-effects:preference-changed';

interface ActionDispatcher {
    registerHandler: (name: string, handler: () => unknown) => void;
}

type ToggleCallback = () => boolean;

const EFFECT_SYMBOLS: Record<EffectKind, string> = {
    snow: '❄',
    rain: '◆',
    fog: '🌫',
    leaves: '❧',
    stars: '★',
    stars_multicolor: '★',
    hearts: '♥',
    petals: '✿',
    cherry_blossoms: '🌸',
    confetti: '✦',
    bubbles: '○',
    bouncing_bubbles: '◉',
    fireflies: '•',
    cheese: '▲',
    poop: '☁',
    ice_cream: '▲',
    bills: '▤',
    coins: '◎',
    alarm_clock: '⏰',
    maple_leaves: '🍁',
};

function translatedLabel(target: Window, enabled: boolean): string {
    const key = enabled
        ? 'g7-plugin-custom-effects.toggle.disable'
        : 'g7-plugin-custom-effects.toggle.enable';
    const translated = (target as Window & {
        G7Core?: { t?: (key: string) => string };
    }).G7Core?.t?.(key);

    if (translated && translated !== key) return translated;
    return enabled ? '화면 효과 끄기' : '화면 효과 켜기';
}

export function updateToggleButton(
    button: HTMLButtonElement,
    enabled: boolean,
    effect: EffectKind,
    target: Window = window,
): void {
    const label = translatedLabel(target, enabled);
    button.dataset.enabled = String(enabled);
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', label);
    button.title = label;

    const symbol = button.querySelector<HTMLElement>('[data-effect-symbol]');
    if (symbol) symbol.textContent = EFFECT_SYMBOLS[effect];
}

export function createToggleButton(
    enabled: boolean,
    effect: EffectKind,
    onToggle: ToggleCallback,
    target: Window = window,
): HTMLButtonElement {
    const button = target.document.createElement('button');
    button.type = 'button';
    button.className = 'g7-custom-effects-toggle';
    button.dataset.g7CustomEffectsToggle = 'true';

    const symbol = target.document.createElement('span');
    symbol.dataset.effectSymbol = 'true';
    symbol.setAttribute('aria-hidden', 'true');
    button.append(symbol);
    updateToggleButton(button, enabled, effect, target);

    button.addEventListener('click', () => {
        const g7Core = (target as Window & {
            G7Core?: { dispatch?: (action: { handler: string }) => unknown };
        }).G7Core;

        if (typeof g7Core?.dispatch === 'function') {
            g7Core.dispatch({ handler: TOGGLE_ACTION });
        } else {
            const next = onToggle();
            updateToggleButton(button, next, effect, target);
        }
    });

    return button;
}

export class HeaderToggleMount {
    private observer: MutationObserver | null = null;

    constructor(
        private readonly target: Window,
        private readonly effect: EffectKind | (() => EffectKind),
        private readonly getEnabled: () => boolean,
        private readonly onToggle: ToggleCallback,
    ) {}

    start(): void {
        this.mountButtons();
        const Observer = (this.target as Window & typeof globalThis).MutationObserver;
        const observer = new Observer(() => this.mountButtons());
        observer.observe(this.target.document.body, { childList: true, subtree: true });
        this.observer = observer;
        this.target.addEventListener(PREFERENCE_EVENT, this.handlePreferenceChange);
    }

    stop(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.target.removeEventListener(PREFERENCE_EVENT, this.handlePreferenceChange);
        this.target.document
            .querySelectorAll<HTMLButtonElement>('[data-g7-custom-effects-toggle="true"]')
            .forEach((button) => button.remove());
    }

    refresh(): void {
        this.updateButtons();
    }

    private readonly handlePreferenceChange = (): void => {
        this.updateButtons();
    };

    private updateButtons(): void {
        const enabled = this.getEnabled();
        this.target.document
            .querySelectorAll<HTMLButtonElement>('[data-g7-custom-effects-toggle="true"]')
            .forEach((button) => updateToggleButton(
                button,
                enabled,
                this.currentEffect(),
                this.target,
            ));
    }

    private currentEffect(): EffectKind {
        return typeof this.effect === 'function' ? this.effect() : this.effect;
    }

    private mountButtons(): void {
        const wrappers = new Set<HTMLElement>();
        const mobileTheme = this.target.document.getElementById('mobile_theme_btn');
        if (mobileTheme) wrappers.add(mobileTheme);

        this.target.document
            .querySelectorAll<HTMLButtonElement>('button[aria-label="Toggle theme"]')
            .forEach((themeButton) => {
                const wrapper = themeButton.parentElement;
                if (wrapper) wrappers.add(wrapper);
            });

        wrappers.forEach((themeWrapper) => {
            const host = themeWrapper.parentElement;
            if (!host) return;

            const mounted = Array.from(host.children).some((child) => (
                child.matches('[data-g7-custom-effects-toggle="true"]')
            ));
            if (mounted) return;

            host.insertBefore(
                createToggleButton(
                    this.getEnabled(),
                    this.currentEffect(),
                    this.onToggle,
                    this.target,
                ),
                themeWrapper,
            );
        });
    }
}

export function registerToggleAction(
    target: Window,
    onToggle: ToggleCallback,
): () => void {
    let stopped = false;
    let timer: number | null = null;

    const register = (): void => {
        if (stopped) return;
        const dispatcher = (target as Window & {
            G7Core?: { getActionDispatcher?: () => ActionDispatcher | undefined };
        }).G7Core?.getActionDispatcher?.();

        if (!dispatcher) {
            timer = target.setTimeout(register, 100);
            return;
        }

        dispatcher.registerHandler(TOGGLE_ACTION, onToggle);
    };

    register();

    return () => {
        stopped = true;
        if (timer !== null) target.clearTimeout(timer);
    };
}
