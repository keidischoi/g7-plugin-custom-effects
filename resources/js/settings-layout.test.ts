import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COLOR_OPTIONS, EFFECT_KINDS, TIMEZONE_OPTIONS } from './config';

interface LayoutNode {
    name?: string;
    props?: {
        name?: string;
    };
    [key: string]: unknown;
}

const layout = JSON.parse(readFileSync(
    resolve(import.meta.dirname, '../layouts/admin/plugin_settings.json'),
    'utf8',
)) as {
    schema: Record<string, unknown> & {
        effect: { options: string[] };
        color: { options: string[] };
        wind_direction: { options: string[] };
        schedules?: { type: string };
    };
    data_sources: Array<{ initLocal?: string }>;
    slots: unknown;
};
const effectsCss = readFileSync(resolve(import.meta.dirname, '../css/effects.css'), 'utf8');

function collectBoundControls(value: unknown, result = new Set<string>()): Set<string> {
    if (Array.isArray(value)) {
        value.forEach((item) => collectBoundControls(item, result));
        return result;
    }

    if (!value || typeof value !== 'object') return result;

    const node = value as LayoutNode;
    if (
        node.name
        && ['Input', 'Select', 'Toggle', 'DynamicFieldList'].includes(node.name)
        && typeof node.props?.name === 'string'
    ) {
        result.add(node.props.name.startsWith('schedules') ? 'schedules' : node.props.name);
    }

    Object.values(node).forEach((item) => collectBoundControls(item, result));
    return result;
}

describe('plugin settings layout', () => {
    it('renders one bound control for every schema setting', () => {
        const schemaFields = Object.keys(layout.schema).sort();
        const boundControls = [...collectBoundControls(layout.slots)].sort();

        expect(boundControls).toEqual(schemaFields);
        expect(boundControls).toHaveLength(13);
    });

    it('offers every effect supported by the canvas engine', () => {
        expect(layout.schema.effect.options).toEqual(EFFECT_KINDS);

        const renderedOptions = EFFECT_KINDS.filter((effect) => (
            JSON.stringify(layout.slots).includes(`"value":"${effect}"`)
        ));
        expect(renderedOptions).toEqual(EFFECT_KINDS);
    });

    it('keeps preset dropdowns aligned with runtime normalization', () => {
        expect(layout.schema.color.options).toEqual(COLOR_OPTIONS);
        expect(layout.schema.wind_direction.options).toEqual([
            'none',
            'left',
            'right',
            'random',
        ]);
        expect(layout.schema.schedules?.type).toBe('array');

        const slots = JSON.stringify(layout.slots);
        expect(slots).toContain('"name":"DynamicFieldList"');
        expect(slots).toContain('"name":"schedules"');
        expect(slots).toContain('"placeholder":"YYYY-MM-DD"');
        expect(slots).toContain('"placeholder":"HH:MM"');
        for (const value of [...COLOR_OPTIONS, ...TIMEZONE_OPTIONS]) {
            expect(slots).toContain(`"value":"${value}"`);
        }
        for (const day of ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']) {
            expect(slots).toContain(`"key":"${day}"`);
        }
    });

    it('keeps schedule controls within plugin-owned equal padding', () => {
        const slots = JSON.stringify(layout.slots);
        expect(slots).toContain('"className":"g7-custom-effects-schedule-grid"');
        expect(slots).toContain('g7-custom-effects-schedule-list');
        expect(effectsCss).toContain('.g7-custom-effects-schedule-grid {');
        expect(effectsCss).toContain('padding: 1rem 1.5rem;');
        expect(slots).toContain('g7-custom-effects-schedule-dfl-header');
        expect(slots).toContain('g7-custom-effects-schedule-dfl-row');
        expect(effectsCss).toContain('grid-row: 2');
        expect(effectsCss).toContain('.g7-custom-effects-schedule-dfl-row {');
        expect(effectsCss).toContain('grid-template-columns: 1.5rem 2rem repeat(7, minmax(3.2rem, 0.55fr))');
        expect(effectsCss).toContain('.g7-custom-effects-schedule-full {');
        expect(effectsCss).toContain('grid-column: 5 / 10');
        expect(effectsCss).toContain('> :nth-child(9) { grid-column: 3; grid-row: 2; }');
        expect(effectsCss).toContain('> :nth-child(15) { grid-column: 9; grid-row: 2; }');
        expect(effectsCss).toContain('input[type="date"]');
        expect(effectsCss).toContain('input[type="time"]');
        expect(effectsCss).toContain('content: "시작 시간"');
    });

    it('loads settings into the local form and provides a complete save flow', () => {
        expect(layout.data_sources[0]?.initLocal).toBe('form');

        const slots = JSON.stringify(layout.slots);
        expect(slots).toContain('"handler":"apiCall"');
        expect(slots).toContain('"body":"{{_local.form}}"');
        expect(slots).toContain('"handler":"refetchDataSource"');
        expect(slots).toContain('"onError"');
    });
});
