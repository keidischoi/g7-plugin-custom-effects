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
    it('offers at least 16 effects in Korean name order and matches the layout', () => {
        expect(MOUSE_EFFECT_KINDS.length).toBeGreaterThanOrEqual(16);
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
