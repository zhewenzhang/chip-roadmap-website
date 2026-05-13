/**
 * 芯片产业分析平台 - 入口点
 * 模块化架构：导入各功能模块并初始化
 */

import { loadAllData, loadSignals } from './firebase/db.js';
import { renderCompaniesGrid, resetPagination, buildSignalMetrics } from './modules/companies.js';
import { renderTimeline } from './modules/timeline.js';
import { showCompanyDetail, setModalData } from './modules/modal.js';
import { renderTrends, renderTopPlayers, renderABFAnalysis, renderKeyInsights } from './modules/insights.js';
import { init as initSignals } from './modules/signals.js';
import { buildRoadmapMatrixFromSignals, getRoadmapYears, getRoadmapCompanies } from './modules/roadmap-derived.js';

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

// ============== 洞察页面初始化 ==============
function initInsightsPage() {
    renderTrends(insightsData);
    renderTopPlayers(insightsData);
    renderABFAnalysis(insightsData);
    renderKeyInsights(insightsData);
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
