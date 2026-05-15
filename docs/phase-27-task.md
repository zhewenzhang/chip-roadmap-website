# Phase 27 任務指令 — 全站布局層（Navbar + 麵包屑 + ⌘K + 關注抽屜）

> 項目路徑：`D:\chip-roadmap-website`
> 前置：Phase 26 完成
> 範圍：影響所有 8 個 HTML 頁面 + 新建 js/modules/global-nav.js
> 工期：3 工作日
> Spec：§ 7

---

## 任務 A — 新建統一 Navbar 組件

### A-1：新建 `js/modules/global-nav.js`

```js
/**
 * Global navigation — Phase 27
 * Renders navbar with active page indicator, ⌘K, watchlist count.
 */

const NAV_ITEMS = [
    { id: 'signals', label: '信號流', href: 'index.html', pages: ['index.html', '', '/'] },
    { id: 'companies', label: '公司', href: 'companies.html', pages: ['companies.html', 'company-signals.html', 'company.html', 'chip-signals.html', 'chip.html'] },
    { id: 'roadmap', label: '路線圖', href: 'roadmap.html', pages: ['roadmap.html'] },
    { id: 'insights', label: '洞察', href: 'insights.html', pages: ['insights.html'] },
];

function getCurrentPageId() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    for (const item of NAV_ITEMS) {
        if (item.pages.includes(path)) return item.id;
    }
    return null;
}

export function renderGlobalNav() {
    const currentId = getCurrentPageId();
    const watchCount = getWatchCount();

    const navHtml = `
        <nav class="navbar-v2" aria-label="Main navigation">
            <div class="navbar-v2-inner">
                <a href="index.html" class="navbar-v2-logo">
                    <span class="navbar-v2-logo-icon">◆</span>
                    <span class="navbar-v2-logo-text">芯片情報</span>
                </a>
                <ul class="navbar-v2-links" id="navLinks">
                    ${NAV_ITEMS.map(item => `
                        <li><a href="${item.href}" class="navbar-v2-link ${item.id === currentId ? 'active' : ''}" data-nav="${item.id}">${item.label}</a></li>
                    `).join('')}
                </ul>
                <div class="navbar-v2-actions">
                    <button class="navbar-v2-search" id="globalSearchBtn" aria-label="搜尋 (⌘K)">
                        <span>⌘K</span> 搜尋
                    </button>
                    <button class="navbar-v2-watch" id="globalWatchBtn" aria-label="關注列表">
                        關注 <span class="navbar-v2-watch-count">${watchCount}</span>
                    </button>
                    <a href="admin/index.html" class="navbar-v2-admin" id="globalAdminLink" style="display:none">Admin</a>
                </div>
                <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="選單" aria-expanded="false" aria-controls="navLinks">
                    <span aria-hidden="true"></span>
                    <span aria-hidden="true"></span>
                    <span aria-hidden="true"></span>
                </button>
            </div>
        </nav>
    `;

    // 找到頁面中現有 .navbar 元素並完整替換
    const oldNav = document.querySelector('.navbar');
    if (oldNav) {
        oldNav.outerHTML = navHtml;
    } else {
        document.body.insertAdjacentHTML('afterbegin', navHtml);
    }

    bindNavEvents();
    initReferrerTracking();
    showAdminIfLoggedIn();
}

function getWatchCount() {
    try {
        const data = JSON.parse(localStorage.getItem('watchlist') || '{"companies":[],"chips":[]}');
        return (data.companies?.length || 0) + (data.chips?.length || 0);
    } catch { return 0; }
}

function bindNavEvents() {
    document.getElementById('globalSearchBtn')?.addEventListener('click', openCommandPalette);
    document.getElementById('globalWatchBtn')?.addEventListener('click', openWatchDrawer);
    document.getElementById('mobileMenuBtn')?.addEventListener('click', toggleMobileNav);

    // ⌘K / Ctrl+K
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            openCommandPalette();
        }
    });

    // Track all internal link clicks for referrer
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.getAttribute('href');
        if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
        sessionStorage.setItem('nav_referrer', JSON.stringify({
            path: window.location.pathname + window.location.search,
            scroll: window.scrollY,
            label: getCurrentPageLabel(),
            timestamp: Date.now()
        }));
    });
}

function getCurrentPageLabel() {
    const id = getCurrentPageId();
    return NAV_ITEMS.find(i => i.id === id)?.label || '上一頁';
}

function toggleMobileNav() {
    const links = document.getElementById('navLinks');
    const btn = document.getElementById('mobileMenuBtn');
    if (!links) return;
    const isOpen = links.classList.toggle('mobile-open');
    btn?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function initReferrerTracking() {
    // Used by crumb rendering — see global-crumb.js
}

async function showAdminIfLoggedIn() {
    try {
        const { auth } = await import('../firebase/config.js');
        const { onAuthStateChanged } = await import('firebase/auth');
        onAuthStateChanged(auth, (user) => {
            const link = document.getElementById('globalAdminLink');
            if (link) link.style.display = user ? '' : 'none';
        });
    } catch (err) { console.warn('[GlobalNav] auth check failed:', err); }
}

// ============ Command Palette ============
function openCommandPalette() {
    // Implementation in js/modules/command-palette.js
    import('./command-palette.js').then(m => m.open());
}

// ============ Watch Drawer ============
function openWatchDrawer() {
    import('./watch-drawer.js').then(m => m.open());
}

// Auto-init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderGlobalNav);
} else {
    renderGlobalNav();
}
```

