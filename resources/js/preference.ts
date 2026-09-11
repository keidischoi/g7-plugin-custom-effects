export const EFFECTS_PREFERENCE_KEY = 'g7-plugin-custom-effects:user-enabled';

export interface PreferenceStorage {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
}

export function readEffectsPreference(storage: PreferenceStorage): boolean {
    try {
        const saved = storage.getItem(EFFECTS_PREFERENCE_KEY);
        return saved === null ? true : saved !== 'false';
    } catch {
        return true;
    }
}

export function writeEffectsPreference(
    storage: PreferenceStorage,
    enabled: boolean,
): void {
    try {
        storage.setItem(EFFECTS_PREFERENCE_KEY, String(enabled));
    } catch {
        // Storage can be unavailable in private or sandboxed contexts.
    }
}
