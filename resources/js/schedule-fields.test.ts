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

    it('replaces the enabled select with a checkbox that still updates the select', () => {
        document.body.innerHTML = `
            <div class="g7-custom-effects-schedule-list">
                <div class="g7-custom-effects-schedule-dfl-row">
                    <div>⋮⋮</div>
                    <div>
                        <select class="g7-custom-effects-schedule-enabled-select">
                            <option value="true">사용</option>
                            <option value="false">안함</option>
                        </select>
                    </div>
                    <div><select><option>눈</option></select></div>
                </div>
            </div>
        `;

        const stop = enhanceSchedulePickers(window);
        const row = document.querySelector('.g7-custom-effects-schedule-dfl-row');
        const select = row?.querySelector('select') as HTMLSelectElement;
        const checkbox = row?.querySelector(
            'input.g7-custom-effects-schedule-enabled',
        ) as HTMLInputElement;
        const effectSelect = row?.children[2]?.querySelector('select') as HTMLSelectElement;

        expect(checkbox).toBeTruthy();
        expect(checkbox.type).toBe('checkbox');
        expect(checkbox.checked).toBe(true);
        expect(checkbox.getAttribute('aria-label')).toBe('사용');
        expect(select.dataset.g7EnabledToggle).toBe('1');
        expect(row?.querySelectorAll('input.g7-custom-effects-schedule-enabled')).toHaveLength(1);
        expect(effectSelect).toBeTruthy();
        expect(row?.children[2]?.querySelector('input[type="checkbox"]')).toBeNull();

        let changes = 0;
        select.addEventListener('change', () => {
            changes += 1;
        });

        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        expect(select.value).toBe('false');
        expect(changes).toBe(1);

        select.value = 'true';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(checkbox.checked).toBe(true);

        enhanceSchedulePickers(window);
        expect(row?.querySelectorAll('input.g7-custom-effects-schedule-enabled')).toHaveLength(1);
        stop();
    });

    it('treats an empty enabled value as checked and wraps a bare select', () => {
        document.body.innerHTML = `
            <div class="g7-custom-effects-schedule-list">
                <div class="g7-custom-effects-schedule-dfl-row">
                    <div>⋮⋮</div>
                    <select>
                        <option value="true">사용</option>
                        <option value="false">안함</option>
                    </select>
                </div>
            </div>
        `;
        const select = document.querySelector('select') as HTMLSelectElement;
        select.value = '';

        const stop = enhanceSchedulePickers(window);
        const checkbox = document.querySelector(
            'input.g7-custom-effects-schedule-enabled',
        ) as HTMLInputElement;
        const host = document.querySelector('.g7-custom-effects-schedule-enabled-host');

        expect(host).toBeTruthy();
        expect(host?.contains(select)).toBe(true);
        expect(checkbox.checked).toBe(true);
        stop();
    });
});
