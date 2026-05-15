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
import { loadWatchlist, getWatchlist, isEmpty as isWatchlistEmpty } from './modules/watchlist.js';
import { deriveChipImpact } from './modules/impact-engine.js';
import { STAGE_LABEL, IMPACT_LABEL as SIG_IMPACT_LABEL, STATUS_LABEL as SIG_STATUS_LABEL } from './modules/signals-schema.js';

// ============== 全局数据 ==============
let companiesData = {};
let roadmapsData = {};

// ============== 初始化 ==============
document.addEventListener('DOMContentLoaded', async function() {
    // Shared UI setup — no Firestore reads here
    initFilters();
    initMobileMenu();
    initSearch();

    // Page-specific data loading (Approach A: each page decides what it needs)
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

// ============== 首页初始化 (V2: Signal-Centric Landing) ==============
async function initHomePage() {
    const result = await loadSignals();
    if (!result.ok) {
        console.error('[Home] Signals load error:', result.error);
        renderSystemStatusEmpty();
        renderLatestVerifiedEmpty();
        renderTopImpactEmpty();
        return;
    }
    const signals = result.data;
    renderSystemStatus(signals);
    renderLatestVerifiedSignals(signals);
    renderTopImpactChips(signals);
}

// ===== V2 Homepage Rendering =====

/**
 * System Status Panel — operational health, not vanity metrics.
 */
function renderSystemStatus(signals) {
    const el = document.getElementById('statusMetrics');
    if (!el) {
        // Fallback: also try marquee
        populateMarquee(signals);
        return;
    }

    const verified = signals.filter(s => s.status === 'verified');
    const draftWatch = signals.filter(s => s.status === 'draft' || s.status === 'watch');
    const verifiedChips = new Set(verified.map(s => s.chip_name).filter(Boolean));
    const verifiedCompanies = new Set(verified.map(s => s.company_id).filter(Boolean));

    // Most recent verification
    let lastVerified = '';
    for (const s of verified) {
        const d = s.last_verified_at || '';
        if (d > lastVerified) lastVerified = d;
    }
    const agoStr = lastVerified ? relativeTime(lastVerified) : '—';

    el.innerHTML = [
        `驗證信號 <strong>${verified.length}</strong> 條`,
        `追蹤芯片 <strong>${verifiedChips.size}</strong> 顆`,
        `追蹤公司 <strong>${verifiedCompanies.size}</strong> 家`,
        `最近驗證 <strong>${agoStr}</strong>`,
        `待驗證信號 <strong>${draftWatch.length}</strong> 條`,
    ].join('&nbsp;&nbsp;|&nbsp;&nbsp;');

    // Also populate kinetic marquee
    populateMarquee(signals);
}

function populateMarquee(signals) {
    const mc = document.getElementById('marqueeContent');
    const mc2 = document.getElementById('marqueeContent2');
    if (!mc) return;

    const verified = signals.filter(s => s.status === 'verified');
    const verifiedChips = new Set(verified.map(s => s.chip_name).filter(Boolean));
    const allCompanies = new Set(signals.map(s => s.company_id).filter(Boolean));
    const allRegions = new Set(signals.map(s => s.region).filter(Boolean));

    let lastVerified = '';
    for (const s of verified) {
        const d = s.last_verified_at || '';
        if (d > lastVerified) lastVerified = d;
    }
    const agoStr = lastVerified ? relativeTime(lastVerified) : '—';

    const items = [
        { label: '驗證信號', num: verified.length, unit: '條' },
        { label: '追蹤芯片', num: verifiedChips.size, unit: '顆' },
        { label: '追蹤公司', num: allCompanies.size, unit: '家' },
        { label: '國家/地區', num: allRegions.size, unit: '個' },
        { label: '最近驗證', text: agoStr },
        { label: '草稿/觀望', num: signals.filter(s => s.status === 'draft' || s.status === 'watch').length, unit: '條' },
    ];

    const html = items.map(item => {
        if (item.text) {
            return `<span class="marquee-item">${item.label} <span class="marquee-dot"></span> <span style="font-weight:400">${esc(item.text)}</span></span>`;
        }
        return `<span class="marquee-item"><span class="marquee-num">${item.num}</span> ${item.label}${item.unit || ''} <span class="marquee-dot"></span></span>`;
    }).join('');

    mc.innerHTML = html;
    if (mc2) mc2.innerHTML = html;
}

function renderSystemStatusEmpty() {
    const el = document.getElementById('statusMetrics');
    if (!el) {
        populateMarquee([]);
        return;
    }
    el.innerHTML = '驗證信號 <strong>0</strong> 條&nbsp;&nbsp;|&nbsp;&nbsp;追蹤芯片 <strong>0</strong> 顆&nbsp;&nbsp;|&nbsp;&nbsp;待驗證信號 <strong>0</strong> 條';
    populateMarquee([]);
}

/**
 * Latest Verified Signals — up to 8 rows, status === 'verified'.
 */
function renderLatestVerifiedSignals(signals) {
    const container = document.getElementById('latestVerified');
    if (!container) return;

    const verified = signals
        .filter(s => s.status === 'verified')
        .sort((a, b) => {
            const da = a.last_verified_at || a.updatedAt || '';
            const db = b.last_verified_at || b.updatedAt || '';
            if (db !== da) return db.localeCompare(da);
            return b.confidence_score - a.confidence_score;
        })
        .slice(0, 8);

    if (verified.length < 3) {
        container.innerHTML = `
  <div class="page-empty-state">
    <div class="page-empty-state-icon">◈</div>
    <div class="page-empty-state-title">驗證信號累積中</div>
    <div class="page-empty-state-sub">信號需要經過審核後才會在此顯示。<br>已有草稿？前往驗證。</div>
    <a href="signals.html" class="page-empty-state-link">前往信號工作台 →</a>
  </div>`;
        return;
    }

    container.innerHTML = verified.map(s => {
        const dateStr = s.last_verified_at ? new Date(s.last_verified_at).toISOString().slice(0, 10) : '';
        return `<div class="home-signal-row" data-id="${esc(s.id)}" role="button" tabindex="0">
            <a href="chip-signals.html?name=${encodeURIComponent(s.chip_name)}" class="home-signal-chip">${esc(s.chip_name)}</a>
            <span class="home-signal-company"><a href="company-signals.html?id=${encodeURIComponent(s.company_id)}">${esc(s.company_name)}</a></span>
            <span class="home-badge home-stage">${esc(STAGE_LABEL[s.stage] || s.stage)}</span>
            <span class="home-badge home-impact-${s.abf_demand_impact}">${esc(SIG_IMPACT_LABEL[s.abf_demand_impact] || s.abf_demand_impact)}</span>
            <span class="home-confidence">${s.confidence_score}</span>
            <span class="home-date">${dateStr}</span>
        </div>`;
    }).join('');

    container.querySelectorAll('.home-signal-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const signal = signals.find(s2 => s2.id === row.dataset.id);
            if (signal) {
                window.location.href = `chip-signals.html?name=${encodeURIComponent(signal.chip_name)}`;
            }
        });
        // Keyboard handler (Problem 2)
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const signal = signals.find(s2 => s2.id === row.dataset.id);
                if (signal) {
                    window.location.href = `chip-signals.html?name=${encodeURIComponent(signal.chip_name)}`;
                }
            }
        });
    });
}

