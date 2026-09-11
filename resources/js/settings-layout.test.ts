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
        schedule_timezone: { options: string[] };
        wind_direction: { options: string[] };
    };
    data_sources: Array<{ initLocal?: string }>;
    slots: unknown;
};

function collectBoundControls(value: unknown, result = new Set<string>()): Set<string> {
    if (Array.isArray(value)) {
        value.forEach((item) => collectBoundControls(item, result));
        return result;
    }

    if (!value || typeof value !== 'object') return result;

    const node = value as LayoutNode;
    if (
        node.name
        && ['Input', 'Select', 'Toggle'].includes(node.name)
        && typeof node.props?.name === 'string'
    ) {
        result.add(node.props.name);
    }

    Object.values(node).forEach((item) => collectBoundControls(item, result));
    return result;
}

describe('plugin settings layout', () => {
    it('renders one bound control for every schema setting', () => {
        const schemaFields = Object.keys(layout.schema).sort();
        const boundControls = [...collectBoundControls(layout.slots)].sort();

        expect(boundControls).toEqual(schemaFields);
        expect(boundControls).toHaveLength(18);
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
        expect(layout.schema.schedule_timezone.options).toEqual(TIMEZONE_OPTIONS);
        expect(layout.schema.wind_direction.options).toEqual([
            'none',
            'left',
            'right',
            'random',
        ]);

        const slots = JSON.stringify(layout.slots);
        for (const value of [...COLOR_OPTIONS, ...TIMEZONE_OPTIONS]) {
            expect(slots).toContain(`"value":"${value}"`);
        }
    });

    it('keeps schedule controls within enforced equal left and right padding', () => {
        const slots = JSON.stringify(layout.slots);
        expect(slots).toContain('"style":{"padding":"1rem 1.5rem"}');
        expect(slots).not.toContain('"className":"p-6 mx-3 grid');
        expect(slots.match(/"boxSizing":"border-box","maxWidth":"100%"/g)).toHaveLength(6);
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
