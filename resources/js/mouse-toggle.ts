export const MOUSE_PREFERENCE_KEY = 'custom-effects:mouse-enabled';
export const MOUSE_TOGGLE_ACTION = 'custom-effects.mouse-toggle';
export const MOUSE_PREFERENCE_EVENT = 'g7-custom-effects:mouse-preference-changed';
export const MOUSE_TOGGLE_SELECTOR = '[data-g7-custom-mouse-toggle="true"]';

interface PreferenceStorage {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
}

interface ActionDispatcher {
    registerHandler: (name: string, handler: () => unknown) => void;
}

type ToggleCallback = () => boolean;

/** Visitors see the mouse effect unless they switched it off in this browser. */
export function readMousePreference(storage: PreferenceStorage): boolean {
    try {
        const saved = storage.getItem(MOUSE_PREFERENCE_KEY);
        return saved === null ? true : saved !== 'false';
    } catch {
        return true;
    }
}

export function writeMousePreference(storage: PreferenceStorage, enabled: boolean): void {
    try {
        storage.setItem(MOUSE_PREFERENCE_KEY, String(enabled));
    } catch {
        // Storage can be unavailable in private or sandboxed contexts.
    }
}

const CURSOR_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" '
    + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
    + '<path d="M5 3l6.5 16 2.3-6.7L20.5 10z" fill="currentColor" fill-opacity="0.15"/>'
    + '<path d="M17 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="currentColor" stroke="none"/>'
    + '</svg>';

function translatedLabel(target: Window, enabled: boolean): string {
    const key = enabled
        ? 'custom-effects.mouse_toggle.disable'
        : 'custom-effects.mouse_toggle.enable';
    const translated = (target as Window & {
        G7Core?: { t?: (key: string) => string };
    }).G7Core?.t?.(key);

    if (translated && translated !== key) return translated;
    return enabled ? '마우스 효과 끄기' : '마우스 효과 켜기';
}

export function updateMouseToggleButton(
    button: HTMLButtonElement,
    enabled: boolean,
    target: Window = window,
    active: boolean = enabled,
): void {
    const label = translatedLabel(target, enabled);
    button.dataset.enabled = String(enabled);
    button.dataset.active = String(active);
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', label);
    button.title = label;
}

export function createMouseToggleButton(
    enabled: boolean,
    onToggle: ToggleCallback,
    target: Window = window,
): HTMLButtonElement {
    const button = target.document.createElement('button');
    button.type = 'button';
    button.className = 'g7-custom-effects-toggle g7-custom-effects-mouse-toggle';
    button.dataset.g7CustomMouseToggle = 'true';
    button.innerHTML = CURSOR_ICON;
    updateMouseToggleButton(button, enabled, target);
    button.addEventListener('click', () => {
        updateMouseToggleButton(button, onToggle(), target);
    });
    return button;
}

/**
 * Mounts the mouse-effect button in the user header, right after the
 * screen-effect button (i.e. just before the dark-theme toggle).
 */
export class MouseToggleMount {
    private observer: MutationObserver | null = null;

    constructor(
        private readonly target: Window,
        private readonly getEnabled: () => boolean,
        private readonly onToggle: ToggleCallback,
        private readonly getActive: () => boolean = getEnabled,
    ) {}

    start(): void {
        this.mountButtons();
        const Observer = (this.target as Window & typeof globalThis).MutationObserver;
        const observer = new Observer(() => this.mountButtons());
        observer.observe(this.target.document.body, { childList: true, subtree: true });
        this.observer = observer;
        this.target.addEventListener(MOUSE_PREFERENCE_EVENT, this.handlePreferenceChange);
    }

    stop(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.target.removeEventListener(MOUSE_PREFERENCE_EVENT, this.handlePreferenceChange);
        this.target.document
            .querySelectorAll<HTMLButtonElement>(MOUSE_TOGGLE_SELECTOR)
            .forEach((button) => button.remove());
    }

    refresh(): void {
        this.target.document
            .querySelectorAll<HTMLButtonElement>(MOUSE_TOGGLE_SELECTOR)
            .forEach((button) => updateMouseToggleButton(
                button,
                this.getEnabled(),
                this.target,
                this.getActive(),
            ));
    }

    private readonly handlePreferenceChange = (): void => {
        this.refresh();
    };

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
                child.matches(MOUSE_TOGGLE_SELECTOR)
            ));
            if (mounted) return;

            const button = createMouseToggleButton(this.getEnabled(), this.onToggle, this.target);
            updateMouseToggleButton(button, this.getEnabled(), this.target, this.getActive());
            host.insertBefore(button, themeWrapper);
        });
    }
}

export function registerMouseToggleAction(
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
        dispatcher.registerHandler(MOUSE_TOGGLE_ACTION, onToggle);
    };

    register();

    return () => {
        stopped = true;
        if (timer !== null) target.clearTimeout(timer);
    };
}
