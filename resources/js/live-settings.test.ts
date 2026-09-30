import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLUGIN_IDENTIFIER, normalizeConfig } from './config';
import {
    SETTINGS_REVISION_KEY,
    createSettingsPuller,
    hasInlineSettings,
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
        await target.fetch('/api/admin/plugins/custom-effects/settings', {
            method: 'PUT',
            body: '{}',
        });
        expect(onSaved).toHaveBeenCalledTimes(1);

        pingSettingsRevision(target);
        expect(stored[SETTINGS_REVISION_KEY]).toBeTruthy();
        stop();
    });

    it('shares one in-flight request and skips pulls inside the minimum gap', async () => {
        let resolveFetch: (value: unknown) => void = () => {};
        const fetch = vi.fn().mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
        let clock = 1_000;
        const target = { fetch, document: { hidden: false }, G7Config: {} } as unknown as Window;
        const puller = createSettingsPuller(target, 20_000, () => clock);
        const a = puller.pull();
        const b = puller.pull();
        expect(fetch).toHaveBeenCalledTimes(1);
        resolveFetch({ ok: true, json: async () => ({ data: { effect: 'rain' } }) });
        await a;
        await b;
        clock += 5_000;
        await puller.pull();
        expect(fetch).toHaveBeenCalledTimes(1);
        fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { effect: 'snow' } }) });
        await puller.pull(true);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('does not pull from a hidden tab unless forced', async () => {
        const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
        const target = { fetch, document: { hidden: true }, G7Config: {} } as unknown as Window;
        const puller = createSettingsPuller(target, 0);
        await puller.pull();
        expect(fetch).not.toHaveBeenCalled();
        await puller.pull(true);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('detects settings that came with the page', () => {
        expect(hasInlineSettings({ G7Config: { plugins: { [PLUGIN_IDENTIFIER]: { effect: 'snow' } } } } as unknown as Window)).toBe(true);
        expect(hasInlineSettings({ G7Config: { plugins: {} } } as unknown as Window)).toBe(false);
        expect(hasInlineSettings({} as Window)).toBe(false);
    });
});
