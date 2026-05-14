/**
 * Signals Page Module
 * Table-first, analyst-friendly interface for verified AI chip signals.
 */

import { loadSignals, loadSignalHistory } from '../firebase/db.js';
import {
    STAGE_LABEL, STATUS_LABEL, IMPACT_LABEL, REGION_LABEL, labelize,
    STAGE_ENUM, STATUS_ENUM, IMPACT_ENUM, REGION_OPTIONS, IMPACT_SORT,
    HISTORY_ACTIONS,
} from './signals-schema.js';
import {
    loadWatchlist, isWatchingCompany, isWatchingChip, isWatchingSignal,
    toggleWatchCompany, toggleWatchChip, toggleWatchSignal, getWatchlist,
    isEmpty as isWatchlistEmpty, clearWatchlist
} from './watchlist.js';
import {
    buildPriorityQueue, buildSignalChangeFeed, buildWatchlistPriorityQueue,
    CHANGE_TYPES, PRIORITY_LABELS
} from './change-intelligence.js';

// ===== State =====
let allSignals = [];
let filterState = {
    search: '',
    region: '',
    company: '',
    stage: '',
    impact: '',
    status: '',
    view: 'all', // Phase 2
    quickView: '', // Phase 4.1: watchlist quick-view override
};

let savedViews = []; // Phase 2
let compareSelection = []; // Phase 2
let drawerScrollLock = null;

// ===== Helpers =====
function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stageLabel(v) { return labelize(STAGE_LABEL, v); }
function impactLabel(v) { return labelize(IMPACT_LABEL, v); }
function statusLabel(v) { return labelize(STATUS_LABEL, v); }
function regionLabel(v) { return labelize(REGION_LABEL, v); }

function statusChipClass(s) {
    switch (s) {
        case 'verified': return 'signal-status-verified';
        case 'watch': return 'signal-status-watch';
        case 'downgraded': return 'signal-status-downgraded';
        case 'invalidated': return 'signal-status-invalidated';
        default: return 'signal-status-draft';
    }
}

/**
 * Return a small provenance badge for the signal's source.
 * AI-extracted and imported signals are visually distinguishable from manual.
 */
function sourceBadge(signal) {
    if (signal.ai_generated) {
        return ' <span class="source-badge source-badge-ai">AI 抽取</span>';
    }
    if (signal.source_type === 'imported') {
        return ' <span class="source-badge source-badge-imported">匯入</span>';
    }
    return '';
}

function formatDate(d) {
    if (!d) return '—';
    try {
        return new Date(d).toISOString().slice(0, 10);
    } catch { return '—'; }
}

function isRecent(d, days = 7) {
    if (!d) return false;
    try {
        const now = new Date();
        const then = new Date(d);
        const diff = (now - then) / (1000 * 60 * 60 * 24);
        return diff <= days && diff >= 0;
    } catch { return false; }
}

function calculatePriorityScore(s) {
    let score = 0;
    score += (IMPACT_SORT[s.abf_demand_impact] || 0) * 10;
    score += (s.confidence_score || 0) * 0.3;
    const lastDate = s.last_verified_at || s.updatedAt || s.createdAt;
    if (lastDate) {
        const days = (new Date() - new Date(lastDate)) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 20 - (days / 7) * 2);
    }
    if (s.status === 'verified') score += 10;
    else if (s.status === 'watch') score += 7;
    return score;
}

// ===== Public API =====

export async function init() {
    renderLoadingSkeleton();
    loadSavedViews();
    loadWatchlist();
    const result = await loadSignals();
    if (!result.ok) {
        console.error('[Signals] Load error:', result.error);
        renderErrorState();
    } else if (result.data.length === 0) {
        renderEmptyState();
    } else {
        allSignals = result.data.map(s => ({ ...s, _priority: calculatePriorityScore(s) }));
        renderSummaryLayer(allSignals);
        renderChangeIntelligence(allSignals);
        renderFilters();
        renderSavedViews();
        renderWatchlistPanel();
        renderWatchlistFocusStrip();
        applyFilters();
    }
    bindEvents();
}

// ===== Summary Layer (Phase 2 Upgrade) =====