function renderLatestVerifiedEmpty() {
    const container = document.getElementById('latestVerified');
    if (!container) return;
    container.innerHTML = `
  <div class="page-empty-state">
    <div class="page-empty-state-icon">◈</div>
    <div class="page-empty-state-title">驗證信號累積中</div>
    <div class="page-empty-state-sub">信號需要經過審核後才會在此顯示。<br>已有草稿？前往驗證。</div>
    <a href="signals.html" class="page-empty-state-link">前往信號工作台 →</a>
  </div>`;
}

/**
 * Top Impact Chips — derived via impact-engine.js, top 5.
 * Homepage trust gate: verified-only signals (Phase 11.2).
 */
function renderTopImpactChips(signals) {
    const container = document.getElementById('topImpactChips');
    if (!container) return;

    // Phase 11.2: verified-only input for homepage trust gate
    const verifiedSignals = signals.filter(s => s.status === 'verified');
    const chipSet = new Set(verifiedSignals.map(s => s.chip_name).filter(Boolean));
    const chips = [...chipSet];

    // Derive impact using verified-only signals
    const derived = chips.map(name => {
        const result = deriveChipImpact(name, verifiedSignals);
        return { name, ...result };
    });

    // Filter out insufficient data
    const qualifying = derived.filter(d => !d.insufficientData && d.abfDemandImpact);

    if (qualifying.length === 0) {
        container.innerHTML = `
  <div class="page-empty-state">
    <div class="page-empty-state-title">推導引擎待機中</div>
    <div class="page-empty-state-sub">需要至少 3 條已驗證信號才能計算 ABF 影響排序。</div>
  </div>`;
        return;
    }

    // Sort by impact then confidence
    const IMPACT_ORDER = { explosive: 4, high: 3, medium: 2, low: 1 };
    qualifying.sort((a, b) => {
        const impDiff = (IMPACT_ORDER[b.abfDemandImpact] || 0) - (IMPACT_ORDER[a.abfDemandImpact] || 0);
        if (impDiff !== 0) return impDiff;
        return (b.derivedConfidence || 0) - (a.derivedConfidence || 0);
    });

    const top5 = qualifying.slice(0, 5);

    container.innerHTML = top5.map(d => {
        // Company name from first driving signal — resolved from verified-only pool
        const driver = d.drivingSignals?.[0];
        const companyName = driver
            ? (verifiedSignals.find(s => s.id === driver.id)?.company_name || '')
            : '';
        const cowosLabel = d.cowosDependency === 'Yes' ? 'Yes' : d.cowosDependency === 'Likely' ? 'Likely' : 'No';
        const reason = (d.reasonsByField?.abf_demand_impact || '').slice(0, 60);
        return `<div class="home-impact-row" role="button" tabindex="0">
            <a href="chip-signals.html?name=${encodeURIComponent(d.name)}" class="home-signal-chip">${esc(d.name)}</a>
            <span class="home-signal-company">${companyName ? esc(companyName) : ''}</span>
            <span class="home-badge home-impact-${d.abfDemandImpact}">${esc(SIG_IMPACT_LABEL[d.abfDemandImpact] || d.abfDemandImpact)}</span>
            <span class="home-cowos">CoWoS: ${cowosLabel}</span>
            <span class="home-confidence">信度 ${d.derivedConfidence ?? '—'}</span>
            <span class="home-reason">${esc(reason)}</span>
        </div>`;
    }).join('');

    // Problem 2: keyboard handler for impact rows
    container.querySelectorAll('.home-impact-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const chipLink = row.querySelector('.home-signal-chip');
            if (chipLink) window.location.href = chipLink.href;
        });
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const chipLink = row.querySelector('.home-signal-chip');
                if (chipLink) window.location.href = chipLink.href;
            }
        });
    });
}

