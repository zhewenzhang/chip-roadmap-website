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

    const oldNav = document.querySelector('.navbar');
    if (oldNav) {
        oldNav.outerHTML = navHtml;
    } else {
        document.body.insertAdjacentHTML('afterbegin', navHtml);
    }

    bindNavEvents();
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

    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            openCommandPalette();
        }
    });

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

function openCommandPalette() {
    import('./command-palette.js').then(m => m.open());
}

function openWatchDrawer() {
    import('./watch-drawer.js').then(m => m.open());
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderGlobalNav);
} else {
    renderGlobalNav();
}