### A-2：新建 `js/modules/command-palette.js`

```js
/**
 * ⌘K Command Palette — Phase 27
 */
import { loadCompanies, loadSignals } from '../firebase/db.js';

let palette = null;
let companies = [];
let signals = [];
let dataLoaded = false;

async function loadData() {
    if (dataLoaded) return;
    const [c, sResult] = await Promise.all([loadCompanies(), loadSignals()]);
    companies = Object.values(c);
    signals = sResult.ok ? sResult.data : [];
    dataLoaded = true;
}

export async function open() {
    if (!palette) buildPalette();
    palette.style.display = 'flex';
    const input = palette.querySelector('.cmdk-input');
    input.value = '';
    input.focus();
    await loadData();
    renderResults('');
}

function close() { if (palette) palette.style.display = 'none'; }

function buildPalette() {
    palette = document.createElement('div');
    palette.className = 'cmdk-overlay';
    palette.innerHTML = `
        <div class="cmdk">
            <input class="cmdk-input" type="text" placeholder="搜尋公司 / 芯片 / 信號..." autocomplete="off">
            <div class="cmdk-results"></div>
            <div class="cmdk-footer">
                <span>↑↓ 導航</span>
                <span>⏎ 開啟</span>
                <span>Esc 關閉</span>
            </div>
        </div>
    `;
    document.body.appendChild(palette);

    const input = palette.querySelector('.cmdk-input');
    input.addEventListener('input', () => renderResults(input.value));
    palette.addEventListener('click', (e) => { if (e.target === palette) close(); });
    document.addEventListener('keydown', (e) => {
        if (palette.style.display !== 'flex') return;
        if (e.key === 'Escape') close();
        if (e.key === 'Enter') {
            const first = palette.querySelector('.cmdk-result');
            if (first) window.location.href = first.dataset.href;
        }
    });
}

function renderResults(q) {
    const results = palette.querySelector('.cmdk-results');
    const query = q.trim().toLowerCase();

    const matchedCompanies = companies.filter(c =>
        (c.name_en?.toLowerCase().includes(query) || c.name_cn?.includes(q) || c.id?.toLowerCase().includes(query))
    ).slice(0, 5);

    const chipNames = new Set();
    signals.forEach(s => s.chip_name && chipNames.add(s.chip_name));
    const matchedChips = [...chipNames].filter(c => c.toLowerCase().includes(query)).slice(0, 5);

    const matchedSignals = signals.filter(s =>
        s.title?.toLowerCase().includes(query) || s.chip_name?.toLowerCase().includes(query)
    ).slice(0, 5);

    let html = '';
    if (matchedCompanies.length) {
        html += '<div class="cmdk-section-label">公司</div>';
        html += matchedCompanies.map(c =>
            `<a class="cmdk-result" data-href="company.html?id=${c.id}" href="company.html?id=${c.id}"><span class="entity-icon">◆</span> ${c.name_en || c.id}${c.name_cn ? ' / ' + c.name_cn : ''}</a>`
        ).join('');
    }
    if (matchedChips.length) {
        html += '<div class="cmdk-section-label">芯片</div>';
        html += matchedChips.map(name =>
            `<a class="cmdk-result" data-href="chip.html?name=${encodeURIComponent(name)}" href="chip.html?name=${encodeURIComponent(name)}"><span class="entity-icon">◇</span> ${name}</a>`
        ).join('');
    }
    if (matchedSignals.length) {
        html += '<div class="cmdk-section-label">最新信號</div>';
        html += matchedSignals.map(s =>
            `<a class="cmdk-result" data-href="signal.html?id=${s.id}" href="signal.html?id=${s.id}">${s.title}</a>`
        ).join('');
    }
    if (!html) html = '<div class="cmdk-empty">沒有匹配結果</div>';
    results.innerHTML = html;
}
```

