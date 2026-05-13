/**
 * 芯片产业分析平台 - 入口点
 * 模块化架构：导入各功能模块并初始化
 */

import { loadAllData, loadSignals } from './firebase/db.js';
import { renderCompaniesGrid, resetPagination, buildSignalMetrics } from './modules/companies.js';
import { renderTimeline } from './modules/timeline.js';
import { showCompanyDetail, setModalData } from './modules/modal.js';
import { init as initSignals } from './modules/signals.js';
import { buildRoadmapMatrixFromSignals, getRoadmapYears, getRoadmapCompanies } from './modules/roadmap-derived.js';
import { buildRecentSignalCounts, buildRecentUpgrades, buildHighImpactRecentSignals, buildRiskSignals, IMPACT_LABELS, STATUS_LABELS, formatDate } from './modules/insights-derived.js';

// ============== 全局数据 ==============
let companiesData = {};
let roadmapsData = {};
let marketData = {};
let insightsData = {};

// ============== 初始化 ==============
document.addEventListener('DOMContentLoaded', async function() {
    const data = await loadAllData();
    companiesData = data.companies;
    roadmapsData = data.roadmaps;
    marketData = data.market;
    insightsData = data.insights;

    // 将数据传递给模态框模块
    setModalData(companiesData, roadmapsData);

    // 暴露 showCompanyDetail 到全局，供 companies.js 模块调用
    window.showCompanyDetail = showCompanyDetail;

    initFilters();
    initMobileMenu();
    initSearch();
    initPageSpecific();
});

// ============== 页面特定初始化 ==============
function initPageSpecific() {
    const path = window.location.pathname;

    if (path.includes('signals.html')) {
        initSignals();
    } else if (path.includes('roadmap.html')) {
        initRoadmapPage();
    } else if (path.includes('companies.html')) {
        initCompaniesPage();
    } else if (path.includes('insights.html')) {
        initInsightsPage();
    } else if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
        initHomePage();
    }
}

// ============== 首页初始化 ==============
function initHomePage() {
    updateRegionStats();
    console.log('首页初始化完成');
}

function updateRegionStats() {
    const companies = Object.values(companiesData);

    const china  = companies.filter(c => c.region === 'China').length;
    const usa    = companies.filter(c => c.region === 'USA').length;
    const taiwan = companies.filter(c => c.region === 'Taiwan').length;
    const other  = Math.max(0, companies.length - china - usa - taiwan);

    const el = id => document.getElementById(id);
    if (el('statChina'))  el('statChina').textContent  = china;
    if (el('statUsa'))    el('statUsa').textContent    = usa;
    if (el('statTaiwan')) el('statTaiwan').textContent = taiwan;
    if (el('statOther'))  el('statOther').textContent  = other;

    const heroNumbers = document.querySelectorAll('.hero-stats .stat-number');
    if (heroNumbers[0]) heroNumbers[0].textContent = companies.length;
}

// ============== Roadmap 页面初始化 (Phase 6: signals-derived) ==============
async function initRoadmapPage() {
    const result = await loadSignals();
    if (!result.ok) {
        console.error('[Roadmap] Signals load error:', result.error);
        const container = document.getElementById('timelineContainer');
        if (container) {
            container.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:60px 0;font-size:15px">Roadmap 數據載入失敗，請稍後重試。</p>';
        }
        return;
    }

    const matrix = buildRoadmapMatrixFromSignals(result.data);
    const companies = getRoadmapCompanies(matrix);

    // Dynamically render company filter buttons
    const filterContainer = document.querySelector('.roadmap-filters');
    if (filterContainer) {
        // Keep the "all" button, replace the rest
        const allBtn = filterContainer.querySelector('[data-filter="all"]');
        filterContainer.innerHTML = '';
        if (allBtn) filterContainer.appendChild(allBtn);

        companies.forEach(companyId => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.dataset.filter = companyId;
            btn.setAttribute('aria-pressed', 'false');
            const companyData = matrix[companyId];
            btn.textContent = companyData?.companyName || companyId;
            filterContainer.appendChild(btn);
        });

        // Re-initialize filter event listeners
        initRoadmapFilters();
    }

    renderTimeline(matrix);
}

// Roadmap-specific filter initialization (separate from global initFilters)
function initRoadmapFilters() {
    document.querySelectorAll('.roadmap-filters .filter-btn').forEach(btn => {
        // Remove old listeners by cloning
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', async () => {
            document.querySelectorAll('.roadmap-filters .filter-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            newBtn.classList.add('active');
            newBtn.setAttribute('aria-pressed', 'true');

            const filter = newBtn.dataset.filter;
            const result = await loadSignals();
            if (result.ok) {
                const matrix = buildRoadmapMatrixFromSignals(result.data);
                renderTimeline(matrix, filter === 'all' ? null : filter);
            }
        });
    });
}

