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

    let host = parent;
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
                    element.getAttribute('aria-label') || '요일',
                    'g7-custom-effects-schedule-day-select',
                    'g7-custom-effects-schedule-day-host',
                );
            }
        });
    };

    const watch = (root: Element): void => {
        apply();
        observer?.disconnect();
        observer = new MutationObserver(apply);
        observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['type', 'placeholder'],
        });
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
    };
}