function renderTopImpactEmpty() {
    const container = document.getElementById('topImpactChips');
    if (!container) return;
    container.innerHTML = `
  <div class="page-empty-state">
    <div class="page-empty-state-title">推導引擎待機中</div>
    <div class="page-empty-state-sub">需要至少 3 條已驗證信號才能計算 ABF 影響排序。</div>
  </div>`;
}

function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relativeTime(dateStr) {
    if (!dateStr) return '—';
    try {
        const now = new Date();
        const then = new Date(dateStr);
        const diffMs = now - then;
        const diffMin = Math.round(diffMs / (1000 * 60));
        const diffHr = Math.round(diffMs / (1000 * 60 * 60));
        const diffDay = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffMin < 60) return `${diffMin} 分鐘前`;
        if (diffHr < 24) return `${diffHr} 小時前`;
        return `${diffDay} 天前`;
    } catch { return '—'; }
}

// ============== Roadmap 页面初始化 (Phase 6: signals-derived) ==============
async function initRoadmapPage() {
    const result = await loadSignals();
    if (!result.ok) {
        console.error('[Roadmap] Signals load error:', result.error);
        const container = document.getElementById('timelineContainer');
        if (container) {
            container.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:60px 0;font-size:15px">路線圖數據載入失敗，請稍後重試。</p>';
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
    // Load companies data for the grid + modal
    const data = await loadAllData();
    companiesData = data.companies;
    roadmapsData = data.roadmaps;
    setModalData(companiesData, roadmapsData);
    window.showCompanyDetail = showCompanyDetail;

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

    // Search input binding
    const searchInput = document.getElementById('companySearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const term = searchInput.value.trim();
            const activeFilterBtn = document.querySelector('.companies-header .filter-btn.active');
            const activeFilter = activeFilterBtn?.dataset.filter || 'all';
            renderCompaniesGrid(companiesData, activeFilter, term, signalMetrics);
        });
    }
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

    // Dynamic imports — only loaded on the Insights page (Problem 3)
    const [insightsDerived, changeIntel] = await Promise.all([
        import('./modules/insights-derived.js'),
        import('./modules/change-intelligence.js'),
    ]);

    const { buildRecentSignalCounts, buildRecentUpgrades, buildHighImpactRecentSignals, buildRiskSignals, IMPACT_LABELS, STATUS_LABELS, formatDate, getLampColor } = insightsDerived;
    const { buildPriorityQueue, buildSignalChangeFeed, CHANGE_TYPES, PRIORITY_LABELS } = changeIntel;

    renderRecentSignalCountsModule(signals, buildRecentSignalCounts);
    renderRecentUpgradesModule(signals, buildRecentUpgrades, formatDate, STATUS_LABELS, getLampColor);
    renderHighImpactModule(signals, buildHighImpactRecentSignals, IMPACT_LABELS, formatDate, getLampColor);
    renderRiskSignalsModule(signals, buildRiskSignals);
    renderSignificantChangesModule(signals, buildSignalChangeFeed, CHANGE_TYPES);
    renderPriorityQueueModule(signals, buildPriorityQueue, PRIORITY_LABELS);
}