function renderSummaryLayer(signals) {
    const layer = document.getElementById('signalsSummaryLayer');
    if (!layer) return;

    const watchlist = getWatchlist();
    const hasWatchlist = !isWatchlistEmpty();

    // Watchlist-filtered signals for Phase 3 summary
    const watchedSignals = hasWatchlist
        ? signals.filter(s =>
            isWatchingCompany(s.company_id) ||
            isWatchingChip(s.chip_name) ||
            isWatchingSignal(s.id)
        )
        : [];

    // Global summary blocks
    const recentChanges = [...signals]
        .filter(s => s.last_status_changed_at && isRecent(s.last_status_changed_at, 14))
        .sort((a, b) => new Date(b.last_status_changed_at) - new Date(a.last_status_changed_at))
        .slice(0, 4);

    const highestImpact = [...signals]
        .sort((a, b) => b._priority - a._priority)
        .slice(0, 4);

    // Watchlist-aware derived lists
    const watchedChanges = watchedSignals
        .filter(s => s.last_status_changed_at && isRecent(s.last_status_changed_at, 14))
        .sort((a, b) => new Date(b.last_status_changed_at) - new Date(a.last_status_changed_at))
        .slice(0, 4);

    const watchedHighImpact = watchedSignals
        .filter(s => s.abf_demand_impact === 'high' || s.abf_demand_impact === 'explosive')
        .sort((a, b) => b._priority - a._priority)
        .slice(0, 4);

    const watchedRecentVerified = watchedSignals
        .filter(s => isRecent(s.last_verified_at, 14))
        .sort((a, b) => new Date(b.last_verified_at || 0) - new Date(a.last_verified_at || 0))
        .slice(0, 4);

    if (hasWatchlist) {
        // Watchlist-focused summary: 3 blocks tailored to watched entities
        layer.innerHTML = `
            <div class="summary-block">
                <div class="summary-block-title">關注中狀態變更</div>
                <ul class="summary-list">
                    ${watchedChanges.map(s => `
                        <li class="summary-item" data-id="${s.id}">
                            <span class="summary-item-meta">${formatDate(s.last_status_changed_at)}</span>
                            ${esc(s.company_name)}: ${esc(s.chip_name)}
                        </li>
                    `).join('') || '<li class="summary-item">關注項無最近變更</li>'}
                </ul>
            </div>
            <div class="summary-block">
                <div class="summary-block-title">關注中高 ABF 影響</div>
                <ul class="summary-list">
                    ${watchedHighImpact.map(s => `
                        <li class="summary-item" data-id="${s.id}">
                            <span class="summary-item-meta">${impactLabel(s.abf_demand_impact)}</span>
                            ${esc(s.company_name)}: ${esc(s.chip_name)}
                        </li>
                    `).join('') || '<li class="summary-item">關注項無高影響信號</li>'}
                </ul>
            </div>
            <div class="summary-block">
                <div class="summary-block-title">關注中最近驗證</div>
                <ul class="summary-list">
                    ${watchedRecentVerified.map(s => `
                        <li class="summary-item" data-id="${s.id}">
                            <span class="summary-item-meta">${formatDate(s.last_verified_at)}</span>
                            ${esc(s.company_name)}: ${esc(s.chip_name)}
                        </li>
                    `).join('') || '<li class="summary-item">關注項無最近驗證</li>'}
                </ul>
            </div>
        `;
    } else {
        // Global summary for users without watchlist
        layer.innerHTML = `
            <div class="summary-block">
                <div class="summary-block-title">最近狀態變更</div>
                <ul class="summary-list">
                    ${recentChanges.map(s => `
                        <li class="summary-item" data-id="${s.id}">
                            <span class="summary-item-meta">${formatDate(s.last_status_changed_at)}</span>
                            ${esc(s.company_name)}: ${esc(s.chip_name)}
                        </li>
                    `).join('') || '<li class="summary-item">無最近變更</li>'}
                </ul>
            </div>
            <div class="summary-block">
                <div class="summary-block-title">最高 ABF 影響</div>
                <ul class="summary-list">
                    ${highestImpact.map(s => `
                        <li class="summary-item" data-id="${s.id}">
                            <span class="summary-item-meta">${impactLabel(s.abf_demand_impact)}</span>
                            ${esc(s.company_name)}: ${esc(s.chip_name)}
                        </li>
                    `).join('')}
                </ul>
            </div>
            <div class="summary-block">
                <div class="summary-block-title">最新收錄</div>
                <ul class="summary-list">
                    ${signals.slice(0, 4).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).map(s => `
                        <li class="summary-item" data-id="${s.id}">
                            <span class="summary-item-meta">${formatDate(s.createdAt)}</span>
                            ${esc(s.company_name)}: ${esc(s.chip_name)}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    layer.querySelectorAll('.summary-item').forEach(el => {
        el.addEventListener('click', () => {
            const s = allSignals.find(x => x.id === el.dataset.id);
            if (s) openDrawer(s);
        });
    });
}

// ===== Change Intelligence Workspace (Phase 10) =====

let changeViewState = 'priority';

function renderChangeIntelligence(signals) {
    const container = document.getElementById('changeIntelligence');
    if (!container) return;

    const watchlist = getWatchlist();
    const hasWatchlist = !isWatchlistEmpty();

    // Build priority queue
    const queue = buildPriorityQueue(signals, [], {
        watchlistContext: {
            companies: watchlist.companies,
            chips: watchlist.chips,
            signals: watchlist.signals,
        }
    });

    // Only show if there are meaningful changes
    if (queue.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    renderChangeView(queue, signals, hasWatchlist);
    bindChangeTabs(queue, signals, hasWatchlist);
}

function bindChangeTabs(queue, signals, hasWatchlist) {
    document.querySelectorAll('.change-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.change-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            changeViewState = btn.dataset.changeView;
            renderChangeView(queue, signals, hasWatchlist);
        });
    });
}

function renderChangeView(queue, signals, hasWatchlist) {
    const content = document.getElementById('changeContent');
    if (!content) return;

    let items;
    switch (changeViewState) {
        case 'priority':
            items = queue.slice(0, 10);
            break;
        case 'upgrades':
            items = queue.filter(i => i.type === CHANGE_TYPES.STATUS_UPGRADED).slice(0, 10);
            break;
        case 'conflicts':
            items = queue.filter(i => i.type === CHANGE_TYPES.NEW_CONFLICT).slice(0, 10);
            break;
        case 'watchlist':
            items = hasWatchlist
                ? queue.filter(i => {
                    const wl = getWatchlist();
                    if (i.companyId && wl.companies.includes(i.companyId)) return true;
                    if (i.chipName && wl.chips.includes(i.chipName)) return true;
                    if (i.signalId && wl.signals.includes(i.signalId)) return true;
                    return false;
                }).slice(0, 10)
                : [];
            break;
        default:
            items = queue.slice(0, 10);
    }

    if (items.length === 0) {
        content.innerHTML = `<div class="change-empty">${getEmptyMessage(changeViewState)}</div>`;
        return;
    }

    content.innerHTML = items.map(item => renderChangeItem(item)).join('');

    // Bind click handlers
    content.querySelectorAll('.change-item').forEach(el => {
        el.addEventListener('click', () => {
            if (el.dataset.signalId) {
                const signal = signals.find(s => s.id === el.dataset.signalId);
                if (signal) openDrawer(signal);
            } else if (el.dataset.companyId) {
                window.location.href = `company-signals.html?id=${encodeURIComponent(el.dataset.companyId)}`;
            } else if (el.dataset.chipName) {
                window.location.href = `chip-signals.html?name=${encodeURIComponent(el.dataset.chipName)}`;
            }
        });
    });
}

function renderChangeItem(item) {
    const labelCls = {
        critical: 'priority-critical',
        high: 'priority-high',
        medium: 'priority-medium',
        low: 'priority-low',
    }[item.priorityLabel] || 'priority-low';

    const label = {
        critical: '嚴重',
        high: '高',
        medium: '中',
        low: '低',
    }[item.priorityLabel] || item.priorityLabel;

    const title = item.chipName || item.companyName || '';
    const subtitle = item.companyName && item.chipName
        ? `${item.companyName}`
        : '';
    const dateStr = item.changeDate ? new Date(item.changeDate).toISOString().slice(0, 10) : '';
    const dataAttrs = [
        item.signalId ? `data-signal-id="${esc(item.signalId)}"` : '',
        item.companyId && !item.signalId ? `data-company-id="${esc(item.companyId)}"` : '',
        item.chipName && !item.signalId && !item.companyId ? `data-chip-name="${esc(item.chipName)}"` : '',
    ].filter(Boolean).join(' ');

    return `<div class="change-item" ${dataAttrs}>
        <span class="change-priority-badge ${labelCls}">${label}</span>
        <div class="change-item-body">
            <div class="change-item-title">${esc(title)}${subtitle ? `<span class="change-item-subtitle">${esc(subtitle)}</span>` : ''}</div>
            <div class="change-item-reasons">${(item.allReasons || item.reasons || []).slice(0, 3).map(r => esc(r)).join(' · ')}</div>
        </div>
        <span class="change-item-date">${dateStr}</span>
    </div>`;
}

