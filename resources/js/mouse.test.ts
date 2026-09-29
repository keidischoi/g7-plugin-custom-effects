// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    MOUSE_COLOR_OPTIONS,
    MOUSE_EFFECT_KINDS,
    MOUSE_EFFECT_LABELS,
    normalizeMouseConfig,
    parseEmojiList,
    resolveMouseConfig,
    trailTextValue,
} from './mouse-config';
import { MouseEffectsEngine } from './mouse-engine';
import { enhanceSchedulePickers, fillEmptyMouseScheduleRow } from './schedule-fields';
import { shouldRunMouseEffect } from './mouse-runtime';
import {
    MOUSE_PREFERENCE_KEY,
    MouseToggleMount,
    readMousePreference,
    writeMousePreference,
} from './mouse-toggle';
import { HeaderToggleMount } from './toggle-button';

const root = resolve(import.meta.dirname, '../..');
const layout = JSON.parse(readFileSync(
    resolve(root, 'resources/layouts/admin/plugin_settings.json'),
    'utf8',
));
const defaults = JSON.parse(readFileSync(resolve(root, 'config/settings/defaults.json'), 'utf8'));

afterEach(() => {
    document.body.replaceChildren();
});

describe('mouse effect config', () => {
    it('offers 30 effects in Korean name order and matches the layout', () => {
        expect(MOUSE_EFFECT_KINDS).toHaveLength(30);
        expect(new Set(MOUSE_EFFECT_KINDS).size).toBe(30);
        const names = MOUSE_EFFECT_KINDS.map((kind) => MOUSE_EFFECT_LABELS[kind]);
        expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right, 'ko')));
        expect(layout.schema.mouse_effect.options).toEqual([...MOUSE_EFFECT_KINDS]);
        expect(layout.schema.mouse_color.options).toEqual([...MOUSE_COLOR_OPTIONS]);
        const slots = JSON.stringify(layout.slots);
        for (const kind of MOUSE_EFFECT_KINDS) {
            expect(slots).toContain(`"value":"${kind}"`);
        }
        expect(slots).toContain('"name":"mouse_schedules"');
        expect(slots).not.toContain('$t:custom-effects.settings.fields.mouse');

        for (const lang of ['ko', 'en']) {
            const options = JSON.parse(readFileSync(
                resolve(root, `resources/lang/${lang}.json`),
                'utf8',
            )).settings.mouse_options as Record<string, string>;
            for (const kind of MOUSE_EFFECT_KINDS) expect(options[kind]).toBeTruthy();
        }
        const php = readFileSync(resolve(root, 'plugin.php'), 'utf8');
        for (const kind of MOUSE_EFFECT_KINDS) expect(php).toContain(`'${kind}',`);
    });

    it('builds mouse schedule rows from the same picker columns as screen schedules', () => {
        const findList = (value: unknown): Record<string, any> | null => {
            if (Array.isArray(value)) {
                for (const item of value) {
                    const found = findList(item);
                    if (found) return found;
                }
                return null;
            }
            if (!value || typeof value !== 'object') return null;
            const node = value as Record<string, any>;
            if (node.name === 'DynamicFieldList' && node.props?.name === 'mouse_schedules') return node;
            for (const item of Object.values(node)) {
                const found = findList(item);
                if (found) return found;
            }
            return null;
        };
        const list = findList(layout.slots);
        expect(list?.props.headerClassName).toBe('g7-custom-effects-schedule-dfl-header');
        expect(list?.props.rowClassName).toContain('g7-custom-effects-schedule-dfl-row');
        const columns = list?.props.columns as Array<Record<string, any>>;
        expect(columns.map((column) => column.key)).toEqual([
            'enabled', 'mouse_effect', 'start_date', 'start_time', 'end_date', 'end_time', 'mouse_color',
            'mouse_custom_color', 'mouse_amount', 'mouse_size', 'mouse_click_burst', 'mouse_emojis', 'mouse_text',
            'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat',
        ]);
        expect(columns[0].className).toBe('g7-custom-effects-schedule-enabled-select');
        expect(columns[2].placeholder).toBe('YYYY-MM-DD');
        expect(columns[3].placeholder).toBe('HH:MM');
        expect(columns[4].placeholder).toBe('YYYY-MM-DD');
        expect(columns[5].placeholder).toBe('HH:MM');
        const optionKeys = Object.keys(layout.schema).filter((key) => (
            key.startsWith('mouse_') && !key.startsWith('mouse_schedule') && key !== 'mouse_enabled'
        ));
        for (const key of optionKeys) expect(columns.map((column) => column.key)).toContain(key);
        columns.slice(13).forEach((column) => {
            expect(column.className).toBe('g7-custom-effects-schedule-day-select');
        });
    });

    it('lets an active schedule row override every mouse option, blank falls back', () => {
        const base = {
            mouse_enabled: true,
            mouse_effect: 'hearts',
            mouse_color: 'default',
            mouse_custom_color: '#123456',
            mouse_amount: 80,
            mouse_size: 120,
            mouse_emojis: '🍀',
            mouse_text: '기본 문구',
            mouse_click_burst: false,
            mouse_schedule_enabled: true,
        };
        const full = resolveMouseConfig(normalizeMouseConfig({
            ...base,
            mouse_schedules: [{
                mouse_effect: 'text_trail',
                mouse_color: 'rainbow',
                mouse_custom_color: '',
                mouse_amount: '150',
                mouse_size: 60,
                mouse_click_burst: 'true',
                mouse_emojis: '🎄 ⛄',
                mouse_text: '메리 크리스마스',
            }],
        }));
        expect(full).toMatchObject({
            effect: 'text_trail',
            color: 'rainbow',
            customColor: '',
            amount: 150,
            size: 60,
            clickBurst: true,
            emojis: ['🎄', '⛄'],
            text: '메리 크리스마스',
        });

        const blank = resolveMouseConfig(normalizeMouseConfig({
            ...base,
            mouse_schedules: [{
                mouse_effect: '',
                mouse_color: '',
                mouse_custom_color: '',
                mouse_amount: '',
                mouse_size: null,
                mouse_click_burst: '',
                mouse_emojis: '  ',
                mouse_text: '',
            }],
        }));
        expect(blank).toMatchObject({
            effect: 'hearts',
            color: 'default',
            customColor: '#123456',
            amount: 80,
            size: 120,
            clickBurst: false,
            emojis: ['🍀'],
            text: '기본 문구',
        });

        const ownHex = resolveMouseConfig(normalizeMouseConfig({
            ...base,
            mouse_schedules: [{ mouse_custom_color: '#abcdef' }],
        }));
        expect(ownHex?.customColor).toBe('#abcdef');
    });

    it('reads per-day flags and still accepts 1.1.0 all/weekdays/weekends rows', () => {
        const config = normalizeMouseConfig({
            mouse_schedules: [
                { sun: 'false', mon: 'true', tue: 'true', wed: 'true', thu: 'true', fri: 'true', sat: 'false' },
                { days: 'weekends' },
                {},
            ],
        });
        expect(config.schedules[0].days).toEqual([1, 2, 3, 4, 5]);
        expect(config.schedules[1].days).toEqual([0, 6]);
        expect(config.schedules[2].days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('is off by default and exposes every setting to the front end', () => {
        const config = normalizeMouseConfig({});
        expect(config.enabled).toBe(false);
        expect(config.effect).toBe('sparkle_stars');
        expect(defaults.defaults.mouse_enabled).toBe(false);
        Object.keys(layout.schema)
            .filter((key) => key.startsWith('mouse_'))
            .forEach((key) => {
                expect(defaults.defaults).toHaveProperty(key);
                expect(defaults.frontend_schema[key]?.expose).toBe(true);
            });
    });

    it('normalizes values from the admin form', () => {
        const config = normalizeMouseConfig({
            mouse_enabled: '1',
            mouse_effect: 'emoji',
            mouse_color: 'rainbow',
            mouse_custom_color: '#FF66CC',
            mouse_amount: '999',
            mouse_size: 10,
            mouse_emojis: '🍀, 🐱  🎈',
            mouse_text: '  안녕   하세요 ',
        });
        expect(config).toMatchObject({
            enabled: true,
            effect: 'emoji',
            color: 'rainbow',
            customColor: '#ff66cc',
            amount: 200,
            size: 50,
            emojis: ['🍀', '🐱', '🎈'],
            text: '안녕 하세요',
        });
        expect(normalizeMouseConfig({ mouse_effect: 'nope', mouse_custom_color: 'red' }))
            .toMatchObject({ effect: 'sparkle_stars', customColor: '' });
        expect(parseEmojiList('')).toEqual(normalizeMouseConfig({}).emojis);
        expect(trailTextValue('')).toBe('Hello G7');
    });

    it('uses the matching mouse schedule row and hides the effect outside of it', () => {
        const config = {
            ...normalizeMouseConfig({
                mouse_enabled: true,
                mouse_effect: 'hearts',
                mouse_schedule_enabled: true,
                mouse_schedules: [
                    { enabled: 'false', mouse_effect: 'comet', start_time: '00:00', end_time: '23:59' },
                    {
                        enabled: 'true',
                        mouse_effect: 'snowflakes',
                        mouse_color: '#bae6fd',
                        start_date: '2026-12-24',
                        end_date: '2026-12-25',
                        days: 'all',
                    },
                ],
            }),
            timezone: 'Asia/Seoul',
        };
        const christmas = resolveMouseConfig(config, new Date('2026-12-24T03:00:00Z'));
        expect(christmas?.effect).toBe('snowflakes');
        expect(christmas?.color).toBe('#bae6fd');
        expect(resolveMouseConfig(config, new Date('2026-12-26T03:00:00Z'))).toBeNull();
        expect(resolveMouseConfig({ ...config, scheduleEnabled: false })?.effect).toBe('hearts');

        const weekends = {
            ...config,
            schedules: [{ ...config.schedules[1], startDate: '', endDate: '', days: [0, 6] }],
        };
        // 2026-09-26 is a Saturday, 2026-09-28 a Monday in Asia/Seoul.
        expect(resolveMouseConfig(weekends, new Date('2026-09-26T03:00:00Z'))).not.toBeNull();
        expect(resolveMouseConfig(weekends, new Date('2026-09-28T03:00:00Z'))).toBeNull();
    });

    it('never runs on touch devices, when the visitor turned it off, or with reduced motion', () => {
        const config = normalizeMouseConfig({ mouse_enabled: true });
        const base = { userEnabled: true, userPage: true, coarse: false, reducedMotion: false };
        expect(shouldRunMouseEffect(config, base)).toBe(true);
        expect(shouldRunMouseEffect(config, { ...base, coarse: true })).toBe(false);
        expect(shouldRunMouseEffect(config, { ...base, userEnabled: false })).toBe(false);
        expect(shouldRunMouseEffect(config, { ...base, reducedMotion: true })).toBe(false);
        expect(shouldRunMouseEffect(config, { ...base, userPage: false })).toBe(false);
        expect(shouldRunMouseEffect(normalizeMouseConfig({}), base)).toBe(false);
        expect(shouldRunMouseEffect(null, base)).toBe(false);
    });

    it('does not throw when canvas is unavailable', () => {
        const config = normalizeMouseConfig({ mouse_enabled: true });
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = (() => null) as typeof original;
        try {
            expect(MouseEffectsEngine.start(config, window)).toBeNull();
        } finally {
            HTMLCanvasElement.prototype.getContext = original;
        }
    });
});

describe('mouse schedule pickers', () => {
    const cell = (inner: string): string => `<div class="flex-1 min-w-0"><div class="w-full">${inner}</div></div>`;
    const daySelect = '<select class="g7-custom-effects-schedule-day-select"><option value="">선택하세요</option><option value="true">적용</option><option value="false">제외</option></select>';

    it('turns mouse schedule date/time inputs into native pickers and days into checkboxes', async () => {
        document.body.innerHTML = `
            <select name="mouse_effect"><option value="hearts" selected>하트</option></select>
            <div class="g7-custom-effects-schedule-list"></div>
            <div class="g7-custom-effects-schedule-list g7-custom-effects-mouse-schedule-list">
                <div class="g7-custom-effects-schedule-dfl-row g7-custom-effects-mouse-schedule-row">
                    <div>≡</div>
                    ${cell('<select class="g7-custom-effects-schedule-enabled-select"><option value="true">사용</option><option value="false">중지</option></select>')}
                    ${cell('<select><option value="">선택하세요</option><option value="hearts">하트</option></select>')}
                    ${cell('<input type="text" placeholder="YYYY-MM-DD">')}
                    ${cell('<input type="text" placeholder="HH:MM">')}
                    ${cell('<input type="text" placeholder="YYYY-MM-DD">')}
                    ${cell('<input type="text" placeholder="HH:MM">')}
                    ${cell('<select><option value="">선택하세요</option><option value="default">효과 기본색</option></select>')}
                    ${cell('<input type="text" placeholder="#ff66cc">')}
                    ${cell('<input type="number" placeholder="기본">')}
                    ${cell('<input type="number" placeholder="기본">')}
                    ${cell('<select><option value="">선택하세요</option><option value="true">켜기</option><option value="false">끄기</option></select>')}
                    ${cell('<input type="text" placeholder="비우면 기본 설정">')}
                    ${cell('<input type="text" placeholder="비우면 기본 설정">')}
                    ${Array.from({ length: 7 }, () => cell(daySelect)).join('')}
                    <div><button>-</button></div>
                </div>
            </div>
        `;
        const stop = enhanceSchedulePickers(window);
        await Promise.resolve();
        const list = document.querySelector('.g7-custom-effects-mouse-schedule-list') as HTMLElement;
        const inputs = ([...list.querySelectorAll('input')] as HTMLInputElement[])
            .filter((input) => /YYYY-MM-DD|HH:MM/.test(input.placeholder));
        expect(inputs.map((input) => input.type)).toEqual(['date', 'time', 'date', 'time']);
        expect(inputs[1].step).toBe('60');
        expect(list.querySelectorAll('input.g7-custom-effects-schedule-day')).toHaveLength(7);
        expect(list.querySelectorAll('input.g7-custom-effects-schedule-enabled')).toHaveLength(1);
        const dayLabels = [...list.querySelectorAll('.g7-custom-effects-schedule-day-select')]
            .map((select) => select.parentElement?.querySelector('label')?.textContent?.trim());
        expect(dayLabels).toEqual(['일', '월', '화', '수', '목', '금', '토']);

        const row = list.querySelector('.g7-custom-effects-mouse-schedule-row') as HTMLElement;
        fillEmptyMouseScheduleRow(row, window);
        expect(inputs[0].value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(inputs[1].value).toMatch(/^\d{2}:\d{2}$/);
        expect(inputs[2].value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(inputs[3].value).toMatch(/^\d{2}:\d{2}$/);
        const selects = row.querySelectorAll('select');
        expect(selects[1].value).toBe('hearts');

        // Effect-specific fields are toggled by the row's chosen effect.
        expect(row.dataset.mouseEffect).toBe('hearts');
        selects[1].value = '';
        selects[1].dispatchEvent(new Event('change', { bubbles: true }));
        expect(row.dataset.mouseEffect).toBe('');
        stop();
    });
});

describe('mouse effect header toggle', () => {
    it('remembers the visitor choice in localStorage', () => {
        const values = new Map<string, string>();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        };
        expect(readMousePreference(storage)).toBe(true);
        writeMousePreference(storage, false);
        expect(values.get(MOUSE_PREFERENCE_KEY)).toBe('false');
        expect(readMousePreference(storage)).toBe(false);
    });

    it('mounts right after the screen-effect icon, before the theme icon', async () => {
        document.body.innerHTML = `
            <div id="header-actions">
                <div id="theme-wrapper"><button aria-label="Toggle theme"></button></div>
            </div>
        `;
        let enabled = true;
        const mouse = new MouseToggleMount(window, () => enabled, () => {
            enabled = !enabled;
            return enabled;
        });
        mouse.start();
        const effects = new HeaderToggleMount(window, 'snow', () => true, () => false);
        effects.start();
        await Promise.resolve();

        const host = document.getElementById('header-actions');
        const order = Array.from(host?.children ?? []).map((child) => (
            child.id || (child as HTMLElement).dataset.g7CustomMouseToggle && 'mouse' || 'effects'
        ));
        expect(order).toEqual(['effects', 'mouse', 'theme-wrapper']);

        const button = document.querySelector<HTMLButtonElement>('[data-g7-custom-mouse-toggle="true"]');
        expect(button?.getAttribute('aria-label')).toBe('마우스 효과 끄기');
        button?.click();
        expect(button?.dataset.enabled).toBe('false');
        expect(button?.getAttribute('aria-label')).toBe('마우스 효과 켜기');

        mouse.stop();
        effects.stop();
        expect(document.querySelector('[data-g7-custom-mouse-toggle="true"]')).toBeNull();
    });
});
