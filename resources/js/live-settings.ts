import {
    PLUGIN_IDENTIFIER,
    normalizeConfig,
    readInlineConfig,
    type EffectConfig,
} from './config';

/**
 * 1.1.2: 3초 → 60초. 보이는 탭에서만 확인하고, 같은 탭에서 20초 안에는 다시 묻지 않습니다.
 * 설정을 바꾼 브라우저의 다른 탭은 storage/BroadcastChannel 신호로 바로 받습니다(force).
 * 처음 화면은 페이지에 실린 설정(G7Config)으로 그리고, 서버에 따로 묻지 않습니다.
 */
export const SETTINGS_POLL_MS = 60_000;
export const SETTINGS_MIN_GAP_MS = 20_000;
export const SETTINGS_REVISION_KEY = 'custom-effects:settings-revision';
export const SETTINGS_CHANNEL = 'custom-effects:settings';

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

export interface SettingsPuller {
    /** force=true 면 간격·탭 숨김과 상관없이 (설정 저장 신호) */
    pull: (force?: boolean) => Promise<EffectConfig | null>;
    /** 마지막으로 물은 시각 (없으면 0) */
    lastAt: () => number;
}

/**
 * 설정 확인을 한 곳에서: 같은 때 여러 번 불러도 요청은 하나(진행 중이면 그 결과를 같이 씀),
 * 숨긴 탭에서는 묻지 않고, 마지막 확인 뒤 minGap 안이면 건너뜁니다.
 */
export function createSettingsPuller(
    target: Window = window,
    minGap: number = SETTINGS_MIN_GAP_MS,
    now: () => number = () => Date.now(),
): SettingsPuller {
    let inflight: Promise<EffectConfig | null> | null = null;
    let last = 0;
    const hidden = (): boolean => {
        try {
            return !!(target.document && target.document.hidden);
        } catch {
            return false;
        }
    };

    return {
        pull(force = false) {
            if (inflight) return inflight;
            if (!force && (hidden() || (last > 0 && now() - last < minGap))) {
                return Promise.resolve(null);
            }
            last = now();
            inflight = pullRemoteConfig(target).finally(() => {
                inflight = null;
            });
            return inflight;
        },
        lastAt: () => last,
    };
}

/** 페이지에 설정이 실려 왔는지 (G7Config.plugins['custom-effects']) — 있으면 처음 한 번 묻지 않아도 됨 */
export function hasInlineSettings(target: Window = window): boolean {
    const plugins = (target as Window & { G7Config?: { plugins?: Record<string, unknown> } }).G7Config?.plugins;
    const raw = plugins ? plugins[PLUGIN_IDENTIFIER] : undefined;

    return !!raw && typeof raw === 'object' && Object.keys(raw as Record<string, unknown>).length > 0;
}