function getEmptyMessage(view) {
    switch (view) {
        case 'upgrades': return '近期無狀態升級';
        case 'conflicts': return '無新矛盾信號';
        case 'watchlist': return '關注項目無近期變更';
        default: return '最近沒有高優先級變更';
    }
}

// ===== Watchlist Panel (Phase 3) =====

function renderWatchlistPanel() {
    const panel = document.getElementById('watchlistPanel');
    const companiesList = document.getElementById('watchedCompanies');
    const chipsList = document.getElementById('watchedChips');
    if (!panel || !companiesList || !chipsList) return;

    const watchlist = getWatchlist();
    if (isWatchlistEmpty()) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';

    companiesList.innerHTML = watchlist.companies.map(id => {
        const s = allSignals.find(x => x.company_id === id);
        const name = s ? s.company_name : id;
        return `<div class="watchlist-item" data-type="company" data-id="${esc(id)}">
            <a href="company-signals.html?id=${esc(id)}" class="watchlist-link">${esc(name)}</a>
            <button class="watchlist-remove" data-type="company" data-id="${esc(id)}">&times;</button>
        </div>`;
    }).join('') || '<div class="watchlist-empty">尚無關注公司</div>';

    chipsList.innerHTML = watchlist.chips.map(name => {
        return `<div class="watchlist-item" data-type="chip" data-id="${esc(name)}">
            <a href="chip-signals.html?name=${esc(name)}" class="watchlist-link">${esc(name)}</a>
            <button class="watchlist-remove" data-type="chip" data-id="${esc(name)}">&times;</button>
        </div>`;
    }).join('') || '<div class="watchlist-empty">尚無關注芯片</div>';

    panel.querySelectorAll('.watchlist-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { type, id } = btn.dataset;
            if (type === 'company') toggleWatchCompany(id);
            else if (type === 'chip') toggleWatchChip(id);
            renderWatchlistPanel();
            renderWatchlistFocusStrip();
            renderSummaryLayer(allSignals);
            applyFilters();
        });
    });
}

// ===== Watchlist Focus Strip (Phase 4) =====

function renderWatchlistFocusStrip() {
    const strip = document.getElementById('watchlistFocusStrip');
    if (!strip) return;

    const watchlist = getWatchlist();
    if (isWatchlistEmpty()) {
        strip.style.display = 'none';
        return;
    }

    strip.style.display = 'flex';

    const companiesEl = document.getElementById('wlStripCompanies');
    const chipsEl = document.getElementById('wlStripChips');
    const signalsEl = document.getElementById('wlStripSignals');
    if (companiesEl) companiesEl.textContent = `${watchlist.companies.length} 公司`;
    if (chipsEl) chipsEl.textContent = `${watchlist.chips.length} 芯片`;
    if (signalsEl) signalsEl.textContent = `${watchlist.signals.length} 信號`;
}

// ===== View Toggles & Saved Views (Phase 2) =====

function loadSavedViews() {
    try {
        const stored = localStorage.getItem('chip-roadmap-saved-views');
        if (stored) savedViews = JSON.parse(stored);
    } catch (e) { console.error('[Signals] loadSavedViews error:', e); }
}

function saveSavedViews() {
    localStorage.setItem('chip-roadmap-saved-views', JSON.stringify(savedViews));
}

function renderSavedViews() {
    const list = document.getElementById('savedViewsList');
    if (!list) return;

    if (savedViews.length === 0) {
        list.innerHTML = '<span style="color:var(--color-muted-fg);font-style:italic">無儲存的視圖</span>';
        return;
    }

    list.innerHTML = savedViews.map((v, i) => `
        <div class="saved-view-token" data-index="${i}">
            <span class="saved-view-name">${esc(v.name)}</span>
            <button class="saved-view-delete" data-index="${i}" title="刪除">&times;</button>
        </div>
    `).join('');

    list.querySelectorAll('.saved-view-token').forEach(el => {
        el.addEventListener('click', (e) => {
            // Check if delete button was clicked
            if (e.target.classList.contains('saved-view-delete')) {
                e.stopPropagation();
                const idx = parseInt(e.target.dataset.index);
                if (confirm(`確定要刪除視圖「${savedViews[idx].name}」嗎？`)) {
                    savedViews.splice(idx, 1);
                    saveSavedViews();
                    renderSavedViews();
                }
                return;
            }
            const idx = parseInt(el.dataset.index);
            const view = savedViews[idx];
            filterState = { ...filterState, ...view.filters, view: 'all' };
            syncFilterUI();
            applyFilters();
        });
    });
}

function saveCurrentView() {
    const name = prompt('輸入視圖名稱：');
    if (!name) return;
    const newView = {
        name,
        filters: { ...filterState }
    };
    savedViews.push(newView);
    saveSavedViews();
    renderSavedViews();
}

function syncFilterUI() {
    document.getElementById('filterSearch').value = filterState.search || '';
    document.getElementById('filterRegion').value = filterState.region || '';
    document.getElementById('filterCompany').value = filterState.company || '';
    document.getElementById('filterStage').value = filterState.stage || '';
    document.getElementById('filterImpact').value = filterState.impact || '';
    document.getElementById('filterStatus').value = filterState.status || '';

    document.querySelectorAll('.view-toggle').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === filterState.view);
    });
}

function syncQuickViewButtons() {
    document.querySelectorAll('.wl-quick-btn').forEach(btn => {
        const qv = btn.dataset.quick;
        btn.classList.toggle('active', qv === filterState.quickView);
    });
}

// ===== Filters =====