### A-3：新建 `js/modules/watch-drawer.js`

```js
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
```

### A-4：新建 `js/modules/global-crumb.js`

```js
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

    // Restore scroll on back navigation
    container.querySelector('a').addEventListener('click', (e) => {
        try {
            const ref = JSON.parse(sessionStorage.getItem('nav_referrer') || 'null');
            if (ref?.scroll != null) {
                sessionStorage.setItem('pending_scroll', String(ref.scroll));
            }
        } catch {}
    });
}

// Auto-restore scroll on load
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        const pending = sessionStorage.getItem('pending_scroll');
        if (pending != null) {
            window.scrollTo(0, Number(pending));
            sessionStorage.removeItem('pending_scroll');
        }
    });
}
```

---

## 任務 B — 在所有 8 個 HTML 頁面引入 global-nav.js

對以下文件，找到現有 `<script>` 標籤區，加入：

```html
<script type="module" src="js/modules/global-nav.js"></script>
```

注意 `admin/index.html` 路徑要寫 `../js/modules/global-nav.js`。

**文件列表：**
- `index.html`
- `companies.html`
- `roadmap.html`
- `insights.html`
- `signals.html`
- `company-signals.html`
- `chip-signals.html`
- `admin/index.html`（路徑用 `../js/modules/global-nav.js`）

**現有的 `<nav class="navbar">...</nav>` 區塊不用刪除**，因為 global-nav.js 會在 DOMContentLoaded 時用 `outerHTML` 完整替換它（避免 FOUC，只是替換）。

---

## 任務 C — 新建 CSS 樣式

新建 `css/components/navbar-v2.css`：

```css
.navbar-v2 {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    height: var(--nav-h);
}
.navbar-v2-inner {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: 0 var(--s-6);
    height: 100%;
    display: flex;
    align-items: center;
    gap: var(--s-6);
}
.navbar-v2-logo {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    color: var(--fg);
    text-decoration: none;
    font-weight: 700;
}
.navbar-v2-logo-icon { color: var(--accent); font-size: var(--t-md); }
.navbar-v2-links {
    display: flex;
    list-style: none;
    gap: var(--s-2);
    margin: 0;
    padding: 0;
    flex: 1;
}
.navbar-v2-link {
    color: var(--fg-muted);
    text-decoration: none;
    padding: var(--s-2) var(--s-3);
    font-size: var(--t-sm);
    border-bottom: 2px solid transparent;
    transition: var(--transition);
}
.navbar-v2-link:hover { color: var(--fg); }
.navbar-v2-link.active {
    color: var(--fg);
    border-bottom-color: var(--fg);
}
.navbar-v2-actions {
    display: flex;
    align-items: center;
    gap: var(--s-2);
}
.navbar-v2-search, .navbar-v2-watch, .navbar-v2-admin {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg-muted);
    padding: var(--s-1) var(--s-3);
    font-family: var(--font-mono);
    font-size: var(--t-xs);
    cursor: pointer;
    text-decoration: none;
    transition: var(--transition);
}
.navbar-v2-search:hover, .navbar-v2-watch:hover, .navbar-v2-admin:hover {
    color: var(--fg);
    border-color: var(--fg-dim);
}
.navbar-v2-watch-count {
    color: var(--accent);
    margin-left: var(--s-1);
}

/* Mobile */
@media (max-width: 768px) {
    .navbar-v2-links {
        display: none;
        position: absolute;
        top: var(--nav-h);
        left: 0;
        right: 0;
        background: var(--bg-panel);
        border-bottom: 1px solid var(--border);
        flex-direction: column;
        padding: var(--s-4);
    }
    .navbar-v2-links.mobile-open { display: flex; }
    .navbar-v2-search span { display: none; }
}
```

