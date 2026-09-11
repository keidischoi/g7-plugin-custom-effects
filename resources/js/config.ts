export const PLUGIN_IDENTIFIER = 'g7-plugin-custom-effects';

export const EFFECT_KINDS = [
    'snow',
    'rain',
    'leaves',
    'stars',
    'hearts',
    'petals',
    'confetti',
    'bubbles',
    'fireflies',
] as const;

export type EffectKind = typeof EFFECT_KINDS[number];
export type ScheduleDays = 'all' | 'weekdays' | 'weekends';
export type WindDirection = 'none' | 'left' | 'right';

export interface EffectConfig {
    enabled: boolean;
    effect: EffectKind;
    intensity: number;
    speed: number;
    opacity: number;
    wind: number;
    windDirection: WindDirection;
    color: string;
    mobileEnabled: boolean;
    adminEnabled: boolean;
    respectReducedMotion: boolean;
    scheduleEnabled: boolean;
    scheduleStartDate: string;
    scheduleEndDate: string;
    scheduleStartTime: string;
    scheduleEndTime: string;
    scheduleDays: ScheduleDays;
    scheduleTimezone: string;
}

export const DEFAULT_CONFIG: Readonly<EffectConfig> = {
    enabled: true,
    effect: 'snow',
    intensity: 100,
    speed: 100,
    opacity: 75,
    wind: 0,
    windDirection: 'none',
    color: '#ffffff',
    mobileEnabled: false,
    adminEnabled: false,
    respectReducedMotion: true,
    scheduleEnabled: false,
    scheduleStartDate: '',
    scheduleEndDate: '',
    scheduleStartTime: '',
    scheduleEndTime: '',
    scheduleDays: 'all',
    scheduleTimezone: 'Asia/Seoul',
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

function formattedValue(value: unknown, pattern: RegExp): string {
    if (typeof value !== 'string') return '';
    const formatted = value.trim();
    return pattern.test(formatted) ? formatted : '';
}

function dateValue(value: unknown): string {
    const formatted = formattedValue(value, /^\d{4}-\d{2}-\d{2}$/);
    if (!formatted) return '';

    const date = new Date(`${formatted}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== formatted
        ? ''
        : formatted;
}

export function normalizeConfig(raw: unknown): EffectConfig {
    const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const effect = EFFECT_KINDS.includes(value.effect as EffectKind)
        ? value.effect as EffectKind
        : DEFAULT_CONFIG.effect;
    const legacyWind = boundedInteger(value.wind, DEFAULT_CONFIG.wind, -100, 100);
    const windDirection = ['none', 'left', 'right'].includes(String(value.wind_direction))
        ? value.wind_direction as WindDirection
        : legacyWind < 0 ? 'left' : legacyWind > 0 ? 'right' : DEFAULT_CONFIG.windDirection;

    return {
        enabled: booleanValue(value.enabled, DEFAULT_CONFIG.enabled),
        effect,
        intensity: boundedInteger(value.intensity, DEFAULT_CONFIG.intensity, 10, 200),
        speed: boundedInteger(value.speed, DEFAULT_CONFIG.speed, 25, 300),
        opacity: boundedInteger(value.opacity, DEFAULT_CONFIG.opacity, 10, 100),
        wind: Math.abs(legacyWind),
        windDirection,
        color: colorValue(value.color),
        mobileEnabled: booleanValue(value.mobile_enabled, DEFAULT_CONFIG.mobileEnabled),
        adminEnabled: booleanValue(value.admin_enabled, DEFAULT_CONFIG.adminEnabled),
        respectReducedMotion: booleanValue(
            value.respect_reduced_motion,
            DEFAULT_CONFIG.respectReducedMotion,
        ),
        scheduleEnabled: booleanValue(value.schedule_enabled, DEFAULT_CONFIG.scheduleEnabled),
        scheduleStartDate: dateValue(value.schedule_start_date),
        scheduleEndDate: dateValue(value.schedule_end_date),
        scheduleStartTime: formattedValue(value.schedule_start_time, /^(?:[01]\d|2[0-3]):[0-5]\d$/),
        scheduleEndTime: formattedValue(value.schedule_end_time, /^(?:[01]\d|2[0-3]):[0-5]\d$/),
        scheduleDays: ['weekdays', 'weekends'].includes(String(value.schedule_days))
            ? value.schedule_days as ScheduleDays
            : 'all',
        scheduleTimezone: typeof value.schedule_timezone === 'string'
            && value.schedule_timezone.trim().length > 0
            && value.schedule_timezone.length <= 64
            ? value.schedule_timezone.trim()
            : DEFAULT_CONFIG.scheduleTimezone,
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