// ============== 公司页面初始化 (V2: signals-enriched) ==============
async function initCompaniesPage() {
    // Load signals to enrich company cards with live metrics
    const result = await loadSignals();
    const signalMetrics = result.ok ? buildSignalMetrics(result.data) : {};

    renderCompaniesGrid(companiesData, 'all', '', signalMetrics);

    // Update filter handlers to pass signalMetrics
    document.querySelectorAll('.companies-header .filter-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.companies-header .filter-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');

            const filter = btn.dataset.filter;
            renderCompaniesGrid(companiesData, filter, '', signalMetrics);
        });
    });
}

// ============== 洞察页面初始化 (V2: signals-derived) ==============
async function initInsightsPage() {
    const result = await loadSignals();
    if (!result.ok) {
        console.error('[Insights] Signals load error:', result.error);
        renderInsightsError();
        return;
    }

    const signals = result.data;
    renderRecentSignalCountsModule(signals);
    renderRecentUpgradesModule(signals);
    renderHighImpactModule(signals);
    renderRiskSignalsModule(signals);
}

function renderInsightsError() {
    ['recentCounts', 'recentUpgrades', 'highImpactSignals', 'riskSignals'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:32px 0">數據載入失敗，請稍後重試。</p>';
    });
}

function renderRecentSignalCountsModule(signals) {
    const container = document.getElementById('recentCounts');
    if (!container) return;

    const counts = buildRecentSignalCounts(signals, 30);

    if (counts.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:32px 0">近 30 天無信號更新。</p>';
        return;
    }

    container.innerHTML = '';

    counts.forEach(item => {
        const card = document.createElement('div');
        card.className = 'summary-card';

        const countNum = document.createElement('div');
        countNum.className = 'summary-card-count';
        countNum.textContent = item.count;

        const companyName = document.createElement('div');
        companyName.className = 'summary-card-title';
        companyName.textContent = item.companyName;

        const chips = document.createElement('div');
        chips.className = 'summary-card-chips';
        chips.textContent = item.chips.slice(0, 3).join('、') + (item.chips.length > 3 ? ` +${item.chips.length - 3}` : '');

        const link = document.createElement('a');
        link.className = 'summary-card-link';
        link.href = `company-signals.html?id=${encodeURIComponent(item.companyId)}`;
        link.textContent = '查看 →';

        card.appendChild(countNum);
        card.appendChild(companyName);
        card.appendChild(chips);
        card.appendChild(link);
        container.appendChild(card);
    });
}

function renderRecentUpgradesModule(signals) {
    const container = document.getElementById('recentUpgrades');
    if (!container) return;

    const upgrades = buildRecentUpgrades(signals, 30);

    if (upgrades.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:32px 0">近 30 天無狀態升級。</p>';
        return;
    }

    container.innerHTML = '';

    upgrades.slice(0, 8).forEach(({ signal, toStatus, date }) => {
        const row = document.createElement('div');
        row.className = 'upgrade-row';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');

        const dateSpan = document.createElement('span');
        dateSpan.className = 'upgrade-date';
        dateSpan.textContent = formatDate(date);

        const companySpan = document.createElement('span');
        companySpan.className = 'upgrade-company';
        companySpan.textContent = signal.company_name;

        const chipSpan = document.createElement('span');
        chipSpan.className = 'upgrade-chip';
        chipSpan.textContent = signal.chip_name;

        const toSpan = document.createElement('span');
        toSpan.className = 'upgrade-to';
        toSpan.textContent = STATUS_LABELS[toStatus] || toStatus;

        row.appendChild(dateSpan);
        row.appendChild(companySpan);
        row.appendChild(chipSpan);
        row.appendChild(toSpan);

        row.addEventListener('click', () => {
            window.location.href = `company-signals.html?id=${encodeURIComponent(signal.company_id)}`;
        });

        container.appendChild(row);
    });
}

