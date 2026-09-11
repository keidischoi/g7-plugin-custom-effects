// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createToggleButton,
    HeaderToggleMount,
    updateToggleButton,
} from './toggle-button';
import { EFFECT_KINDS } from './config';

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe('effects header toggle', () => {
    it('mounts immediately before the theme icon without duplication', async () => {
        document.body.innerHTML = `
            <div id="header-actions">
                <div id="theme-wrapper">
                    <button aria-label="Toggle theme"></button>
                </div>
            </div>
        `;

        const mount = new HeaderToggleMount(window, 'leaves', () => true, () => false);
        mount.start();
        document.body.append(document.createElement('div'));
        await Promise.resolve();

        const themeWrapper = document.getElementById('theme-wrapper');
        const button = document.querySelector<HTMLButtonElement>(
            '[data-g7-custom-effects-toggle="true"]',
        );

        expect(button).not.toBeNull();
        expect(button?.nextElementSibling).toBe(themeWrapper);
        expect(document.querySelectorAll('[data-g7-custom-effects-toggle="true"]')).toHaveLength(1);
        expect(button?.textContent).toBe('❧');
        expect(button?.getAttribute('aria-pressed')).toBe('true');

        mount.stop();
    });

    it('toggles directly when the G7 dispatcher is not available', () => {
        let enabled = true;
        const button = createToggleButton(true, 'stars', () => {
            enabled = !enabled;
            return enabled;
        }, window);

        button.click();
        expect(enabled).toBe(false);
        expect(button.dataset.enabled).toBe('false');
        expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('updates accessible state and the selected effect symbol', () => {
        const button = createToggleButton(false, 'snow', () => true, window);
        updateToggleButton(button, true, 'hearts', window);

        expect(button.dataset.enabled).toBe('true');
        expect(button.getAttribute('aria-label')).toBe('화면 효과 끄기');
        expect(button.textContent).toBe('♥');
    });

    it('has a header symbol for every effect', () => {
        for (const effect of EFFECT_KINDS) {
            const button = createToggleButton(true, effect, () => true, window);
            expect(button.textContent?.trim().length).toBeGreaterThan(0);
        }
    });
});
