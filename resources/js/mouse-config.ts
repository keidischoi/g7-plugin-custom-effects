import { COLOR_OPTIONS, PLUGIN_IDENTIFIER, readSiteTimezone, weekdayFlags } from './config';
import { matchesSchedule } from './schedule';

/** Mouse-follow (cursor trail) effects, in Korean name order for the admin dropdown. */
export const MOUSE_EFFECT_KINDS = [
    'bubble_pop',
    'text_trail',
    'gold_dust',
    'petals',
    'butterflies',
    'autumn_leaves',
    'neon_line',
    'clovers',
    'snowflakes',
    'ring_cursor',
    'magic_runes',
    'rainbow_tail',
    'ripple',
    'fireflies',
    'sparkle_stars',
    'lightning',
    'shooting_stars',
    'embers',
    'bubbles',
    'confetti',
    'spotlight',
    'smoke',
    'music_notes',
    'emoji',
    'dot_follow',
    'click_fireworks',
    'balloons',
    'pixel_dots',
    'hearts',
    'comet',
] as const;

export type MouseEffectKind = typeof MOUSE_EFFECT_KINDS[number];

export const MOUSE_EFFECT_LABELS: Record<MouseEffectKind, string> = {
    bubble_pop: '거품 팝',
    text_trail: '글자 꼬리',
    gold_dust: '금가루',
    petals: '꽃잎 (벚꽃)',
    butterflies: '나비',
    autumn_leaves: '낙엽 (단풍)',
    neon_line: '네온 선',
    clovers: '네잎클로버',
    snowflakes: '눈송이',
    ring_cursor: '링 커서 (지연 원)',
    magic_runes: '마법 가루 (원형 룬)',
    rainbow_tail: '무지개 꼬리',
    ripple: '물결 (ripple)',
    fireflies: '반딧불 빛 입자',
    sparkle_stars: '반짝이 별',
    lightning: '번개',
    shooting_stars: '별똥별',
    embers: '불꽃 (불씨)',
    bubbles: '비눗방울',
    confetti: '색종이',
    spotlight: '스포트라이트',
    smoke: '연기',
    music_notes: '음표',
    emoji: '이모지',
    dot_follow: '점 따라가기',
    click_fireworks: '클릭 폭죽',
    balloons: '풍선',
    pixel_dots: '픽셀 도트',
    hearts: '하트',
    comet: '혜성 꼬리',
};

/** `default` keeps each effect's own palette; `rainbow` cycles hues. */
export const MOUSE_COLOR_OPTIONS = ['default', 'rainbow', ...COLOR_OPTIONS] as const;

export const MOUSE_DEFAULT_EMOJIS = '✨,💖,🌸,⭐,🎉';
export const MOUSE_DEFAULT_TEXT = 'Hello G7';

/** Per-row overrides; each value is already merged with the main settings. */
export interface MouseSchedule {
    enabled: boolean;
    effect: MouseEffectKind;
    color: string;
    customColor: string;
    amount: number;
    size: number;
    emojis: string[];
    text: string;
    clickBurst: boolean;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    days: readonly number[];
}

export interface MouseConfig {
    enabled: boolean;
    effect: MouseEffectKind;
    color: string;
    customColor: string;
    amount: number;
    size: number;
    emojis: string[];
    text: string;
    clickBurst: boolean;
    adminEnabled: boolean;
    respectReducedMotion: boolean;
    scheduleEnabled: boolean;
    schedules: MouseSchedule[];
    timezone: string;
}

export const DEFAULT_MOUSE_CONFIG: Readonly<MouseConfig> = {
    enabled: false,
    effect: 'sparkle_stars',
    color: 'default',
    customColor: '',
    amount: 100,
    size: 100,
    emojis: Array.from(MOUSE_DEFAULT_EMOJIS.split(',')),
    text: MOUSE_DEFAULT_TEXT,
    clickBurst: false,
    adminEnabled: false,
    respectReducedMotion: true,
    scheduleEnabled: false,
    schedules: [],
    timezone: 'Asia/Seoul',
};

function booleanValue(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return fallback;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
    if (value === '' || value === null || value === undefined) return fallback;
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
}

function effectValue(value: unknown, fallback: MouseEffectKind): MouseEffectKind {
    return MOUSE_EFFECT_KINDS.includes(value as MouseEffectKind)
        ? value as MouseEffectKind
        : fallback;
}

function colorValue(value: unknown, fallback: string): string {
    return typeof value === 'string'
        && (MOUSE_COLOR_OPTIONS as readonly string[]).includes(value)
        ? value
        : fallback;
}

export function hexColorValue(value: unknown): string {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed.toLowerCase() : '';
}