function renderFilters() {
    const companies = [...new Set(allSignals.map(s => s.company_name).filter(Boolean))].sort();
    const stages = STAGE_ENUM;
    const impacts = IMPACT_ENUM;
    const statuses = STATUS_ENUM;

    populateSelect('filterRegion', REGION_OPTIONS.map(v => ({ value: v, label: regionLabel(v) })), '地區');
    populateSelect('filterCompany', companies, '公司');
    populateSelect('filterStage', stages.map(v => ({ value: v, label: stageLabel(v) })), '階段');
    populateSelect('filterImpact', impacts.map(v => ({ value: v, label: impactLabel(v) })), 'ABF 影響');
    populateSelect('filterStatus', statuses.map(v => ({ value: v, label: statusLabel(v) })), '狀態');
}

function populateSelect(id, options, placeholder) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">${placeholder || '—'}</option>` +
        options.map(o => {
            const val = typeof o === 'string' ? o : o.value;
            const label = typeof o === 'string' ? o : o.label;
            return `<option value="${esc(val)}" ${current === val ? 'selected' : ''}>${esc(label)}</option>`;
        }).join('');
}

function applyFilters() {
    const filtered = getFilteredSignals();
    renderSignalsTable(filtered);
}

function resetFilters() {
    filterState = { search: '', region: '', company: '', stage: '', impact: '', status: '', view: 'all', quickView: '' };
    syncFilterUI();
    syncQuickViewButtons();
    applyFilters();
}

// ===== Quick Views (Phase 4 / 4.1) =====

