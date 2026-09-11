export const PLUGIN_IDENTIFIER = 'g7-plugin-custom-effects';

export const EFFECT_KINDS = [
    'snow',
    'rain',
    'leaves',
    'stars',
    'stars_multicolor',
    'hearts',
    'petals',
    'confetti',
    'bubbles',
    'bouncing_bubbles',
    'fireflies',
] as const;

export const COLOR_OPTIONS = [
    '#ffffff',
    '#bae6fd',
    '#f9a8d4',
    '#fde047',
    '#86efac',
    '#c4b5fd',
    '#fb923c',
    '#f87171',
] as const;

export const TIMEZONE_OPTIONS = [
    'Asia/Seoul',
    'UTC',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Australia/Sydney',
] as const;

export type EffectKind = typeof EFFECT_KINDS[number];
export type ScheduleDays = 'all' | 'weekdays' | 'weekends';
export type WindDirection = 'none' | 'left' | 'right' | 'random';

export interface EffectSchedule {
    enabled: boolean;
    effect: EffectKind;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    days: readonly number[];
    timezone: string;
}

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
    schedules: EffectSchedule[];
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
    schedules: [],
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

function presetValue<const T extends readonly string[]>(
    value: unknown,
    options: T,
    fallback: string,
): string {
    return typeof value === 'string' && options.includes(value as T[number])
        ? value
        : fallback;
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

function weekdayFlags(value: Record<string, unknown>): readonly number[] {
    if (Array.isArray(value.days)) {
        return [...new Set(
            value.days
                .map((day) => typeof day === 'number' ? day : Number(day))
                .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
        )].sort((left, right) => left - right);
    }

    return [
        value.sun,
        value.mon,
        value.tue,
        value.wed,
        value.thu,
        value.fri,
        value.sat,
    ].flatMap((enabled, day) => booleanValue(enabled, true) ? [day] : []);
}

function scheduleValue(
    raw: unknown,
    fallbackEffect: EffectKind,
): EffectSchedule {
    const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const effect = EFFECT_KINDS.includes(value.effect as EffectKind)
        ? value.effect as EffectKind
        : fallbackEffect;
    const days = weekdayFlags(value);

    return {
        enabled: booleanValue(value.enabled, true),
        effect,
        startDate: dateValue(value.start_date),
        endDate: dateValue(value.end_date),
        startTime: formattedValue(value.start_time, /^(?:[01]\d|2[0-3]):[0-5]\d$/),
        endTime: formattedValue(value.end_time, /^(?:[01]\d|2[0-3]):[0-5]\d$/),
        days,
        timezone: presetValue(
            value.timezone,
            TIMEZONE_OPTIONS,
            DEFAULT_CONFIG.scheduleTimezone,
        ),
    };
}

export function normalizeConfig(raw: unknown): EffectConfig {
    const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const effect = EFFECT_KINDS.includes(value.effect as EffectKind)
        ? value.effect as EffectKind
        : DEFAULT_CONFIG.effect;
    const legacyWind = boundedInteger(value.wind, DEFAULT_CONFIG.wind, -100, 100);
    const windDirection = ['none', 'left', 'right', 'random'].includes(String(value.wind_direction))
        ? value.wind_direction as WindDirection
        : legacyWind < 0 ? 'left' : legacyWind > 0 ? 'right' : DEFAULT_CONFIG.windDirection;
    const legacyDays = ['weekdays', 'weekends'].includes(String(value.schedule_days))
        ? value.schedule_days as ScheduleDays
        : 'all';
    const legacySchedule = scheduleValue({
        enabled: true,
        effect,
        start_date: value.schedule_start_date,
        end_date: value.schedule_end_date,
        start_time: value.schedule_start_time,
        end_time: value.schedule_end_time,
        timezone: value.schedule_timezone,
        sun: legacyDays !== 'weekdays',
        mon: legacyDays !== 'weekends',
        tue: legacyDays !== 'weekends',
        wed: legacyDays !== 'weekends',
        thu: legacyDays !== 'weekends',
        fri: legacyDays !== 'weekends',
        sat: legacyDays !== 'weekdays',
    }, effect);
    const hasLegacySchedule = [
        'schedule_start_date',
        'schedule_end_date',
        'schedule_start_time',
        'schedule_end_time',
        'schedule_days',
        'schedule_timezone',
    ].some((key) => key in value);
    const schedules = Array.isArray(value.schedules)
        ? value.schedules.slice(0, 20).map((schedule) => scheduleValue(schedule, effect))
        : hasLegacySchedule
            ? [legacySchedule]
            : [];

    return {
        enabled: booleanValue(value.enabled, DEFAULT_CONFIG.enabled),
        effect,
        intensity: boundedInteger(value.intensity, DEFAULT_CONFIG.intensity, 10, 200),
        speed: boundedInteger(value.speed, DEFAULT_CONFIG.speed, 25, 300),
        opacity: boundedInteger(value.opacity, DEFAULT_CONFIG.opacity, 10, 100),
        wind: Math.abs(legacyWind),
        windDirection,
        color: presetValue(value.color, COLOR_OPTIONS, DEFAULT_CONFIG.color),
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
        scheduleDays: legacyDays,
        scheduleTimezone: presetValue(
            value.schedule_timezone,
            TIMEZONE_OPTIONS,
            DEFAULT_CONFIG.scheduleTimezone,
        ),
        schedules,
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
