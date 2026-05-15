/**
 * Watchlist drawer — Phase 27
 */
let drawer = null;

export function open() {
    if (!drawer) buildDrawer();
    drawer.classList.add('open');
    render();
}

function close() { drawer?.classList.remove('open'); }

function getWatchlist() {
    try { return JSON.parse(localStorage.getItem('watchlist') || '{"companies":[],"chips":[]}'); }
    catch { return { companies: [], chips: [] }; }
}

function buildDrawer() {
    drawer = document.createElement('aside');
    drawer.className = 'watch-drawer';
    drawer.innerHTML = `
        <div class="watch-drawer-header">
            <h3>關注列表</h3>
            <button class="watch-drawer-close" aria-label="關閉">×</button>
        </div>
        <div class="watch-drawer-body"></div>
    `;
    document.body.appendChild(drawer);

    drawer.querySelector('.watch-drawer-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('open')) close();
    });
}

function render() {
    const wl = getWatchlist();
    const body = drawer.querySelector('.watch-drawer-body');
    if (!wl.companies.length && !wl.chips.length) {
        body.innerHTML = '<div class="empty-state"><div class="empty-state-icon">◇</div><div class="empty-state-title">尚無關注項目</div><div class="empty-state-sub">在公司或芯片詳情頁點「關注」按鈕加入</div></div>';
        return;
    }
    body.innerHTML = `
        ${wl.companies.length ? `<div class="watch-drawer-section">
            <div class="watch-drawer-section-title">公司 (${wl.companies.length})</div>
            ${wl.companies.map(id => `<a class="entity-link entity-company" href="company.html?id=${id}"><span class="entity-icon"></span>${id}</a>`).join('')}
        </div>` : ''}
        ${wl.chips.length ? `<div class="watch-drawer-section">
            <div class="watch-drawer-section-title">芯片 (${wl.chips.length})</div>
            ${wl.chips.map(name => `<a class="entity-link entity-chip" href="chip.html?name=${encodeURIComponent(name)}"><span class="entity-icon"></span>${name}</a>`).join('')}
        </div>` : ''}
    `;
}
