import { describe, expect, it, vi } from 'vitest';
import {
    EFFECTS_PREFERENCE_KEY,
    readEffectsPreference,
    writeEffectsPreference,
} from './preference';

describe('user effects preference', () => {
    it('defaults to enabled and restores an explicit choice', () => {
        const values = new Map<string, string>();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        };

        expect(readEffectsPreference(storage)).toBe(true);
        writeEffectsPreference(storage, false);
        expect(values.get(EFFECTS_PREFERENCE_KEY)).toBe('false');
        expect(readEffectsPreference(storage)).toBe(false);
    });

    it('fails open when browser storage is unavailable', () => {
        const storage = {
            getItem: vi.fn(() => {
                throw new Error('blocked');
            }),
            setItem: vi.fn(() => {
                throw new Error('blocked');
            }),
        };

        expect(readEffectsPreference(storage)).toBe(true);
        expect(() => writeEffectsPreference(storage, false)).not.toThrow();
    });
});
