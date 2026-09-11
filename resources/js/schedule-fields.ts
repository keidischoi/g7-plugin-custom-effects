const DAY_LABELS = {
    ko: ['일', '월', '화', '수', '목', '금', '토'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} as const;

const OBSERVE_OPTIONS: MutationObserverInit = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['type', 'placeholder'],
};

function dayLabels(target: Window): readonly string[] {
    return (target.document.documentElement.lang || '').toLowerCase().startsWith('en')
        ? DAY_LABELS.en
        : DAY_LABELS.ko;
}

function scheduleRoot(target: Window): Element | null {
    const document = target.document;
    return document.querySelector('.g7-custom-effects-schedule-list')
        ?? document.querySelector('.g7-custom-effects-schedule-grid .dynamic-field-list');
}

function rowChild(element: Element, row: HTMLElement): Element | null {
    let current: Element | null = element;
    while (current && current.parentElement !== row) {
        current = current.parentElement;
    }
    return current;
}

function isEnabledSelect(element: HTMLSelectElement, row: HTMLElement): boolean {
    if (element.classList.contains('g7-custom-effects-schedule-enabled-select')) return true;
    if (element.dataset.g7Checkbox === 'enabled') return true;
    const cell = rowChild(element, row);
    return cell !== null && [...row.children].indexOf(cell) === 1;
}

function isDaySelect(element: HTMLSelectElement, row: HTMLElement): boolean {
    if (element.classList.contains('g7-custom-effects-schedule-day-select')) return true;
    if (element.dataset.g7Checkbox === 'day') return true;
    const cell = rowChild(element, row);
    if (!cell) return false;
    const index = [...row.children].indexOf(cell);
    return index >= 7 && index <= 13;
}

function enhanceTrueFalseCheckbox(
    select: HTMLSelectElement,
    className: string,
    label: string,
    kind: 'enabled' | 'day',
): void {
    if (select.dataset.g7Checkbox) return;
    if (select.parentElement?.querySelector(`:scope > input.${className}`)) {
        select.dataset.g7Checkbox = kind;
        return;
    }

    const parent = select.parentElement;
    if (!parent) return;

    select.dataset.g7Checkbox = kind;

    let host = parent;
    if (parent.classList.contains('g7-custom-effects-schedule-dfl-row')) {
        const wrapper = select.ownerDocument.createElement('span');
        wrapper.className = kind === 'enabled'
            ? 'g7-custom-effects-schedule-enabled-host'
            : 'g7-custom-effects-schedule-day-host';
        parent.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        host = wrapper;
    }

    const checkbox = select.ownerDocument.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = className;
    checkbox.title = label;
    checkbox.setAttribute('aria-label', label);
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

    host.insertBefore(checkbox, select);
}

function isScheduleDataRow(element: Element): element is HTMLElement {
    if (!(element instanceof HTMLElement)) return false;
    if (element.classList.contains('g7-custom-effects-schedule-dfl-row')) return true;
    const selects = element.querySelectorAll('select');
    const inputs = element.querySelectorAll('input:not([type="checkbox"])');
    return selects.length >= 8 && inputs.length >= 2;
}

function scheduleRows(root: Element): HTMLElement[] {
    const named = [...root.querySelectorAll<HTMLElement>('.g7-custom-effects-schedule-dfl-row')];
    if (named.length > 0) return named;

    return [
        ...root.querySelectorAll('tbody tr'),
        ...root.querySelectorAll('.dynamic-field-list > *'),
    ].filter(isScheduleDataRow);
}

function enhancePickers(root: Element): void {
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
}

function enhanceRows(root: Element, labels: readonly string[]): void {
    for (const row of scheduleRows(root)) {
        row.querySelectorAll('select').forEach((element) => {
            if (isEnabledSelect(element, row)) {
                enhanceTrueFalseCheckbox(
                    element,
                    'g7-custom-effects-schedule-enabled',
                    '사용',
                    'enabled',
                );
                return;
            }
            if (isDaySelect(element, row)) {
                const cell = rowChild(element, row);
                const index = cell ? [...row.children].indexOf(cell) : -1;
                enhanceTrueFalseCheckbox(
                    element,
                    'g7-custom-effects-schedule-day',
                    labels[Math.max(0, index - 7)] ?? '요일',
                    'day',
                );
            }
        });
    }
}

export function enhanceSchedulePickers(target: Window = window): () => void {
    let queued = false;

    const apply = (): void => {
        const root = scheduleRoot(target);
        if (!root) return;
        enhancePickers(root);
        enhanceRows(root, dayLabels(target));
    };

    const observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => {
            queued = false;
            observer.disconnect();
            try {
                apply();
            } finally {
                observer.observe(target.document.documentElement, OBSERVE_OPTIONS);
            }
        });
    });

    apply();
    observer.observe(target.document.documentElement, OBSERVE_OPTIONS);
    return () => {
        queued = true;
        observer.disconnect();
    };
}