function dateValue(value: unknown): string {
    if (typeof value !== 'string') return '';
    const formatted = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return '';
    const date = new Date(`${formatted}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== formatted
        ? ''
        : formatted;
}

function timeValue(value: unknown): string {
    if (typeof value !== 'string') return '';
    const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
    if (!match) return '';
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/**
 * Weekdays come from per-day `sun`…`sat` flags like screen-effect schedules.
 * 1.1.0 rows stored `days` as all / weekdays / weekends; those still work.
 */
function daysValue(value: Record<string, unknown>): readonly number[] {
    if (value.days === 'weekdays') return [1, 2, 3, 4, 5];
    if (value.days === 'weekends') return [0, 6];
    if (value.days === 'all') return [0, 1, 2, 3, 4, 5, 6];
    return weekdayFlags(value);
}

/** Splits an admin-entered emoji list on commas, spaces or new lines. */
export function parseEmojiList(value: unknown): string[] {
    if (typeof value !== 'string') return [...DEFAULT_MOUSE_CONFIG.emojis];
    const items = value
        .split(/[\s,]+/u)
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.length <= 16)
        .slice(0, 30);
    return items.length > 0 ? items : [...DEFAULT_MOUSE_CONFIG.emojis];
}

export function trailTextValue(value: unknown): string {
    if (typeof value !== 'string') return MOUSE_DEFAULT_TEXT;
    const text = Array.from(value.replace(/\s+/gu, ' ').trim()).slice(0, 40).join('');
    return text || MOUSE_DEFAULT_TEXT;
}

function isBlank(value: unknown): boolean {
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * Normalizes one mouse schedule row. Blank / unset / invalid values fall back
 * to the main mouse settings. Picking a preset color in the row clears the
 * main custom HEX color unless the row has its own custom color.
 */
function mouseScheduleValue(raw: unknown, fallback: MouseConfig): MouseSchedule {
    const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const rowColor = value.mouse_color ?? value.color;
    const hasRowColor = typeof rowColor === 'string'
        && (MOUSE_COLOR_OPTIONS as readonly string[]).includes(rowColor);
    const rowCustomColor = hexColorValue(value.mouse_custom_color);
    return {
        enabled: booleanValue(value.enabled, true),
        effect: effectValue(value.mouse_effect ?? value.effect, fallback.effect),
        color: colorValue(rowColor, fallback.color),
        customColor: rowCustomColor || (hasRowColor ? '' : fallback.customColor),
        amount: boundedInteger(value.mouse_amount, fallback.amount, 10, 200),
        size: boundedInteger(value.mouse_size, fallback.size, 50, 200),
        emojis: isBlank(value.mouse_emojis) ? [...fallback.emojis] : parseEmojiList(value.mouse_emojis),
        text: isBlank(value.mouse_text) ? fallback.text : trailTextValue(value.mouse_text),
        clickBurst: booleanValue(value.mouse_click_burst, fallback.clickBurst),
        startDate: dateValue(value.start_date),
        endDate: dateValue(value.end_date),
        startTime: timeValue(value.start_time),
        endTime: timeValue(value.end_time),
        days: daysValue(value),
    };
}

export function normalizeMouseConfig(raw: unknown): MouseConfig {
    const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const base: MouseConfig = {
        enabled: booleanValue(value.mouse_enabled, DEFAULT_MOUSE_CONFIG.enabled),
        effect: effectValue(value.mouse_effect, DEFAULT_MOUSE_CONFIG.effect),
        color: colorValue(value.mouse_color, DEFAULT_MOUSE_CONFIG.color),
        customColor: hexColorValue(value.mouse_custom_color),
        amount: boundedInteger(value.mouse_amount, DEFAULT_MOUSE_CONFIG.amount, 10, 200),
        size: boundedInteger(value.mouse_size, DEFAULT_MOUSE_CONFIG.size, 50, 200),
        emojis: parseEmojiList(value.mouse_emojis),
        text: trailTextValue(value.mouse_text),
        clickBurst: booleanValue(value.mouse_click_burst, DEFAULT_MOUSE_CONFIG.clickBurst),
        adminEnabled: booleanValue(value.admin_enabled, DEFAULT_MOUSE_CONFIG.adminEnabled),
        respectReducedMotion: booleanValue(
            value.respect_reduced_motion,
            DEFAULT_MOUSE_CONFIG.respectReducedMotion,
        ),
        scheduleEnabled: booleanValue(
            value.mouse_schedule_enabled,
            DEFAULT_MOUSE_CONFIG.scheduleEnabled,
        ),
        schedules: [],
        timezone: DEFAULT_MOUSE_CONFIG.timezone,
    };
    base.schedules = Array.isArray(value.mouse_schedules)
        ? value.mouse_schedules.slice(0, 20).map((item) => mouseScheduleValue(item, base))
        : [];
    return base;
}

export function readMouseConfig(target: Window = window): MouseConfig {
    const g7Config = (target as Window & {
        G7Config?: { plugins?: Record<string, unknown> };
    }).G7Config;
    return {
        ...normalizeMouseConfig(g7Config?.plugins?.[PLUGIN_IDENTIFIER]),
        timezone: readSiteTimezone(target),
    };
}

/**
 * Returns the mouse config that should run right now, or null when the
 * mouse schedule is on and no schedule row matches the current time.
 */
export function resolveMouseConfig(
    config: MouseConfig,
    now: Date = new Date(),
): MouseConfig | null {
    if (!config.scheduleEnabled || config.schedules.length === 0) return config;
    const schedule = config.schedules.find((item) => (
        matchesSchedule(item, now, config.timezone)
    ));
    if (!schedule) return null;
    return {
        ...config,
        effect: schedule.effect,
        color: schedule.color,
        customColor: schedule.customColor,
        amount: schedule.amount,
        size: schedule.size,
        emojis: schedule.emojis,
        text: schedule.text,
        clickBurst: schedule.clickBurst,
    };
}

export function mouseSignature(config: MouseConfig): string {
    return JSON.stringify(config);
}

/** Everything that changes how the running canvas looks (schedules excluded). */
export function mouseVisualSignature(config: MouseConfig): string {
    return JSON.stringify([
        config.effect,
        config.color,
        config.customColor,
        config.amount,
        config.size,
        config.emojis,
        config.text,
        config.clickBurst,
    ]);
}