function applyQuickView(quick) {
    // Reset all filter fields first
    filterState.search = '';
    filterState.region = '';
    filterState.company = '';
    filterState.stage = '';
    filterState.impact = '';
    filterState.status = '';

    if (quick === 'wl-all') {
        filterState.quickView = 'wl-all';
        filterState.view = 'all';
    } else if (quick === 'wl-changed') {
        filterState.quickView = 'wl-changed';
        filterState.view = 'all';
    } else if (quick === 'wl-high') {
        filterState.quickView = 'wl-high';
        filterState.view = 'all';
    } else if (quick === 'wl-watch') {
        filterState.quickView = 'wl-watch';
        filterState.view = 'all';
    } else if (quick === 'all') {
        filterState.quickView = '';
        filterState.view = 'all';
    }

    syncFilterUI();
    syncQuickViewButtons();
    applyFilters();

    // Scroll to table
    document.getElementById('signalsTableWrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== Table =====

function renderSignalsTable(signals) {
    const wrap = document.getElementById('signalsTableWrap');
    if (!wrap) return;

    if (!signals.length) {
        renderEmptyState();
        return;
    }

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        renderMobileList(signals, wrap);
        // Explicitly hide compare strip on mobile
        const strip = document.getElementById('compareStrip');
        if (strip) strip.style.display = 'none';
    } else {
        renderDesktopTable(signals, wrap);
        // Compare strip display is handled by renderCompareStrip() on desktop
        renderCompareStrip();
    }
}

// ===== Watch Actions (Phase 3) =====

function watchIcon(active) {
    return active ? '&#9733;' : '&#9734;';
}

function renderDesktopTable(signals, wrap) {
    const rows = signals.map(s => {
        const isChecked = compareSelection.includes(s.id);
        const watchingCompany = isWatchingCompany(s.company_id);
        const watchingChip = isWatchingChip(s.chip_name);
        
        return `<tr class="signal-row" data-id="${esc(s.id)}">
            <td class="col-compare">
                <input type="checkbox" class="compare-checkbox" data-id="${esc(s.id)}" ${isChecked ? 'checked' : ''}>
            </td>
            <td class="col-company">
                <div class="entity-link-wrap">
                    <button class="watch-btn" data-type="company" data-id="${esc(s.company_id)}" title="關注公司">${watchIcon(watchingCompany)}</button>
                    <a href="company-signals.html?id=${esc(s.company_id)}" class="entity-link">${esc(s.company_name)}</a>
                </div>
            </td>
            <td class="col-chip">
                <div class="entity-link-wrap">
                    <button class="watch-btn" data-type="chip" data-id="${esc(s.chip_name)}" title="關注芯片">${watchIcon(watchingChip)}</button>
                    <a href="chip-signals.html?name=${esc(s.chip_name)}" class="entity-link">${esc(s.chip_name)}</a>
                </div>
            </td>
            <td class="col-region">${esc(regionLabel(s.region))}</td>
            <td class="col-stage">${esc(stageLabel(s.stage))}</td>
            <td class="col-impact">${impactBadge(s.abf_demand_impact)}</td>
            <td class="col-confidence">${confidenceBar(s.confidence_score)}</td>
            <td class="col-source">${sourceBadge(s)}</td>
            <td class="col-status"><span class="signal-status-chip ${statusChipClass(s.status)}">${esc(statusLabel(s.status))}</span></td>
            <td class="col-verified">${formatDate(s.last_verified_at)}</td>
            <td class="col-view"><button class="signal-view-btn" data-id="${esc(s.id)}">查看</button></td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
        <table class="signals-table">
            <thead><tr>
                <th class="col-compare">對比</th>
                <th>公司</th>
                <th>芯片</th>
                <th>地區</th>
                <th>階段</th>
                <th>ABF 影響</th>
                <th>信度</th>
                <th>來源</th>
                <th>狀態</th>
                <th>最後驗證</th>
                <th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;

    wrap.querySelectorAll('.signal-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.compare-checkbox') || e.target.closest('.signal-view-btn') || e.target.closest('.watch-btn') || e.target.closest('.entity-link')) return;
            const signal = allSignals.find(s => s.id === row.dataset.id);
            if (signal) openDrawer(signal);
        });
    });

    wrap.querySelectorAll('.signal-view-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const signal = allSignals.find(s => s.id === btn.dataset.id);
            if (signal) openDrawer(signal);
        });
    });

    wrap.querySelectorAll('.compare-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            toggleCompare(cb.dataset.id, cb.checked);
        });
    });

    wrap.querySelectorAll('.watch-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const { type, id } = btn.dataset;
            if (type === 'company') toggleWatchCompany(id);
            else if (type === 'chip') toggleWatchChip(id);
            renderWatchlistPanel();
            renderSummaryLayer(allSignals);
            applyFilters();
        });
    });
}

function renderMobileList(signals, wrap) {
    const items = signals.map(s => {
        const watchingCompany = isWatchingCompany(s.company_id);
        const watchingChip = isWatchingChip(s.chip_name);
        return `<div class="signal-mobile-row" data-id="${esc(s.id)}">
            <div class="mobile-row-top">
                <span class="mobile-company">
                    <button class="watch-btn watch-btn-sm" data-type="company" data-id="${esc(s.company_id)}">${watchIcon(watchingCompany)}</button>
                    <a href="company-signals.html?id=${esc(s.company_id)}" class="entity-link">${esc(s.company_name)}</a>
                </span>
                <span class="signal-status-chip ${statusChipClass(s.status)}">${esc(statusLabel(s.status))}</span>
                ${sourceBadge(s)}
            </div>
            <div class="mobile-chip">
                <button class="watch-btn watch-btn-sm" data-type="chip" data-id="${esc(s.chip_name)}">${watchIcon(watchingChip)}</button>
                <a href="chip-signals.html?name=${esc(s.chip_name)}" class="entity-link">${esc(s.chip_name)}</a>
            </div>
            <div class="mobile-meta">
                <span class="mobile-stage">${esc(stageLabel(s.stage))}</span>
                <span class="mobile-impact">${impactLabel(s.abf_demand_impact)}</span>
                <span class="mobile-confidence">${s.confidence_score}</span>
            </div>
            <div class="mobile-verified">${formatDate(s.last_verified_at)}</div>
        </div>`;
    }).join('');

    wrap.innerHTML = `<div class="signals-mobile-list">${items}</div>`;

    wrap.querySelectorAll('.signal-mobile-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.watch-btn') || e.target.closest('.entity-link')) return;
            const signal = allSignals.find(s => s.id === row.dataset.id);
            if (signal) openDrawer(signal);
            else console.warn('[Signals] no signal for id:', row.dataset.id);
        });
    });

    wrap.querySelectorAll('.watch-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const { type, id } = btn.dataset;
            if (type === 'company') toggleWatchCompany(id);
            else if (type === 'chip') toggleWatchChip(id);
            renderWatchlistPanel();
            renderSummaryLayer(allSignals);
            applyFilters();
        });
    });
}

function impactBadge(impact) {
    const cls = impact === 'explosive' ? 'impact-explosive'
        : impact === 'high' ? 'impact-high'
        : impact === 'medium' ? 'impact-medium' : 'impact-low';
    return `<span class="signal-impact-badge ${cls}">${impactLabel(impact)}</span>`;
}

function confidenceBar(score) {
    return `<span class="confidence-meter"><span class="confidence-bar-fill" style="width:${score}%"></span></span><span class="confidence-num">${score}</span>`;
}

// ===== Compare Mode (Phase 2) =====

function toggleCompare(id, checked) {
    if (checked) {
        if (compareSelection.length >= 3) {
            alert('最多只能選擇 3 個信號進行對比。');
            renderSignalsTable(getFilteredSignals());
            return;
        }
        if (!compareSelection.includes(id)) compareSelection.push(id);
    } else {
        compareSelection = compareSelection.filter(x => x !== id);
    }
    renderCompareStrip();
}

function renderCompareStrip() {
    const strip = document.getElementById('compareStrip');
    const count = document.getElementById('compareCount');
    const items = document.getElementById('compareItems');
    if (!strip || !count || !items) return;

    if (compareSelection.length === 0) {
        strip.style.display = 'none';
        return;
    }

    strip.style.display = 'flex';
    count.textContent = compareSelection.length;

    items.innerHTML = compareSelection.map(id => {
        const s = allSignals.find(x => x.id === id);
        return s ? `<div class="compare-item-tag">${esc(s.company_name)}: ${esc(s.chip_name)}</div>` : '';
    }).join('');
}

function clearCompare() {
    compareSelection = [];
    renderCompareStrip();
    renderSignalsTable(getFilteredSignals());
}

function openCompareModal() {
    if (compareSelection.length < 2) {
        alert('請至少選擇 2 個信號進行對比。');
        return;
    }

    const overlay = document.getElementById('drawerOverlay');
    const title = document.getElementById('drawerTitle');
    const body = document.getElementById('drawerBody');
    if (!overlay || !title || !body) return;

    const signals = compareSelection.map(id => allSignals.find(x => x.id === id)).filter(Boolean);
    title.textContent = '信號對比';

    let html = `<table class="compare-table">
        <thead>
            <tr>
                <th>欄位</th>
                ${signals.map(s => `<th>${esc(s.company_name)}: ${esc(s.chip_name)}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            <tr><td class="field-label">地區</td>${signals.map(s => `<td>${esc(regionLabel(s.region))}</td>`).join('')}</tr>
            <tr><td class="field-label">階段</td>${signals.map(s => `<td>${esc(stageLabel(s.stage))}</td>`).join('')}</tr>
            <tr><td class="field-label">ABF 影響</td>${signals.map(s => `<td>${impactBadge(s.abf_demand_impact)}</td>`).join('')}</tr>
            <tr><td class="field-label">信度</td>${signals.map(s => `<td>${s.confidence_score}</td>`).join('')}</tr>
            <tr><td class="field-label">狀態</td>${signals.map(s => `<td><span class="signal-status-chip ${statusChipClass(s.status)}">${esc(statusLabel(s.status))}</span></td>`).join('')}</tr>
            <tr><td class="field-label">封裝</td>${signals.map(s => `<td>${esc(s.package_type)}</td>`).join('')}</tr>
            <tr><td class="field-label">CoWoS</td>${signals.map(s => `<td>${s.cowos_required ? '是' : '否'}</td>`).join('')}</tr>
            <tr><td class="field-label">ABF 尺寸</td>${signals.map(s => `<td>${esc(s.abf_size)}</td>`).join('')}</tr>
            <tr><td class="field-label">ABF 層數</td>${signals.map(s => `<td>${s.abf_layers || ''}</td>`).join('')}</tr>
            <tr><td class="field-label">最後驗證</td>${signals.map(s => `<td>${formatDate(s.last_verified_at)}</td>`).join('')}</tr>
        </tbody>
    </table>`;

    body.innerHTML = html;
    overlay.classList.remove('drawer-mobile');
    overlay.style.display = 'flex';
    lockBodyScroll();
}

// ===== States =====

function renderLoadingSkeleton() {
    const wrap = document.getElementById('signalsTableWrap');
    if (!wrap) return;
    const rows = Array(6).fill('').map(() =>
        `<tr class="skeleton-row">
            <td><div class="skeleton-block" style="width:70%"></div></td>
            <td><div class="skeleton-block" style="width:50%"></div></td>
            <td><div class="skeleton-block" style="width:40%"></div></td>
            <td><div class="skeleton-block" style="width:60%"></div></td>
            <td><div class="skeleton-block" style="width:50%"></div></td>
            <td><div class="skeleton-block" style="width:80%"></div></td>
            <td><div class="skeleton-block" style="width:50%"></div></td>
            <td><div class="skeleton-block" style="width:60%"></div></td>
            <td><div class="skeleton-block" style="width:30%"></div></td>
        </tr>`
    ).join('');
    wrap.innerHTML = `
        <table class="signals-table">
            <thead><tr><th>公司</th><th>芯片</th><th>地區</th><th>階段</th><th>ABF 影響</th><th>信度</th><th>狀態</th><th>最後驗證</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function renderEmptyState() {
    const wrap = document.getElementById('signalsTableWrap');
    if (!wrap) return;

    const isWatchedView = filterState.view === 'watched';
    const isQuickView = !!filterState.quickView;
    const wlEmpty = (isWatchedView || isQuickView) && isWatchlistEmpty();

    let title, sub;
    if (wlEmpty) {
        title = '關注列表為空';
        sub = '在信號表格中點擊 ☆ 圖標，將公司或芯片加入關注列表';
    } else if (isQuickView) {
        const quickLabels = {
            'wl-all': '只看關注',
            'wl-changed': '關注中變更',
            'wl-high': '關注中高影響',
            'wl-watch': '關注中待驗證',
        };
        title = `「${quickLabels[filterState.quickView] || filterState.quickView}」無結果`;
        sub = '嘗試清除篩選條件，或切換到其他視圖';
    } else {
        title = '沒有符合當前篩選條件的信號';
        sub = '嘗試清除篩選條件，或放寬地區與階段選擇';
    }

    wrap.innerHTML = `
        <div class="signals-empty-state">
            <p class="empty-title">${title}</p>
            <p class="empty-sub">${sub}</p>
            ${!wlEmpty ? '<button id="filterReset" class="filter-reset" style="margin-top:12px">清除篩選</button>' : ''}
        </div>`;

    document.getElementById('filterReset')?.addEventListener('click', resetFilters);
}

function renderErrorState() {
    const wrap = document.getElementById('signalsTableWrap');
    if (!wrap) return;
    wrap.innerHTML = `
        <div class="signals-error-state">
            <p class="error-title">信號載入失敗</p>
            <button id="signalsRetry" class="filter-reset" style="margin-top:12px">重試</button>
        </div>`;
    document.getElementById('signalsRetry')?.addEventListener('click', () => init());
}

// ===== Detail Drawer =====

// ===== Detail Drawer =====

function lockBodyScroll() {
    if (drawerScrollLock) return;
    const body = document.body;
    const scrollBarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    drawerScrollLock = {
        overflow: body.style.overflow,
        paddingRight: body.style.paddingRight,
    };
    body.style.overflow = 'hidden';
    if (scrollBarGap > 0) {
        body.style.paddingRight = `${scrollBarGap}px`;
    }
}

function unlockBodyScroll() {
    if (!drawerScrollLock) return;
    const body = document.body;
    body.style.overflow = drawerScrollLock.overflow;
    body.style.paddingRight = drawerScrollLock.paddingRight;
    drawerScrollLock = null;
}

function openDrawer(signal) {
    try {
    const overlay = document.getElementById('drawerOverlay');
    const title = document.getElementById('drawerTitle');
    const body = document.getElementById('drawerBody');
    if (!overlay || !title || !body) { console.warn('[Signals] drawer elements missing'); return; }

    title.innerHTML = esc(signal.title || '') + sourceBadge(signal);

    const isMobile = window.innerWidth <= 768;

    const watchingCompany = isWatchingCompany(signal.company_id);
    const watchingChip = isWatchingChip(signal.chip_name);
    const watchingSignal = isWatchingSignal(signal.id);

    let html = '';

    // Phase 3: Watch Actions
    html += `<div class="drawer-actions-row">
        <button class="drawer-watch-btn ${watchingSignal ? 'active' : ''}" data-type="signal" data-id="${esc(signal.id)}">
            ${watchIcon(watchingSignal)} 關注此信號
        </button>
        <button class="drawer-watch-btn ${watchingCompany ? 'active' : ''}" data-type="company" data-id="${esc(signal.company_id)}">
            ${watchIcon(watchingCompany)} 關注公司
        </button>
        <button class="drawer-watch-btn ${watchingChip ? 'active' : ''}" data-type="chip" data-id="${esc(signal.chip_name)}">
            ${watchIcon(watchingChip)} 關注芯片
        </button>
    </div>`;

    // Section 1: Identity
    html += `<div class="drawer-section">
        <h3 class="drawer-section-title">識別資訊</h3>
        <div class="drawer-field">
            <span class="drawer-field-label">公司</span>
            <span class="drawer-field-value">
                <a href="company-signals.html?id=${esc(signal.company_id)}" class="entity-link">${esc(signal.company_name)}</a>
            </span>
        </div>
        <div class="drawer-field">
            <span class="drawer-field-label">芯片</span>
            <span class="drawer-field-value">
                <a href="chip-signals.html?name=${esc(signal.chip_name)}" class="entity-link">${esc(signal.chip_name)}</a>
                <a href="chip-signals.html?name=${esc(signal.chip_name)}" class="drawer-impact-link">查看芯片影響 →</a>
            </span>
        </div>
        <div class="drawer-field"><span class="drawer-field-label">地區</span><span class="drawer-field-value">${esc(regionLabel(signal.region))}</span></div>
    </div>`;

    // Section 2: Signal status
    html += `<div class="drawer-section">
        <h3 class="drawer-section-title">信號狀態</h3>
        <div class="drawer-field"><span class="drawer-field-label">狀態</span><span class="signal-status-chip ${statusChipClass(signal.status)}">${esc(statusLabel(signal.status))}</span></div>
        <div class="drawer-field"><span class="drawer-field-label">信度</span><span class="drawer-field-value">${confidenceBar(signal.confidence_score)}</span></div>
        ${signal.confidence_reason ? `<div class="drawer-field"><span class="drawer-field-label">信度依據</span><span class="drawer-field-value">${esc(signal.confidence_reason)}</span></div>` : ''}
        <div class="drawer-field"><span class="drawer-field-label">最後驗證</span><span class="drawer-field-value">${formatDate(signal.last_verified_at)}</span></div>
        ${signal.last_verified_by ? `<div class="drawer-field"><span class="drawer-field-label">驗證人</span><span class="drawer-field-value">${esc(signal.last_verified_by)}</span></div>` : ''}
        ${signal.last_status_changed_at ? `<div class="drawer-field"><span class="drawer-field-label">狀態變更</span><span class="drawer-field-value">${formatDate(signal.last_status_changed_at)}</span></div>` : ''}
        ${signal.verification_note ? `<div class="drawer-field"><span class="drawer-field-label">驗證備註</span><span class="drawer-field-value">${esc(signal.verification_note)}</span></div>` : ''}
    </div>`;

    // Section 3: Supply chain implication (only show if fields exist)
    const hasSupplyChain = signal.package_type || signal.cowos_required || signal.abf_size || signal.abf_layers || signal.hbm;
    if (hasSupplyChain) {
        html += `<div class="drawer-section">
            <h3 class="drawer-section-title">供應鏈影響</h3>`;
        if (signal.package_type) html += `<div class="drawer-field"><span class="drawer-field-label">封裝</span><span class="drawer-field-value">${esc(signal.package_type)}</span></div>`;
        if (signal.cowos_required) html += `<div class="drawer-field"><span class="drawer-field-label">CoWoS</span><span class="drawer-field-value">是</span></div>`;
        if (signal.abf_size) html += `<div class="drawer-field"><span class="drawer-field-label">ABF 尺寸</span><span class="drawer-field-value">${esc(signal.abf_size)}</span></div>`;
        if (signal.abf_layers) html += `<div class="drawer-field"><span class="drawer-field-label">ABF 層數</span><span class="drawer-field-value">${signal.abf_layers}</span></div>`;
        if (signal.hbm) html += `<div class="drawer-field"><span class="drawer-field-label">HBM</span><span class="drawer-field-value">${esc(signal.hbm)}</span></div>`;
        html += `</div>`;
    }

    // Section 4: Evidence
    if (signal.evidence_summary) {
        html += `<div class="drawer-section">
            <h3 class="drawer-section-title">證據</h3>
            <p class="drawer-text">${esc(signal.evidence_summary)}</p>
        </div>`;
    }

    // Section 5: Conflicting evidence
    if (signal.conflicting_evidence) {
        html += `<div class="drawer-section">
            <h3 class="drawer-section-title">矛盾證據</h3>
            <p class="drawer-text">${esc(signal.conflicting_evidence)}</p>
        </div>`;
    }

    // Section 6: Notes
    if (signal.notes) {
        html += `<div class="drawer-section">
            <h3 class="drawer-section-title">備註</h3>
            <p class="drawer-text">${esc(signal.notes)}</p>
        </div>`;
    }

    // Section 7: Sources
    if (signal.sources && signal.sources.length > 0) {
        html += `<div class="drawer-section">
            <h3 class="drawer-section-title">來源</h3>
            <ul class="drawer-sources">`;
        signal.sources.forEach(src => {
            const label = src.label || src.type || '來源';
            const url = src.url || '#';
            html += `<li><a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)}</a></li>`;
        });
        html += `</ul></div>`;
    }

    // Section 8: History (Phase 4)
    html += `<div class="drawer-section">
        <h3 class="drawer-section-title">變更歷史</h3>
        <div class="drawer-history" id="drawerHistory">
            <div class="history-loading">載入中...</div>
        </div>
    </div>`;

    body.innerHTML = html;

    body.querySelectorAll('.drawer-watch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const { type, id } = btn.dataset;
            if (type === 'company') toggleWatchCompany(id);
            else if (type === 'chip') toggleWatchChip(id);
            else if (type === 'signal') toggleWatchSignal(id);

            // Re-render drawer partially
            btn.classList.toggle('active');
            btn.innerHTML = `${watchIcon(btn.classList.contains('active'))} ${btn.textContent.trim().slice(2)}`;

            renderWatchlistPanel();
            renderSummaryLayer(allSignals);
            applyFilters();
        });
    });

    // Load and render history (Phase 4)
    loadDrawerHistory(signal.id);

    if (isMobile) {
        overlay.classList.add('drawer-mobile');
    } else {
        overlay.classList.remove('drawer-mobile');
    }

    overlay.style.display = 'flex';
    lockBodyScroll();
    } catch (err) {
        console.error('[Signals] openDrawer error:', err);
    }
}

function closeDrawer() {
    const overlay = document.getElementById('drawerOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    unlockBodyScroll();
}

// ===== Drawer History (Phase 4) =====

async function loadDrawerHistory(signalId) {
    const container = document.getElementById('drawerHistory');
    if (!container) return;

    const history = await loadSignalHistory(signalId, 20);

    if (!history || history.length === 0) {
        container.innerHTML = '<div class="history-empty">尚無變更記錄</div>';
        return;
    }

    const items = history.map(h => {
        const ts = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp || 0);
        const dateStr = ts.toISOString().slice(0, 10);
        const timeStr = ts.toISOString().slice(11, 16);
        const actionLabel = HISTORY_ACTION_LABELS[h.action] || h.action || '更新';
        const actorStr = h.actor ? ` — ${esc(h.actor)}` : '';
        const summaryStr = h.summary ? esc(h.summary) : '';

        return `<div class="history-row">
            <div class="history-meta">
                <span class="history-action-badge">${esc(actionLabel)}</span>
                <span class="history-time">${esc(dateStr)} ${esc(timeStr)}</span>
            </div>
            ${summaryStr ? `<div class="history-summary">${summaryStr}${actorStr}</div>` : `<div class="history-actor">${actorStr ? actorStr.slice(2) : '—'}</div>`}
        </div>`;
    }).join('');

    container.innerHTML = items;
}

// ===== Event Binding =====

function bindEvents() {
    // Filter inputs
    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    const searchInput = document.getElementById('filterSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            filterState.search = searchInput.value.trim();
            applyFilters();
        }, 250));
    }

    ['filterRegion', 'filterCompany', 'filterStage', 'filterImpact', 'filterStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                const key = id.replace('filter', '').toLowerCase();
                filterState[key] = el.value;
                applyFilters();
            });
        }
    });

    const resetBtn = document.getElementById('filterReset');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);

    // Phase 2: Save View
    const saveViewBtn = document.getElementById('saveViewBtn');
    if (saveViewBtn) saveViewBtn.addEventListener('click', saveCurrentView);

    // Phase 2: View Toggles
    const toggles = document.getElementById('viewToggles');
    if (toggles) {
        toggles.addEventListener('click', e => {
            const btn = e.target.closest('.view-toggle');
            if (btn) {
                filterState.view = btn.dataset.view;
                syncFilterUI();
                applyFilters();
            }
        });
    }

    // Phase 3: Watchlist Clear
    const clearWatchBtn = document.getElementById('clearWatchlistBtn');
    if (clearWatchBtn) {
        clearWatchBtn.addEventListener('click', () => {
            if (confirm('確定要清除全部關注項嗎？')) {
                clearWatchlist();
                filterState.quickView = '';
                renderWatchlistPanel();
                renderWatchlistFocusStrip();
                syncQuickViewButtons();
                renderSummaryLayer(allSignals);
                applyFilters();
            }
        });
    }

    // Phase 4: Watchlist Quick Actions
    const wlStrip = document.getElementById('watchlistFocusStrip');
    if (wlStrip) {
        wlStrip.addEventListener('click', e => {
            const btn = e.target.closest('.wl-quick-btn');
            if (!btn) return;
            const quick = btn.dataset.quick;
            applyQuickView(quick);
        });
    }

    // Phase 2: Compare Actions
    const compareClear = document.getElementById('compareClear');
    if (compareClear) compareClear.addEventListener('click', clearCompare);
    const compareBtn = document.getElementById('compareBtn');
    if (compareBtn) compareBtn.addEventListener('click', openCompareModal);

    // Drawer close
    const closeBtn = document.getElementById('drawerClose');
    const overlay = document.getElementById('drawerOverlay');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) {
        overlay.addEventListener('click', e => { if (e.target === overlay) closeDrawer(); });
    }
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlay?.style.display === 'flex') closeDrawer();
    });

    // Re-render on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const filtered = getFilteredSignals();
            renderSignalsTable(filtered);
        }, 200);
    });
}

function getFilteredSignals() {
    let filtered = [...allSignals];
    const { search, region, company, stage, impact, status, view, quickView } = filterState;

    // Phase 4.1: Quick views take precedence over regular view
    if (quickView === 'wl-all') {
        filtered = filtered.filter(s =>
            isWatchingCompany(s.company_id) ||
            isWatchingChip(s.chip_name) ||
            isWatchingSignal(s.id)
        );
    } else if (quickView === 'wl-changed') {
        filtered = filtered.filter(s =>
            isWatchingCompany(s.company_id) ||
            isWatchingChip(s.chip_name) ||
            isWatchingSignal(s.id)
        );
        filtered = filtered.filter(s =>
            isRecent(s.last_status_changed_at, 14) ||
            isRecent(s.last_confidence_changed_at, 14)
        );
        filtered.sort((a, b) => {
            const dateA = a.last_status_changed_at || a.last_confidence_changed_at || '';
            const dateB = b.last_status_changed_at || b.last_confidence_changed_at || '';
            return new Date(dateB || 0) - new Date(dateA || 0);
        });
        return applyTextAndDropdownFilters(filtered, search, region, company, stage, impact, status);
    } else if (quickView === 'wl-high') {
        filtered = filtered.filter(s =>
            isWatchingCompany(s.company_id) ||
            isWatchingChip(s.chip_name) ||
            isWatchingSignal(s.id)
        );
        filtered = filtered.filter(s =>
            s.abf_demand_impact === 'high' || s.abf_demand_impact === 'explosive'
        );
        filtered.sort((a, b) => b._priority - a._priority);
        return applyTextAndDropdownFilters(filtered, search, region, company, stage, impact, status);
    } else if (quickView === 'wl-watch') {
        filtered = filtered.filter(s =>
            isWatchingCompany(s.company_id) ||
            isWatchingChip(s.chip_name) ||
            isWatchingSignal(s.id)
        );
        filtered = filtered.filter(s =>
            s.status === 'watch' || s.status === 'draft'
        );
        filtered.sort((a, b) => b._priority - a._priority);
        return applyTextAndDropdownFilters(filtered, search, region, company, stage, impact, status);
    } else if (view === 'watched') {
        filtered = filtered.filter(s =>
            isWatchingCompany(s.company_id) ||
            isWatchingChip(s.chip_name) ||
            isWatchingSignal(s.id)
        );
    } else if (view === 'new') {
        filtered = filtered.filter(s => isRecent(s.createdAt, 7));
    } else if (view === 'changed') {
        filtered = filtered.filter(s => isRecent(s.last_status_changed_at, 14) || isRecent(s.last_confidence_changed_at, 14) || isRecent(s.last_verified_at, 14));
    } else if (view === 'high-impact') {
        filtered = filtered.filter(s => s.abf_demand_impact === 'high' || s.abf_demand_impact === 'explosive');
    } else if (view === 'verified') {
        filtered = filtered.filter(s => s.status === 'verified');
    } else if (view === 'china') {
        filtered = filtered.filter(s => s.region === 'China');
    } else if (view === 'global') {
        filtered = filtered.filter(s => s.region === 'Global');
    }

    filtered.sort((a, b) => b._priority - a._priority);
    return applyTextAndDropdownFilters(filtered, search, region, company, stage, impact, status);
}

// Extract text search + dropdown filtering to avoid duplication
function applyTextAndDropdownFilters(filtered, search, region, company, stage, impact, status) {
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(s =>
            (s.company_name || '').toLowerCase().includes(q) ||
            (s.chip_name || '').toLowerCase().includes(q) ||
            (s.title || '').toLowerCase().includes(q)
        );
    }
    if (region) filtered = filtered.filter(s => s.region === region);
    if (company) filtered = filtered.filter(s => s.company_name === company);
    if (stage) filtered = filtered.filter(s => s.stage === stage);
    if (impact) filtered = filtered.filter(s => s.abf_demand_impact === impact);
    if (status) filtered = filtered.filter(s => s.status === status);
    return filtered;
}
