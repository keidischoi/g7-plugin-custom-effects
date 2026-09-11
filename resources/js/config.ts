export const PLUGIN_IDENTIFIER = 'g7-plugin-custom-effects';

export type EffectKind = 'snow' | 'rain';

export interface EffectConfig {
    enabled: boolean;
    effect: EffectKind;
    intensity: number;
    speed: number;
    opacity: number;
    wind: number;
    color: string;
    mobileEnabled: boolean;
    adminEnabled: boolean;
    respectReducedMotion: boolean;
}

export const DEFAULT_CONFIG: Readonly<EffectConfig> = {
    enabled: true,
    effect: 'snow',
    intensity: 100,
    speed: 100,
    opacity: 75,
    wind: 0,
    color: '#ffffff',
    mobileEnabled: false,
    adminEnabled: false,
    respectReducedMotion: true,
};

function booleanValue(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return fallback;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
}

function colorValue(value: unknown): string {
    if (typeof value !== 'string') return DEFAULT_CONFIG.color;

    const color = value.trim();
    if (color.length === 0 || color.length > 64 || /[;{}<>]/.test(color)) {
        return DEFAULT_CONFIG.color;
    }

    return color;
}

export function normalizeConfig(raw: unknown): EffectConfig {
    const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};

    return {
        enabled: booleanValue(value.enabled, DEFAULT_CONFIG.enabled),
        effect: value.effect === 'rain' ? 'rain' : 'snow',
        intensity: boundedInteger(value.intensity, DEFAULT_CONFIG.intensity, 10, 200),
        speed: boundedInteger(value.speed, DEFAULT_CONFIG.speed, 25, 300),
        opacity: boundedInteger(value.opacity, DEFAULT_CONFIG.opacity, 10, 100),
        wind: boundedInteger(value.wind, DEFAULT_CONFIG.wind, -100, 100),
        color: colorValue(value.color),
        mobileEnabled: booleanValue(value.mobile_enabled, DEFAULT_CONFIG.mobileEnabled),
        adminEnabled: booleanValue(value.admin_enabled, DEFAULT_CONFIG.adminEnabled),
        respectReducedMotion: booleanValue(
            value.respect_reduced_motion,
            DEFAULT_CONFIG.respectReducedMotion,
        ),
    };
}

export function readInlineConfig(target: Window = window): EffectConfig {
    const g7Config = (target as Window & {
        G7Config?: { plugins?: Record<string, unknown> };
    }).G7Config;

    return normalizeConfig(g7Config?.plugins?.[PLUGIN_IDENTIFIER]);
}

export function shouldStart(
    config: EffectConfig,
    options: {
        pathname: string;
        mobile: boolean;
        reducedMotion: boolean;
    },
): boolean {
    if (!config.enabled) return false;
    if (!config.adminEnabled && /^\/(?:[a-z]{2}\/)?admin(?:\/|$)/i.test(options.pathname)) {
        return false;
    }
    if (!config.mobileEnabled && options.mobile) return false;
    if (config.respectReducedMotion && options.reducedMotion) return false;
    return true;
}
