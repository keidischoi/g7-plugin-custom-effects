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
