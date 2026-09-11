function isEnabledSelect(element: Element): element is HTMLSelectElement {
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

function enhanceEnabledToggle(select: HTMLSelectElement): void {
    if (select.dataset.g7EnabledToggle === '1') return;

    const parent = select.parentElement;
    if (!parent) return;

    select.dataset.g7EnabledToggle = '1';
    select.classList.add('g7-custom-effects-schedule-enabled-select');

    let host = parent;
    if (parent.classList.contains('g7-custom-effects-schedule-dfl-row')) {
        const wrapper = select.ownerDocument.createElement('span');
        wrapper.className = 'g7-custom-effects-schedule-enabled-host';
        parent.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        host = wrapper;
    }

    const checkbox = select.ownerDocument.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'g7-custom-effects-schedule-enabled';
    checkbox.title = '사용';
    checkbox.setAttribute('aria-label', '사용');
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
                enhanceEnabledToggle(element);
            }
        });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(target.document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['type', 'placeholder'],
    });
    return () => observer.disconnect();
}