function renderInsightsError() {
    ['recentCounts', 'recentUpgrades', 'highImpactSignals', 'riskSignals', 'significantChanges', 'priorityQueue'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="page-empty-state"><div class="page-empty-state-sub">數據載入失敗，請稍後重試</div></div>';
    });
}

function renderRecentSignalCountsModule(signals, buildRecentSignalCounts) {
    const container = document.getElementById('recentCounts');
    if (!container) return;

    const counts = buildRecentSignalCounts(signals, 30);

    if (counts.length === 0) {
        container.innerHTML = '<div class="page-empty-state"><div class="page-empty-state-sub">近 30 天尚無信號更新</div></div>';
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

function renderRecentUpgradesModule(signals, buildRecentUpgrades, formatDate, STATUS_LABELS, getLampColor) {
    const container = document.getElementById('recentUpgrades');
    if (!container) return;

    const upgrades = buildRecentUpgrades(signals, 30);

    if (upgrades.length === 0) {
        container.innerHTML = '<div class="page-empty-state"><div class="page-empty-state-sub">近期尚無狀態升級記錄</div></div>';
        return;
    }

    container.innerHTML = '';

    upgrades.slice(0, 8).forEach(({ signal, toStatus, date }) => {
        const row = document.createElement('div');
        row.className = 'upgrade-row';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');

        const lamp = getLampColor(signal);
        const lampSpan = document.createElement('span');
        lampSpan.className = `signal-lamp signal-lamp-${lamp}`;

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

        row.appendChild(lampSpan);
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

function renderHighImpactModule(signals, buildHighImpactRecentSignals, IMPACT_LABELS, formatDate, getLampColor) {
    const container = document.getElementById('highImpactSignals');
    if (!container) return;

    const items = buildHighImpactRecentSignals(signals, 30);

    if (items.length === 0) {
        container.innerHTML = '<div class="page-empty-state"><div class="page-empty-state-sub">近期尚無高 ABF 影響信號</div></div>';
        return;
    }

    container.innerHTML = '';

    items.slice(0, 8).forEach(({ signal }) => {
        const card = document.createElement('div');
        card.className = 'summary-card';

        const lamp = getLampColor(signal);
        const lampSpan = document.createElement('span');
        lampSpan.className = `signal-lamp signal-lamp-${lamp}`;

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

        card.appendChild(lampSpan);
        card.appendChild(impactBadge);
        card.appendChild(chipName);
        card.appendChild(companyName);
        card.appendChild(metaLine);
        card.appendChild(link);
        container.appendChild(card);
    });
}

function renderRiskSignalsModule(signals, buildRiskSignals) {
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

        const lampSpan = document.createElement('span');
        lampSpan.className = 'signal-lamp signal-lamp-red';

        const riskLabel = document.createElement('span');
        riskLabel.className = 'risk-label';
        riskLabel.textContent = RISK_LABELS[riskType] || riskType;

        const companyChip = document.createElement('span');
        companyChip.className = 'risk-company';
        companyChip.textContent = `${signal.company_name} · ${signal.chip_name}`;

        const reasonSpan = document.createElement('span');
        reasonSpan.className = 'risk-reason';
        reasonSpan.textContent = reason;

        row.appendChild(lampSpan);
        row.appendChild(riskLabel);
        row.appendChild(companyChip);
        row.appendChild(reasonSpan);

        row.addEventListener('click', () => {
            window.location.href = `company-signals.html?id=${encodeURIComponent(signal.company_id)}`;
        });

        container.appendChild(row);
    });
}

// ===== Phase 10: Insights Change Modules =====

/**
 * Module 5: Most Significant Changes (last 30 days)
 * Cross-entity feed of upgrades, downgrades, impact shifts, conflicts.
 */
function renderSignificantChangesModule(signals, buildSignalChangeFeed, CHANGE_TYPES) {
    const container = document.getElementById('significantChanges');
    if (!container) return;

    const changes = buildSignalChangeFeed(signals, [], { feedDays: 30 })
        .filter(c => c.type !== CHANGE_TYPES.STALE_VERIFIED_SIGNAL)
        .sort((a, b) => new Date(b.changeDate || 0) - new Date(a.changeDate || 0))
        .slice(0, 12);

    if (changes.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:32px 0">近 30 天無重大變更。</p>';
        return;
    }

    const typeLabel = {
        [CHANGE_TYPES.STATUS_UPGRADED]: '升級',
        [CHANGE_TYPES.STATUS_DOWNGRADED]: '降級',
        [CHANGE_TYPES.CONFIDENCE_MAJOR_CHANGE]: '信度變更',
        [CHANGE_TYPES.NEW_HIGH_IMPACT_SIGNAL]: '新高影響',
        [CHANGE_TYPES.NEW_CONFLICT]: '新衝突',
        [CHANGE_TYPES.IMPACT_DERIVATION_CHANGED]: '影響變更',
    };

    container.innerHTML = '';

    changes.forEach(c => {
        const row = document.createElement('div');
        row.className = 'change-feed-row';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');

        const tag = document.createElement('span');
        tag.className = 'change-type-tag';
        tag.textContent = typeLabel[c.type] || c.type;

        const info = document.createElement('span');
        info.className = 'change-feed-info';
        info.textContent = `${c.companyName || ''} · ${c.chipName || ''}`;

        const reason = document.createElement('span');
        reason.className = 'change-feed-reason';
        reason.textContent = (c.reasons || []).slice(0, 2).join(' · ');

        const dateSpan = document.createElement('span');
        dateSpan.className = 'change-feed-date';
        dateSpan.textContent = c.changeDate ? new Date(c.changeDate).toISOString().slice(0, 10) : '';

        row.appendChild(tag);
        row.appendChild(info);
        row.appendChild(reason);
        row.appendChild(dateSpan);

        row.addEventListener('click', () => {
            if (c.signalId) {
                window.location.href = `company-signals.html?id=${encodeURIComponent(c.companyId)}`;
            } else if (c.companyId) {
                window.location.href = `company-signals.html?id=${encodeURIComponent(c.companyId)}`;
            } else if (c.chipName) {
                window.location.href = `chip-signals.html?name=${encodeURIComponent(c.chipName)}`;
            }
        });

        container.appendChild(row);
    });
}

/**
 * Module 6: Priority Review Queue
 * Top ranked items from the shared priority model.
 */
function renderPriorityQueueModule(signals, buildPriorityQueue, PRIORITY_LABELS) {
    const container = document.getElementById('priorityQueue');
    if (!container) return;

    loadWatchlist();
    const wl = getWatchlist();
    const queue = buildPriorityQueue(signals, [], {
        watchlistContext: {
            companies: wl.companies,
            chips: wl.chips,
            signals: wl.signals,
        }
    }).slice(0, 10);

    if (queue.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:32px 0">無高優先級複查項目。</p>';
        return;
    }

    const priorityLabelMap = {
        critical: '嚴重',
        high: '高',
        medium: '中',
        low: '低',
    };

    container.innerHTML = '';

    queue.forEach(item => {
        const row = document.createElement('div');
        row.className = 'priority-row';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');

        const badge = document.createElement('span');
        badge.className = `priority-badge priority-${item.priorityLabel}`;
        badge.textContent = priorityLabelMap[item.priorityLabel] || item.priorityLabel;

        const title = document.createElement('span');
        title.className = 'priority-title';
        title.textContent = item.chipName || item.companyName || '';

        const reasons = document.createElement('span');
        reasons.className = 'priority-reasons';
        reasons.textContent = (item.allReasons || item.reasons || []).slice(0, 3).join(' · ');

        const dateSpan = document.createElement('span');
        dateSpan.className = 'priority-date';
        dateSpan.textContent = item.changeDate ? new Date(item.changeDate).toISOString().slice(0, 10) : '';

        row.appendChild(badge);
        row.appendChild(title);
        row.appendChild(reasons);
        row.appendChild(dateSpan);

        row.addEventListener('click', () => {
            if (item.signalId) {
                window.location.href = `company-signals.html?id=${encodeURIComponent(item.companyId)}`;
            } else if (item.companyId) {
                window.location.href = `company-signals.html?id=${encodeURIComponent(item.companyId)}`;
            } else if (item.chipName) {
                window.location.href = `chip-signals.html?name=${encodeURIComponent(item.chipName)}`;
            }
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
