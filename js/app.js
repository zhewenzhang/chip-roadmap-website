/**
 * 芯片产业分析平台 - 入口点
 * 模块化架构：导入各功能模块并初始化
 */

import { loadAllData } from './utils/fetch.js';
import { renderCompaniesGrid, resetPagination } from './modules/companies.js';
import { renderTimeline } from './modules/timeline.js';
import { showCompanyDetail, setModalData } from './modules/modal.js';
import { renderTrends, renderTopPlayers, renderABFAnalysis, renderKeyInsights } from './modules/insights.js';

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

    if (path.includes('roadmap.html')) {
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
    // 动态计算地区统计
    const companies = Array.isArray(companiesData) ? companiesData : Object.values(companiesData);
    const regionCounts = companies.reduce((acc, c) => {
        const region = c.country || c.region || 'Unknown';
        acc[region] = (acc[region] || 0) + 1;
        return acc;
    }, {});

    // 更新首页统计卡片 (market overview section)
    const statCards = document.querySelectorAll('.stats-row .stat-card .stat-info');
    statCards.forEach((infoEl) => {
        const h3 = infoEl.querySelector('h3');
        const valueP = infoEl.querySelector('.stat-value');
        if (!h3 || !valueP) return;

        const label = h3.textContent.trim();
        // 匹配地区名称
        const regionKeys = Object.keys(regionCounts);
        for (const key of regionKeys) {
            if (label.includes(key) || key.includes(label)) {
                valueP.textContent = regionCounts[key];
                return;
            }
        }
        // 对于"其他地区"，计算剩余
        if (label.includes('其他') || label.includes('Other')) {
            const knownCount = Object.values(regionCounts).reduce((sum, c) => sum + c, 0);
            valueP.textContent = Math.max(0, companies.length - knownCount);
        }
    });

    // 更新 hero 统计
    const heroNumbers = document.querySelectorAll('.hero-stats .stat-number');
    if (heroNumbers.length >= 1) {
        heroNumbers[0].textContent = companies.length;
    }
}

// ============== Roadmap 页面初始化 ==============
function initRoadmapPage() {
    renderTimeline(roadmapsData);
}

// ============== 公司页面初始化 ==============
function initCompaniesPage() {
    renderCompaniesGrid(companiesData);
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
        btn.addEventListener('click', () => {
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
                renderCompaniesGrid(companiesData, filter, searchTerm);
            } else if (path.includes('roadmap.html')) {
                renderTimeline(roadmapsData, filter === 'all' ? null : filter);
            }
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
