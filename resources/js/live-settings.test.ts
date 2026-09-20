import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLUGIN_IDENTIFIER, normalizeConfig } from './config';
import {
    SETTINGS_REVISION_KEY,
    fetchPublicSettings,
    pingSettingsRevision,
    publicSettingsUrl,
    settingsSignature,
    watchAdminSettingsSave,
    writePluginConfig,
} from './live-settings';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('live settings', () => {
    it('builds the public plugin settings URL', () => {
        expect(publicSettingsUrl({} as Window)).toBe(
            `/api/plugins/${PLUGIN_IDENTIFIER}/settings`,
        );
        expect(publicSettingsUrl({
            G7Config: { apiPrefix: '/board/api/' },
        } as unknown as Window)).toBe(
            `/board/api/plugins/${PLUGIN_IDENTIFIER}/settings`,
        );
    });

    it('reads settings from a G7 success payload', async () => {
        const target = {
            fetch: vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ success: true, data: { effect: 'rain', intensity: 40 } }),
            }),
        } as unknown as Window;

        await expect(fetchPublicSettings(target)).resolves.toEqual({
            effect: 'rain',
            intensity: 40,
        });
    });

    it('writes fetched settings into G7Config for the next boot', () => {
        const target = { G7Config: {} } as unknown as Window;
        writePluginConfig(target, { effect: 'hearts', schedule_enabled: true });
        expect(
            (target as Window & { G7Config: { plugins: Record<string, unknown> } })
                .G7Config.plugins[PLUGIN_IDENTIFIER],
        ).toEqual({ effect: 'hearts', schedule_enabled: true });
    });

    it('changes the signature when a schedule row is saved', () => {
        const before = settingsSignature(normalizeConfig({ effect: 'snow' }));
        const after = settingsSignature(normalizeConfig({
            effect: 'snow',
            schedule_enabled: true,
            schedules: [{ effect: 'rain', start_time: '18:00' }],
        }));
        expect(before).not.toBe(after);
    });

    it('notifies other tabs after an admin settings save', async () => {
        const stored: Record<string, string> = {};
        const original = vi.fn().mockResolvedValue({ ok: true });
        const target = {
            fetch: original,
            localStorage: {
                setItem: (key: string, value: string) => {
                    stored[key] = value;
                },
            },
            BroadcastChannel: class {
                postMessage(): void {}
            },
        } as unknown as Window;

        const onSaved = vi.fn();
        const stop = watchAdminSettingsSave(target, onSaved);
<<<<<<< HEAD
        await target.fetch('/api/admin/plugins/custom-effects/settings', {
=======
        await target.fetch('/api/admin/plugins/g7-plugin-custom-effects/settings', {
>>>>>>> c296cf2d90e83e047cf94ead1b1c993fb02b9ad7
            method: 'PUT',
            body: '{}',
        });
        expect(onSaved).toHaveBeenCalledTimes(1);

        pingSettingsRevision(target);
        expect(stored[SETTINGS_REVISION_KEY]).toBeTruthy();
        stop();
    });
});
