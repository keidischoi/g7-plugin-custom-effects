import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
    schema: Record<string, unknown>;
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
        expect(boundControls).toHaveLength(10);
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
