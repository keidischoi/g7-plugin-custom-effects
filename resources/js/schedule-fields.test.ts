// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { enhanceSchedulePickers } from './schedule-fields';

afterEach(() => {
    document.body.replaceChildren();
});

describe('enhanceSchedulePickers', () => {
    it('converts date and time placeholders into calendar and time pickers', () => {
        document.body.innerHTML = `
            <div class="g7-custom-effects-schedule-list">
                <input placeholder="YYYY-MM-DD">
                <input placeholder="HH:MM">
                <input placeholder="other">
            </div>
        `;

        const stop = enhanceSchedulePickers(window);
        const [dateInput, timeInput, otherInput] = document.querySelectorAll('input');

        expect(dateInput?.type).toBe('date');
        expect(timeInput?.type).toBe('time');
        expect(otherInput?.type).toBe('text');
        stop();
    });

    it('converts inputs added after the observer starts', async () => {
        document.body.innerHTML = '<div class="g7-custom-effects-schedule-list"></div>';
        const stop = enhanceSchedulePickers(window);
        const root = document.querySelector('.g7-custom-effects-schedule-list');
        const dateInput = document.createElement('input');
        dateInput.setAttribute('placeholder', 'YYYY-MM-DD');
        root?.appendChild(dateInput);

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(dateInput.type).toBe('date');
        stop();
    });
});
