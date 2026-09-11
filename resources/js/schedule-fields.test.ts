// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { enhanceSchedulePickers, fillEmptyScheduleRow } from './schedule-fields';

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

    it('turns weekday selects into checkboxes without wrapping the row', () => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const daySelects = days.map((day) => `
            <div>
                <select class="g7-custom-effects-schedule-day-select" aria-label="${day}">
                    <option value="true">${day} 적용</option>
                    <option value="false">${day} 제외</option>
                </select>
            </div>
        `).join('');
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
                    <div><input placeholder="YYYY-MM-DD"></div>
                    <div><input placeholder="YYYY-MM-DD"></div>
                    <div><input placeholder="HH:MM"></div>
                    <div><input placeholder="HH:MM"></div>
                    ${daySelects}
                    <div><button type="button">-</button></div>
                </div>
            </div>
        `;

        const stop = enhanceSchedulePickers(window);
        const row = document.querySelector('.g7-custom-effects-schedule-dfl-row') as HTMLElement;
        const boxes = row.querySelectorAll('input.g7-custom-effects-schedule-day');
        const firstDay = row.children[7]?.querySelector('select') as HTMLSelectElement;
        const firstBox = boxes[0] as HTMLInputElement;

        expect(row.children).toHaveLength(15);
        expect(boxes).toHaveLength(7);
        expect(firstBox.closest('label')?.textContent?.trim()).toBe('일');
        expect(firstDay.dataset.g7DayToggle).toBe('1');

        firstBox.checked = false;
        firstBox.dispatchEvent(new Event('change', { bubbles: true }));
        expect(firstDay.value).toBe('false');
        stop();
    });

    it('reuses an existing weekday label instead of drawing a second caption', () => {
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
                    <div>
                        <label>월</label>
                        <select class="g7-custom-effects-schedule-day-select">
                            <option value="true">월 적용</option>
                            <option value="false">월 제외</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        const stop = enhanceSchedulePickers(window);
        const cell = document.querySelectorAll('.g7-custom-effects-schedule-dfl-row > *')[2] as HTMLElement;
        const labels = cell.querySelectorAll('label');
        const checkbox = cell.querySelector('input.g7-custom-effects-schedule-day') as HTMLInputElement;

        expect(labels).toHaveLength(1);
        expect(labels[0]?.textContent?.trim()).toBe('월');
        expect(labels[0]?.contains(checkbox)).toBe(true);
        expect(cell.querySelector('select')).toBeTruthy();
        stop();
    });

    it('replaces generic 요일 captions with Sunday-to-Saturday names', () => {
        const daySelects = Array.from({ length: 7 }, () => `
            <div>
                <label>요일</label>
                <select class="g7-custom-effects-schedule-day-select">
                    <option value="true">적용</option>
                    <option value="false">제외</option>
                </select>
            </div>
        `).join('');
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
                    <div><input placeholder="YYYY-MM-DD"></div>
                    <div><input placeholder="YYYY-MM-DD"></div>
                    <div><input placeholder="HH:MM"></div>
                    <div><input placeholder="HH:MM"></div>
                    ${daySelects}
                    <div><button type="button">-</button></div>
                </div>
            </div>
        `;

        const stop = enhanceSchedulePickers(window);
        const row = document.querySelector('.g7-custom-effects-schedule-dfl-row') as HTMLElement;
        const names = [...row.querySelectorAll('input.g7-custom-effects-schedule-day')].map((box) => (
            box.closest('label')?.childNodes[0]?.textContent?.trim()
        ));

        expect(names).toEqual(['일', '월', '화', '수', '목', '금', '토']);
        expect(row.querySelectorAll('label')).toHaveLength(7);
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

    it('fills a new empty row from the form above and the current date', () => {
        document.documentElement.lang = 'ko';
        document.body.innerHTML = `
            <select name="effect">
                <option value="snow">눈</option>
                <option value="rain" selected>비</option>
            </select>
            <input name="intensity" value="160">
            <input name="speed" value="75">
            <input name="opacity" value="50">
            <input name="wind" value="30">
            <select name="wind_direction">
                <option value="none">없음</option>
                <option value="left" selected>왼쪽</option>
            </select>
            <select name="color">
                <option value="#ffffff">흰색</option>
                <option value="#bae6fd" selected>하늘</option>
            </select>
            <div class="g7-custom-effects-schedule-list">
                <div class="g7-custom-effects-schedule-dfl-row">
                    <div>⋮⋮</div>
                    <div>
                        <select class="g7-custom-effects-schedule-enabled-select">
                            <option value="true" selected>사용</option>
                            <option value="false">안함</option>
                        </select>
                    </div>
                    <div>
                        <select>
                            <option value="">선택하세요</option>
                            <option value="snow">눈</option>
                            <option value="rain">비</option>
                        </select>
                    </div>
                    <div><input placeholder="YYYY-MM-DD"></div>
                    <div><input placeholder="YYYY-MM-DD"></div>
                    <div><input placeholder="HH:MM"></div>
                    <div><input placeholder="HH:MM"></div>
                    <div><input type="number"></div>
                    <div><input type="number"></div>
                    <div><input type="number"></div>
                    <div><input type="number"></div>
                    <div>
                        <select>
                            <option value="none">없음</option>
                            <option value="left">왼쪽</option>
                        </select>
                    </div>
                    <div>
                        <select>
                            <option value="#ffffff">흰색</option>
                            <option value="#bae6fd">하늘</option>
                        </select>
                    </div>
                    <div><button type="button">-</button></div>
                </div>
            </div>
        `;
        const effectSelect = document.querySelectorAll(
            '.g7-custom-effects-schedule-dfl-row select',
        )[1] as HTMLSelectElement;
        effectSelect.value = '';

        const stop = enhanceSchedulePickers(window);
        const row = document.querySelector('.g7-custom-effects-schedule-dfl-row') as HTMLElement;
        fillEmptyScheduleRow(row, window);

        const dates = [...row.querySelectorAll('input[type="date"]')].map((input) => (
            (input as HTMLInputElement).value
        ));
        const times = [...row.querySelectorAll('input[type="time"]')].map((input) => (
            (input as HTMLInputElement).value
        ));
        const numbers = [...row.querySelectorAll('input[type="number"]')].map((input) => (
            (input as HTMLInputElement).value
        ));

        expect(effectSelect.value).toBe('rain');
        expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(dates[1]).toBe(dates[0]);
        expect(times[0]).toMatch(/^\d{2}:\d{2}$/);
        expect(times[1]).toBe(times[0]);
        expect(numbers).toEqual(['160', '75', '50', '30']);
        expect((row.querySelectorAll('select')[2] as HTMLSelectElement).value).toBe('left');
        expect((row.querySelectorAll('select')[3] as HTMLSelectElement).value).toBe('#bae6fd');
        stop();
    });

    it('still copies form defaults when the effect is already filled', () => {
        document.documentElement.lang = 'ko';
        document.body.innerHTML = `
            <select id="effect" name="effect">
                <option value="snow">눈</option>
                <option value="rain" selected>비</option>
            </select>
            <input id="intensity" name="intensity" value="160">
            <input id="speed" name="speed" value="75">
            <input id="opacity" name="opacity" value="50">
            <input id="wind" name="wind" value="30">
            <select id="wind_direction" name="wind_direction">
                <option value="none">없음</option>
                <option value="left" selected>왼쪽</option>
            </select>
            <select id="color" name="color">
                <option value="#ffffff">흰색</option>
                <option value="#bae6fd" selected>하늘</option>
            </select>
            <div class="g7-custom-effects-schedule-list">
                <div class="g7-custom-effects-schedule-dfl-row">
                    <div>⋮⋮</div>
                    <div>
                        <select class="g7-custom-effects-schedule-enabled-select">
                            <option value="true" selected>사용</option>
                        </select>
                    </div>
                    <div>
                        <select>
                            <option value="">선택하세요</option>
                            <option value="snow">눈</option>
                            <option value="rain" selected>비</option>
                        </select>
                    </div>
                    <div><input placeholder="YYYY-MM-DD" value="2026-09-12"></div>
                    <div><input placeholder="YYYY-MM-DD"></div>
                    <div><input placeholder="HH:MM"></div>
                    <div><input placeholder="HH:MM"></div>
                    <div><input type="number"></div>
                    <div><input type="number"></div>
                    <div><input type="number"></div>
                    <div><input type="number"></div>
                    <div>
                        <select>
                            <option value="">선택하세요</option>
                            <option value="none">없음</option>
                            <option value="left">왼쪽</option>
                        </select>
                    </div>
                    <div>
                        <select>
                            <option value="">선택하세요</option>
                            <option value="#ffffff">흰색</option>
                            <option value="#bae6fd">하늘</option>
                        </select>
                    </div>
                    <div><button type="button">-</button></div>
                </div>
            </div>
        `;

        const row = document.querySelector('.g7-custom-effects-schedule-dfl-row') as HTMLElement;
        const effectSelect = row.children[2].querySelector('select') as HTMLSelectElement;
        effectSelect.value = 'rain';
        const stop = enhanceSchedulePickers(window);
        fillEmptyScheduleRow(row, window);

        expect(effectSelect.value).toBe('rain');
        expect((row.querySelectorAll('input[type="date"]')[1] as HTMLInputElement).value)
            .toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect([...row.querySelectorAll('input[type="time"]')].map((input) => (
            (input as HTMLInputElement).value
        )).every((value) => /^\d{2}:\d{2}$/.test(value))).toBe(true);
        expect([...row.querySelectorAll('input[type="number"]')].map((input) => (
            (input as HTMLInputElement).value
        ))).toEqual(['160', '75', '50', '30']);
        expect(extraSelectValue(row, 0)).toBe('left');
        expect(extraSelectValue(row, 1)).toBe('#bae6fd');
        stop();
    });
});

function extraSelectValue(row: HTMLElement, index: number): string {
    const effect = row.children[2].querySelector('select') as HTMLSelectElement;
    const selects = [...row.querySelectorAll('select')].filter((select) => (
        select !== effect
        && !select.classList.contains('g7-custom-effects-schedule-enabled-select')
        && !select.classList.contains('g7-custom-effects-schedule-day-select')
    ));
    return selects[index]?.value ?? '';
}
