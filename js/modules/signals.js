/**
 * Signals Page Module
 * Table-first, analyst-friendly interface for verified AI chip signals.
 */

import { loadSignals } from '../firebase/db.js';
import { STAGE_LABEL, STATUS_LABEL, IMPACT_LABEL, REGION_LABEL, labelize } from './signals-labels.js';

// ===== Enums =====
const STAGE_ENUM = ['rumor', 'announced', 'sampling', 'design_win', 'pilot', 'ramp', 'volume'];
const STATUS_ENUM = ['draft', 'watch', 'verified', 'downgraded', 'invalidated'];
const IMPACT_ENUM = ['low', 'medium', 'high', 'explosive'];
const REGION_OPTIONS = ['China', 'Taiwan', 'USA', 'Korea', 'Japan', 'Europe', 'Israel', 'Canada', 'Other', 'Global'];
const IMPACT_SORT = { explosive: 4, high: 3, medium: 2, low: 1 };

// ===== State =====
let allSignals = [];
let filterState = {
    search: '',
    region: '',
    company: '',
    stage: '',
    impact: '',
    status: '',
};

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

function formatDate(d) {
    if (!d) return '—';
    try {
        return new Date(d).toISOString().slice(0, 10);
    } catch { return '—'; }
}

function isThisWeek(d) {
    if (!d) return false;
    try {
        const now = new Date();
        const then = new Date(d);
        const diff = (now - then) / (1000 * 60 * 60 * 24);
        return diff <= 7 && diff >= 0;
    } catch { return false; }
}

// ===== Public API =====

export async function init() {
    renderLoadingSkeleton();
    try {
        allSignals = await loadSignals();
        if (!Array.isArray(allSignals) || allSignals.length === 0) {
            renderEmptyState();
        } else {
            renderSummaryStrip(allSignals);
            renderFilters();
            renderSignalsTable(allSignals);
        }
    } catch (err) {
        console.error('[Signals] Load error:', err);
        renderErrorState();
    }
    bindEvents();
}

// ===== Summary Strip =====

function renderSummaryStrip(signals) {
    const active = signals.filter(s => s.status !== 'draft' && s.status !== 'invalidated').length;
    const verified = signals.filter(s => s.status === 'verified').length;
    const highImpact = signals.filter(s => s.abf_demand_impact === 'high' || s.abf_demand_impact === 'explosive').length;
    const thisWeek = signals.filter(s => isThisWeek(s.last_verified_at)).length;

    const el = id => document.getElementById(id);
    if (el('sumActive')) el('sumActive').textContent = active;
    if (el('sumVerified')) el('sumVerified').textContent = verified;
    if (el('sumHighImpact')) el('sumHighImpact').textContent = highImpact;
    if (el('sumThisWeek')) el('sumThisWeek').textContent = thisWeek;
}

// ===== Filters =====

function renderFilters() {
    const companies = [...new Set(allSignals.map(s => s.company_name).filter(Boolean))].sort();
    const stages = STAGE_ENUM;
    const impacts = IMPACT_ENUM;
    const statuses = STATUS_ENUM;

    populateSelect('filterRegion', REGION_OPTIONS.map(v => ({ value: v, label: regionLabel(v) })), '');
    populateSelect('filterCompany', companies, '');
    populateSelect('filterStage', stages.map(v => ({ value: v, label: stageLabel(v) })), '');
    populateSelect('filterImpact', impacts.map(v => ({ value: v, label: impactLabel(v) })), '');
    populateSelect('filterStatus', statuses.map(v => ({ value: v, label: statusLabel(v) })), '');
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
    let filtered = [...allSignals];
    const { search, region, company, stage, impact, status } = filterState;

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

    // Re-sort after filter
    filtered.sort((a, b) => {
        const impDiff = (IMPACT_SORT[b.abf_demand_impact] || 0) - (IMPACT_SORT[a.abf_demand_impact] || 0);
        if (impDiff !== 0) return impDiff;
        const dateDiff = new Date(b.last_verified_at || 0) - new Date(a.last_verified_at || 0);
        if (dateDiff !== 0) return dateDiff;
        return b.confidence_score - a.confidence_score;
    });

    renderSignalsTable(filtered);
}

function resetFilters() {
    filterState = { search: '', region: '', company: '', stage: '', impact: '', status: '' };
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterRegion').value = '';
    document.getElementById('filterCompany').value = '';
    document.getElementById('filterStage').value = '';
    document.getElementById('filterImpact').value = '';
    document.getElementById('filterStatus').value = '';
    applyFilters();
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
    } else {
        renderDesktopTable(signals, wrap);
    }
}