function renderHighImpactModule(signals) {
    const container = document.getElementById('highImpactSignals');
    if (!container) return;

    const items = buildHighImpactRecentSignals(signals, 30);

    if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:32px 0">近 30 天無高 ABF 影響信號。</p>';
        return;
    }

    container.innerHTML = '';

    items.slice(0, 8).forEach(({ signal }) => {
        const card = document.createElement('div');
        card.className = 'summary-card';

        const impactBadge = document.createElement('div');
        impactBadge.className = 'summary-card-impact';
        impactBadge.textContent = IMPACT_LABELS[signal.abf_demand_impact] || signal.abf_demand_impact;

        const chipName = document.createElement('div');
        chipName.className = 'summary-card-title';
        chipName.textContent = signal.chip_name;

        const companyName = document.createElement('div');
        companyName.className = 'summary-card-company';
        companyName.textContent = signal.company_name;

        const metaLine = document.createElement('div');
        metaLine.className = 'summary-card-meta';
        metaLine.textContent = `信度 ${signal.confidence_score} · ${formatDate(signal.last_verified_at)}`;

        const link = document.createElement('a');
        link.className = 'summary-card-link';
        link.href = `company-signals.html?id=${encodeURIComponent(signal.company_id)}`;
        link.textContent = '查看 →';

        card.appendChild(impactBadge);
        card.appendChild(chipName);
        card.appendChild(companyName);
        card.appendChild(metaLine);
        card.appendChild(link);
        container.appendChild(card);
    });
}

function renderRiskSignalsModule(signals) {
    const container = document.getElementById('riskSignals');
    if (!container) return;

    const risks = buildRiskSignals(signals);

    if (risks.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:32px 0">無風險信號。</p>';
        return;
    }

    container.innerHTML = '';

    const RISK_LABELS = {
        conflicting: '矛盾證據',
        recent_change: '近期變更',
        low_conf_high_impact: '低信度高影響',
    };

    risks.slice(0, 12).forEach(({ signal, riskType, reason }) => {
        const row = document.createElement('div');
        row.className = 'risk-row';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');

        const riskLabel = document.createElement('span');
        riskLabel.className = 'risk-label';
        riskLabel.textContent = RISK_LABELS[riskType] || riskType;

        const companyChip = document.createElement('span');
        companyChip.className = 'risk-company';
        companyChip.textContent = `${signal.company_name} · ${signal.chip_name}`;

        const reasonSpan = document.createElement('span');
        reasonSpan.className = 'risk-reason';
        reasonSpan.textContent = reason;

        row.appendChild(riskLabel);
        row.appendChild(companyChip);
        row.appendChild(reasonSpan);

        row.addEventListener('click', () => {
            window.location.href = `company-signals.html?id=${encodeURIComponent(signal.company_id)}`;
        });

        container.appendChild(row);
    });
}

// ============== 筛选功能 ==============
function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            // 更新活动状态
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');

            const filter = btn.dataset.filter;
            const searchTerm = document.getElementById('globalSearch')?.value.trim() || '';

            // 重置分页
            resetPagination();

            // 重新渲染
            const path = window.location.pathname;
            if (path.includes('companies.html')) {
                // Companies page has its own signal-enriched filter handler
            }
            // Roadmap page has its own filter handler (initRoadmapFilters)
        });
    });

    // 初始化 aria-pressed
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
    });
}

// ============== 搜索功能 ==============
function initSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;

    let debounceTimer = null;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const searchTerm = searchInput.value.trim();
            const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
            resetPagination();

            const path = window.location.pathname;
            if (path.includes('companies.html')) {
                renderCompaniesGrid(companiesData, activeFilter, searchTerm);
            }
        }, 300);
    });
}

// ============== 移动端菜单 ==============
function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    if (!menuBtn || !navLinks) return;

    let isOpen = false;

    // 初始状态
    menuBtn.setAttribute('aria-expanded', 'false');

    menuBtn.addEventListener('click', () => {
        isOpen = !isOpen;
        navLinks.classList.toggle('open', isOpen);
        menuBtn.classList.toggle('open', isOpen);
        menuBtn.setAttribute('aria-expanded', String(isOpen));
        document.body.style.overflow = isOpen ? 'hidden' : '';

        if (isOpen) {
            const firstLink = navLinks.querySelector('a');
            if (firstLink) firstLink.focus();
        }
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            isOpen = false;
            navLinks.classList.remove('open');
            menuBtn.classList.remove('open');
            menuBtn.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        });
    });

    // Escape 键关闭菜单
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            isOpen = false;
            navLinks.classList.remove('open');
            menuBtn.classList.remove('open');
            menuBtn.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
            menuBtn.focus();
        }
    });

    // 焦点陷阱：菜单打开时 Tab 限制在菜单内
    navLinks.addEventListener('keydown', (e) => {
        if (!isOpen || e.key !== 'Tab') return;

        const focusable = navLinks.querySelectorAll('a');
        if (focusable.length === 0) return;

        const firstFocusable = focusable[0];
        const lastFocusable = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                menuBtn.focus();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    });
}
