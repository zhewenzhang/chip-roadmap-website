/**
 * Smart breadcrumb — Phase 27
 * Uses sessionStorage referrer for "back to where I came from".
 */

export function renderCrumb(fallbackText = '首頁') {
    const container = document.querySelector('[data-crumb]');
    if (!container) return;

    let label = fallbackText;
    let href = 'index.html';

    try {
        const ref = JSON.parse(sessionStorage.getItem('nav_referrer') || 'null');
        if (ref && ref.path && Date.now() - ref.timestamp < 1000 * 60 * 30) {
            label = ref.label || fallbackText;
            href = ref.path;
        }
    } catch {}

    container.innerHTML = `
        <a class="crumb-link" href="${href}" data-restore-scroll="${href}">← ${label}</a>
    `;

    container.querySelector('a').addEventListener('click', (e) => {
        try {
            const ref = JSON.parse(sessionStorage.getItem('nav_referrer') || 'null');
            if (ref?.scroll != null) {
                sessionStorage.setItem('pending_scroll', String(ref.scroll));
            }
        } catch {}
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        const pending = sessionStorage.getItem('pending_scroll');
        if (pending != null) {
            window.scrollTo(0, Number(pending));
            sessionStorage.removeItem('pending_scroll');
        }
    });
}