function renderDesktopTable(signals, wrap) {
    const rows = signals.map(s => {
        return `<tr class="signal-row" data-id="${esc(s.id)}">
            <td class="col-company">${esc(s.company_name)}</td>
            <td class="col-chip">${esc(s.chip_name)}</td>
            <td class="col-region">${esc(regionLabel(s.region))}</td>
            <td class="col-stage">${esc(stageLabel(s.stage))}</td>
            <td class="col-impact">${impactBadge(s.abf_demand_impact)}</td>
            <td class="col-confidence">${confidenceBar(s.confidence_score)}</td>
            <td class="col-status"><span class="signal-status-chip ${statusChipClass(s.status)}">${esc(statusLabel(s.status))}</span></td>
            <td class="col-verified">${formatDate(s.last_verified_at)}</td>
            <td class="col-view"><button class="signal-view-btn" data-id="${esc(s.id)}">查看</button></td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
        <table class="signals-table">
            <thead><tr>
                <th>公司</th>
                <th>芯片</th>
                <th>地區</th>
                <th>階段</th>
                <th>ABF 影響</th>
                <th>信度</th>
                <th>狀態</th>
                <th>最後驗證</th>
                <th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;

    wrap.querySelectorAll('.signal-view-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const signal = allSignals.find(s => s.id === btn.dataset.id);
            if (signal) openDrawer(signal);
            else console.warn('[Signals] no signal for id:', btn.dataset.id);
        });
    });
    wrap.querySelectorAll('.signal-row').forEach(row => {
        row.addEventListener('click', () => {
            const signal = allSignals.find(s => s.id === row.dataset.id);
            if (signal) openDrawer(signal);
            else console.warn('[Signals] no signal for id:', row.dataset.id);
        });
    });
}

function renderMobileList(signals, wrap) {
    const items = signals.map(s => {
        return `<div class="signal-mobile-row" data-id="${esc(s.id)}">
            <div class="mobile-row-top">
                <span class="mobile-company">${esc(s.company_name)}</span>
                <span class="signal-status-chip ${statusChipClass(s.status)}">${esc(statusLabel(s.status))}</span>
            </div>
            <div class="mobile-chip">${esc(s.chip_name)}</div>
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
        row.addEventListener('click', () => {
            const signal = allSignals.find(s => s.id === row.dataset.id);
            if (signal) openDrawer(signal);
            else console.warn('[Signals] no signal for id:', row.dataset.id);
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
    wrap.innerHTML = `
        <div class="signals-empty-state">
            <p class="empty-title">沒有符合當前篩選條件的信號</p>
            <p class="empty-sub">嘗試清除篩選條件，或放寬地區與階段選擇</p>
        </div>`;
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

function openDrawer(signal) {
    try {
    const overlay = document.getElementById('drawerOverlay');
    const title = document.getElementById('drawerTitle');
    const body = document.getElementById('drawerBody');
    if (!overlay || !title || !body) { console.warn('[Signals] drawer elements missing'); return; }

    title.textContent = signal.title || '';

    const isMobile = window.innerWidth <= 768;

    let html = '';

    // Section 1: Identity
    html += `<div class="drawer-section">
        <h3 class="drawer-section-title">識別資訊</h3>
        <div class="drawer-field"><span class="drawer-field-label">公司</span><span class="drawer-field-value">${esc(signal.company_name)}</span></div>
        <div class="drawer-field"><span class="drawer-field-label">芯片</span><span class="drawer-field-value">${esc(signal.chip_name)}</span></div>
        <div class="drawer-field"><span class="drawer-field-label">地區</span><span class="drawer-field-value">${esc(regionLabel(signal.region))}</span></div>
    </div>`;

    // Section 2: Signal status
    html += `<div class="drawer-section">
        <h3 class="drawer-section-title">信號狀態</h3>
        <div class="drawer-field"><span class="drawer-field-label">狀態</span><span class="signal-status-chip ${statusChipClass(signal.status)}">${esc(statusLabel(signal.status))}</span></div>
        <div class="drawer-field"><span class="drawer-field-label">信度</span><span class="drawer-field-value">${confidenceBar(signal.confidence_score)}</span></div>
        <div class="drawer-field"><span class="drawer-field-label">最後驗證</span><span class="drawer-field-value">${formatDate(signal.last_verified_at)}</span></div>
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

    body.innerHTML = html;

    if (isMobile) {
        overlay.classList.add('drawer-mobile');
    } else {
        overlay.classList.remove('drawer-mobile');
    }

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    } catch (err) {
        console.error('[Signals] openDrawer error:', err);
    }
}

function closeDrawer() {
    const overlay = document.getElementById('drawerOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    document.body.style.overflow = '';
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
    const { search, region, company, stage, impact, status } = filterState;
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
    filtered.sort((a, b) => {
        const impDiff = (IMPACT_SORT[b.abf_demand_impact] || 0) - (IMPACT_SORT[a.abf_demand_impact] || 0);
        if (impDiff !== 0) return impDiff;
        const dateDiff = new Date(b.last_verified_at || 0) - new Date(a.last_verified_at || 0);
        if (dateDiff !== 0) return dateDiff;
        return b.confidence_score - a.confidence_score;
    });
    return filtered;
}
