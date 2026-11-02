// Generic interface helpers shared by the panel modules.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for use in HTML content and attribute values. */
export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ESCAPES[char]);
}

export function icon(name, className = '') {
    return `<svg class="icon ${className}" aria-hidden="true"><use href="/static/icons.svg#${name}"></use></svg>`;
}

export function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

let toastTimer;

export function toast(message, type = 'success') {
    const element = document.getElementById('toast');
    element.textContent = message;
    element.dataset.type = type;
    element.hidden = false;
    // Showing it as a popover keeps it above an open <dialog>, which otherwise covers everything else
    if (element.matches(':popover-open')) element.hidePopover();
    element.showPopover();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        element.hidePopover();
        element.hidden = true;
    }, type === 'error' ? 6000 : 3500);
}

/** Asks for confirmation in the shared dialog. Resolves to true only if the user accepts. */
export function ask({ title, message, confirmLabel = 'Continuar', danger = false }) {
    const dialog = document.getElementById('confirm-dialog');
    dialog.querySelector('[data-confirm-title]').textContent = title;
    dialog.querySelector('[data-confirm-message]').textContent = message;
    const accept = dialog.querySelector('[value="accept"]');
    accept.textContent = confirmLabel;
    accept.classList.toggle('btn--danger', danger);
    accept.classList.toggle('btn--primary', !danger);
    dialog.returnValue = '';
    dialog.showModal();
    return new Promise(resolve => {
        dialog.addEventListener('close', () => resolve(dialog.returnValue === 'accept'), { once: true });
    });
}

export function downloadFile(fileName, content, mimeType) {
    const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