新建 `css/components/cmdk.css`：

```css
.cmdk-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    z-index: 1000;
    justify-content: center;
    align-items: flex-start;
    padding-top: 10vh;
}
.cmdk {
    width: 100%;
    max-width: 36rem;
    background: var(--bg-panel);
    border: 1px solid var(--border-bright);
    box-shadow: var(--glow);
}
.cmdk-input {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--fg);
    padding: var(--s-4);
    font-family: var(--font-mono);
    font-size: var(--t-md);
    outline: none;
}
.cmdk-results { max-height: 24rem; overflow-y: auto; }
.cmdk-section-label {
    padding: var(--s-2) var(--s-4);
    font-size: var(--t-xs);
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
}
.cmdk-result {
    display: block;
    padding: var(--s-2) var(--s-4);
    color: var(--fg);
    text-decoration: none;
    font-size: var(--t-sm);
    transition: var(--transition);
}
.cmdk-result:hover, .cmdk-result:focus { background: var(--bg-hover); }
.cmdk-empty { padding: var(--s-6) var(--s-4); color: var(--fg-muted); text-align: center; }
.cmdk-footer {
    display: flex;
    gap: var(--s-4);
    padding: var(--s-2) var(--s-4);
    border-top: 1px solid var(--border);
    font-size: var(--t-xs);
    color: var(--fg-muted);
}
```

新建 `css/components/watch-drawer.css`：

```css
.watch-drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: var(--sidebar-w);
    background: var(--bg-panel);
    border-left: 1px solid var(--border-bright);
    transform: translateX(100%);
    transition: transform 200ms ease;
    z-index: 999;
    overflow-y: auto;
}
.watch-drawer.open { transform: translateX(0); }
.watch-drawer-header {
    padding: var(--s-4);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
}
.watch-drawer-close {
    background: transparent;
    border: none;
    color: var(--fg-muted);
    font-size: var(--t-xl);
    cursor: pointer;
}
.watch-drawer-body { padding: var(--s-4); }
.watch-drawer-section { margin-bottom: var(--s-6); }
.watch-drawer-section-title {
    font-size: var(--t-xs);
    color: var(--fg-muted);
    text-transform: uppercase;
    margin-bottom: var(--s-2);
}
.watch-drawer-section .entity-link { display: block; padding: var(--s-1) 0; }
```

在 `css/style.css` 追加 import：

```css
@import './components/navbar-v2.css';
@import './components/cmdk.css';
@import './components/watch-drawer.css';
```

---

## 任務 D — 砍掉舊 navbar 樣式

從 `css/style.css` 搜尋並刪除：
- `.navbar { ... }` 開頭的舊規則
- `.nav-container`、`.nav-links`、`.logo`、`.mobile-menu-btn` 相關規則（保留 `.mobile-menu-btn` 在新樣式中已重定義）

---

## 驗收

1. `npm run build` 通過
2. `node --test tests/*.test.js` → **90/90**
3. 視覺檢查：所有頁面新 navbar 出現，當前頁底線高亮
4. 功能檢查：
   - 按 ⌘K（Mac）或 Ctrl+K（Win）打開搜尋
   - 點關注按鈕打開抽屜
   - 從首頁進入 company-signals.html，麵包屑顯示「← 信號流」（如果頁面引入了 global-crumb.js，否則 Phase 30 才會啟用）
   - Admin 登入後右上角顯示 Admin 入口
5. Commit：
   ```
   feat(redesign): phase 27 — global nav + ⌘K + breadcrumb + watchlist drawer
   ```
6. `git push origin main`

## 完成後回報

- ⌘K 是否能搜到 50 家公司
- 移動端 navbar 漢堡菜單是否正常
- Admin 入口顯示/隱藏邏輯是否正常
