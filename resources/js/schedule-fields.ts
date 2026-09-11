import { readSiteTimezone } from './config';
import { getZonedClock } from './schedule';

const DAY_LABELS = {
    ko: ['일', '월', '화', '수', '목', '금', '토'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} as const;

const KNOWN_DAY_NAMES = new Set<string>([...DAY_LABELS.ko, ...DAY_LABELS.en]);

function dayLabels(target: Window): readonly string[] {
    return (target.document.documentElement.lang || '').toLowerCase().startsWith('en')
        ? DAY_LABELS.en
        : DAY_LABELS.ko;
}

function dayName(select: HTMLSelectElement, target: Window): string {
    const labels = dayLabels(target);
    const existing = select.parentElement?.querySelector('label')?.textContent?.trim() ?? '';
    if (KNOWN_DAY_NAMES.has(existing)) return existing;
    const aria = select.getAttribute('aria-label')?.trim() ?? '';
    if (KNOWN_DAY_NAMES.has(aria)) return aria;

    const row = select.closest('.g7-custom-effects-schedule-dfl-row');
    if (row instanceof HTMLElement) {
        const days = [...row.querySelectorAll('select.g7-custom-effects-schedule-day-select')];
        const index = days.indexOf(select);
        if (days.length === 7 && index >= 0) return labels[index];
    }

    return labels[0];
}

function isEnabledSelect(element: HTMLSelectElement): boolean {
    if (!(element instanceof HTMLSelectElement)) return false;
    if (element.classList.contains('g7-custom-effects-schedule-enabled-select')) return true;

    const parent = element.parentElement;
    if (!parent) return false;

    if (
        parent.classList.contains('g7-custom-effects-schedule-dfl-row')
        && parent.children[1] === element
    ) {
        return true;
    }

    return Boolean(
        parent.parentElement?.classList.contains('g7-custom-effects-schedule-dfl-row')
        && parent.parentElement.children[1] === parent,
    );
}

function isDaySelect(element: HTMLSelectElement): boolean {
    return element instanceof HTMLSelectElement
        && element.classList.contains('g7-custom-effects-schedule-day-select');
}

function enhanceTrueFalseToggle(
    select: HTMLSelectElement,
    flag: 'g7EnabledToggle' | 'g7DayToggle',
    className: string,
    label: string,
    selectClass: string,
    hostClass: string,
): void {
    if (select.dataset[flag] === '1') return;

    const parent = select.parentElement;
    if (!parent) return;

    select.dataset[flag] = '1';
    select.classList.add(selectClass);

    let host: Element = parent;
    if (parent.classList.contains('g7-custom-effects-schedule-dfl-row')) {
        const wrapper = select.ownerDocument.createElement('span');
        wrapper.className = hostClass;
        parent.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        host = wrapper;
    }

    const checkbox = select.ownerDocument.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = className;
    checkbox.checked = select.value !== 'false';

    checkbox.addEventListener('change', () => {
        const next = checkbox.checked ? 'true' : 'false';
        if (select.value === next) return;
        select.value = next;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    select.addEventListener('change', () => {
        checkbox.checked = select.value !== 'false';
    });

    if (flag === 'g7DayToggle') {
        checkbox.title = label;
        const wrappingLabel = select.closest('label');
        const siblingLabel = wrappingLabel ?? host.querySelector('label');

        if (siblingLabel instanceof HTMLLabelElement) {
            const wasWrapping = wrappingLabel === siblingLabel;
            siblingLabel.replaceChildren(label, checkbox);
            if (wasWrapping) siblingLabel.append(select);
            return;
        }

        const created = select.ownerDocument.createElement('label');
        created.className = 'g7-custom-effects-schedule-day-label';
        created.append(label, checkbox);
        host.insertBefore(created, select);
        return;
    }

    checkbox.title = label;
    checkbox.setAttribute('aria-label', label);
    host.insertBefore(checkbox, select);
}

function formValue(target: Window, name: string): string {
    const control = target.document.querySelector(`[name="${name}"]`);
    return control instanceof HTMLInputElement || control instanceof HTMLSelectElement
        ? control.value.trim()
        : '';
}

function assignValue(
    element: HTMLInputElement | HTMLSelectElement,
    next: string,
    force = false,
): void {
    if (!next || (!force && element.value) || element.value === next) return;
    element.value = next;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function fillEmptyScheduleRow(row: HTMLElement, target: Window = window): void {
    const effect = row.children[2]?.querySelector('select');
    if (!(effect instanceof HTMLSelectElement) || effect.value) return;

    const clock = getZonedClock(new Date(), readSiteTimezone(target));
    const defaults = {
        effect: formValue(target, 'effect') || 'snow',
        intensity: formValue(target, 'intensity') || '100',
        speed: formValue(target, 'speed') || '100',
        opacity: formValue(target, 'opacity') || '75',
        wind: formValue(target, 'wind') || '0',
        wind_direction: formValue(target, 'wind_direction') || 'none',
        color: formValue(target, 'color') || '#ffffff',
    };

    assignValue(effect, defaults.effect, true);

    [...row.querySelectorAll('input')].forEach((input) => {
        if (!(input instanceof HTMLInputElement)) return;
        const placeholder = input.getAttribute('placeholder') ?? '';
        if (input.type === 'date' || placeholder.includes('YYYY-MM-DD')) {
            assignValue(input, clock.date, true);
            return;
        }
        if (input.type === 'time' || placeholder.includes('HH:MM')) {
            assignValue(input, clock.time, true);
        }
    });

    const numbers = [...row.querySelectorAll('input[type="number"]')];
    (['intensity', 'speed', 'opacity', 'wind'] as const).forEach((key, index) => {
        const input = numbers[index];
        if (input instanceof HTMLInputElement) assignValue(input, defaults[key], true);
    });

    const extraSelects = [...row.querySelectorAll('select')].filter((select) => (
        select !== effect
        && !select.classList.contains('g7-custom-effects-schedule-enabled-select')
        && !select.classList.contains('g7-custom-effects-schedule-day-select')
    ));
    if (extraSelects[0]) assignValue(extraSelects[0], defaults.wind_direction, true);
    if (extraSelects[1]) assignValue(extraSelects[1], defaults.color, true);
}

function isAddScheduleButton(button: Element): boolean {
    const label = button.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return /예약 추가|Add schedule/i.test(label);
}

export function enhanceSchedulePickers(target: Window = window): () => void {
    let observer: MutationObserver | null = null;

    const apply = (): void => {
        const root = target.document.querySelector('.g7-custom-effects-schedule-list');
        if (!root) return;

        root.querySelectorAll('input').forEach((element) => {
            if (!(element instanceof HTMLInputElement)) return;
            const placeholder = element.getAttribute('placeholder') ?? '';
            if (placeholder.includes('YYYY-MM-DD') && element.type !== 'date') {
                element.type = 'date';
            }
            if (placeholder.includes('HH:MM') && element.type !== 'time') {
                element.type = 'time';
                element.step = '60';
            }
        });

        root.querySelectorAll('select').forEach((element) => {
            if (isEnabledSelect(element)) {
                enhanceTrueFalseToggle(
                    element,
                    'g7EnabledToggle',
                    'g7-custom-effects-schedule-enabled',
                    '사용',
                    'g7-custom-effects-schedule-enabled-select',
                    'g7-custom-effects-schedule-enabled-host',
                );
                return;
            }
            if (isDaySelect(element)) {
                enhanceTrueFalseToggle(
                    element,
                    'g7DayToggle',
                    'g7-custom-effects-schedule-day',
                    dayName(element, target),
                    'g7-custom-effects-schedule-day-select',
                    'g7-custom-effects-schedule-day-host',
                );
            }
        });
    };

    const watch = (root: Element): void => {
        apply();
        observer?.disconnect();
        observer = new MutationObserver(() => {
            apply();
            const rows = root.querySelectorAll('.g7-custom-effects-schedule-dfl-row');
            const last = rows[rows.length - 1];
            if (last instanceof HTMLElement) fillEmptyScheduleRow(last, target);
        });
        observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['type', 'placeholder'],
        });
        root.addEventListener('click', onAddClick);
    };

    const onAddClick = (event: Event): void => {
        const clicked = event.target;
        if (!(clicked instanceof Element)) return;
        const button = clicked.closest('button');
        if (!button || !isAddScheduleButton(button)) return;
        const fillLast = (): void => {
            const root = target.document.querySelector('.g7-custom-effects-schedule-list');
            const rows = root?.querySelectorAll('.g7-custom-effects-schedule-dfl-row');
            const last = rows?.[rows.length - 1];
            if (last instanceof HTMLElement) fillEmptyScheduleRow(last, target);
        };
        target.setTimeout(fillLast, 0);
        target.setTimeout(fillLast, 50);
    };

    const finder = new MutationObserver(() => {
        const root = target.document.querySelector('.g7-custom-effects-schedule-list');
        if (!root) return;
        finder.disconnect();
        watch(root);
    });

    const existing = target.document.querySelector('.g7-custom-effects-schedule-list');
    if (existing) {
        watch(existing);
    } else {
        finder.observe(target.document.documentElement, { childList: true, subtree: true });
    }

    return () => {
        finder.disconnect();
        observer?.disconnect();
        target.document.querySelector('.g7-custom-effects-schedule-list')
            ?.removeEventListener('click', onAddClick);
    };
}
