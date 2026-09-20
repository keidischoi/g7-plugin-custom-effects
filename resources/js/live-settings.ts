import {
    PLUGIN_IDENTIFIER,
    normalizeConfig,
    readInlineConfig,
    type EffectConfig,
} from './config';

export const SETTINGS_POLL_MS = 3_000;
<<<<<<< HEAD
export const SETTINGS_REVISION_KEY = 'custom-effects:settings-revision';
export const SETTINGS_CHANNEL = 'custom-effects:settings';
=======
export const SETTINGS_REVISION_KEY = 'g7-plugin-custom-effects:settings-revision';
export const SETTINGS_CHANNEL = 'g7-plugin-custom-effects:settings';
>>>>>>> c296cf2d90e83e047cf94ead1b1c993fb02b9ad7

export function publicSettingsUrl(target: Window = window): string {
    const g7Config = (target as Window & {
        G7Config?: { apiPrefix?: unknown; apiBase?: unknown };
    }).G7Config;
    const prefix = [g7Config?.apiPrefix, g7Config?.apiBase]
        .find((value): value is string => typeof value === 'string' && value.length > 0)
        ?.replace(/\/$/, '')
        ?? '/api';

    return `${prefix}/plugins/${PLUGIN_IDENTIFIER}/settings`;
}

export function settingsSignature(config: EffectConfig): string {
    return JSON.stringify({
        enabled: config.enabled,
        effect: config.effect,
        intensity: config.intensity,
        speed: config.speed,
        opacity: config.opacity,
        wind: config.wind,
        windDirection: config.windDirection,
        color: config.color,
        mobileEnabled: config.mobileEnabled,
        adminEnabled: config.adminEnabled,
        respectReducedMotion: config.respectReducedMotion,
        scheduleEnabled: config.scheduleEnabled,
        schedules: config.schedules,
    });
}

export function writePluginConfig(target: Window, raw: unknown): void {
    const g7 = target as Window & { G7Config?: { plugins?: Record<string, unknown> } };
    if (!g7.G7Config) {
        g7.G7Config = { plugins: {} };
    }
    if (!g7.G7Config.plugins) {
        g7.G7Config.plugins = {};
    }
    g7.G7Config.plugins[PLUGIN_IDENTIFIER] = raw && typeof raw === 'object'
        ? raw as Record<string, unknown>
        : {};
}

export function pingSettingsRevision(target: Window = window): void {
    try {
        target.localStorage.setItem(SETTINGS_REVISION_KEY, String(Date.now()));
    } catch {
        // private mode
    }

    const Channel = (target as Window & { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
    if (!Channel) return;
    try {
        const channel = new Channel(SETTINGS_CHANNEL);
        channel.postMessage({ type: 'saved' });
        channel.close();
    } catch {
        // unsupported
    }
}

function unwrapPayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') return payload;
    const record = payload as { data?: unknown };
    return record.data ?? payload;
}

export async function fetchPublicSettings(target: Window = window): Promise<unknown | null> {
    try {
        const response = await target.fetch(publicSettingsUrl(target), {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            credentials: 'same-origin',
        });
        if (!response.ok) return null;
        return unwrapPayload(await response.json());
    } catch {
        return null;
    }
}

export async function pullRemoteConfig(target: Window = window): Promise<EffectConfig | null> {
    const raw = await fetchPublicSettings(target);
    if (!raw || typeof raw !== 'object') return null;
    writePluginConfig(target, raw);
    return readInlineConfig(target);
}

export function watchAdminSettingsSave(
    target: Window,
    onSaved: () => void,
): () => void {
    const original = target.fetch.bind(target);
    target.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await original(input, init);
        const url = typeof input === 'string'
            ? input
            : input instanceof URL
                ? input.href
                : input.url;
        const method = (
            init?.method
            ?? (typeof input === 'object' && !(input instanceof URL) ? input.method : 'GET')
            ?? 'GET'
        ).toUpperCase();
        const path = url.split('?')[0] ?? '';
        if (
            response.ok
            && method === 'PUT'
            && /\/api\/admin\/plugins\/[^/]+\/settings\/?$/.test(path)
        ) {
            onSaved();
        }
        return response;
    }) as typeof target.fetch;

    return () => {
        target.fetch = original;
    };
}

export function listenForSettingsRevision(
    target: Window,
    onChange: () => void,
): () => void {
    const handleStorage = (event: StorageEvent): void => {
        if (event.key === SETTINGS_REVISION_KEY) onChange();
    };
    target.addEventListener('storage', handleStorage);

    let channel: BroadcastChannel | null = null;
    const Channel = (target as Window & { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
    if (Channel) {
        try {
            channel = new Channel(SETTINGS_CHANNEL);
            channel.onmessage = () => onChange();
        } catch {
            channel = null;
        }
    }

    return () => {
        target.removeEventListener('storage', handleStorage);
        channel?.close();
    };
}
