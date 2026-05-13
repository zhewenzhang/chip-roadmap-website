/**
 * Entity Signals Module — Phase 8 (Entity-Centered Intelligence)
 * Handles the logic for company and chip intelligence pages.
 * Uses entity-intelligence.js for dossier derivation.
 */

import { loadSignals } from '../firebase/db.js';
import {
    STAGE_LABEL, STATUS_LABEL, IMPACT_LABEL, REGION_LABEL, labelize,
    IMPACT_SORT
} from './signals-schema.js';
import {
    loadWatchlist, isWatchingCompany, isWatchingChip,
    toggleWatchCompany, toggleWatchChip, getWatchlist
} from './watchlist.js';
import {
    buildCompanyDossier, buildChipDossier,
    getCompanyChipPortfolio, getChipCompanyContext,
    getSiblingChips, getEntityRiskIndicators, getVerificationTrend
} from './entity-intelligence.js';

// ===== State =====
let allSignals = [];
let entityType = ''; // 'company' or 'chip'
let entityId = '';   // company_id or chip_name

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

// ===== Initialization =====

export async function initEntityPage(type) {
    entityType = type;
    const params = new URLSearchParams(window.location.search);
    entityId = type === 'company' ? params.get('id') : params.get('name');

    if (!entityId) {
        document.body.innerHTML = '<h1>未指定的實體 ID</h1>';
        return;
    }

    loadWatchlist();
    const result = await loadSignals();
    if (!result.ok) {
        console.error('[EntitySignals] Load error:', result.error);
        document.getElementById('signalsTableWrap').innerHTML = '<p class="entity-error">信號載入失敗，請稍後重試。</p>';
        return;
    }

    allSignals = result.data;
    const filtered = type === 'company'
        ? allSignals.filter(s => s.company_id === entityId)
        : allSignals.filter(s => s.chip_name === entityId);

    // Handle empty entity — show useful empty state
    document.getElementById('entityName').textContent = entityId;
    if (filtered.length === 0) {
        const metaEl = document.getElementById('entityMeta');
        if (type === 'company') {
            metaEl.innerHTML = '<span>尚無收錄此公司的信號</span>';
        } else {
            metaEl.innerHTML = '<span>尚無收錄此芯片的信號</span>';
        }
        document.getElementById('signalsTableWrap').innerHTML = '<p class="entity-empty">尚無相關信號。可在管理後台新增。</p>';
        // Still render sidebar with empty dossier
        renderSidebar(filtered, allSignals);
        bindEvents();
        return;
    }

    renderEntityInfo(filtered);
    renderSignalsTable(filtered);
    renderSidebar(filtered, allSignals);
    bindEvents();
}

function renderEntityInfo(signals) {
    const first = signals[0];
    const nameEl = document.getElementById('entityName');
    const metaEl = document.getElementById('entityMeta');
    const watchBtn = document.getElementById('entityWatchBtn');

    if (entityType === 'company') {
        nameEl.textContent = first.company_name;
        metaEl.innerHTML = `<span>地區：${esc(regionLabel(first.region))}</span>`;
        const active = isWatchingCompany(entityId);
        watchBtn.innerHTML = `${active ? '&#9733;' : '&#9734;'} ${active ? '取消關注' : '關注公司'}`;
        watchBtn.classList.toggle('active', active);
    } else {
        nameEl.textContent = first.chip_name;
        metaEl.innerHTML = `<span>廠商：<a href="company-signals.html?id=${esc(first.company_id)}">${esc(first.company_name)}</a></span>`;
        const active = isWatchingChip(entityId);
        watchBtn.innerHTML = `${active ? '&#9733;' : '&#9734;'} ${active ? '取消關注' : '關注芯片'}`;
        watchBtn.classList.toggle('active', active);

        // Update chip breadcrumb to include company link
        const breadcrumb = document.getElementById('chipBreadcrumb');
        if (breadcrumb) {
            breadcrumb.innerHTML = `<a href="companies.html">← 返回公司目錄</a> &nbsp;/&nbsp; <a href="company-signals.html?id=${esc(first.company_id)}">${esc(first.company_name)}</a>`;
        }
    }
}

function renderSignalsTable(signals) {
    const wrap = document.getElementById('signalsTableWrap');
    if (!wrap) return;

    const rows = signals.map(s => `
        <tr class="signal-row" data-id="${esc(s.id)}">
            <td>${formatDate(s.last_verified_at)}</td>
            <td>${esc(s.title)}</td>
            <td>${esc(stageLabel(s.stage))}</td>
            <td>${impactBadge(s.abf_demand_impact)}</td>
            <td><span class="signal-status-chip ${statusChipClass(s.status)}">${esc(statusLabel(s.status))}</span></td>
            <td><button class="signal-view-btn" data-id="${esc(s.id)}">查看</button></td>
        </tr>
    `).join('');

    wrap.innerHTML = `
        <table class="signals-table">
            <thead>
                <tr>
                    <th>日期</th>
                    <th>標題</th>
                    <th>階段</th>
                    <th>影響</th>
                    <th>狀態</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    wrap.querySelectorAll('.signal-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.signal-view-btn')) return;
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
}

function renderSidebar(signals, allSigs) {
    if (entityType === 'company') {
        const dossier = buildCompanyDossier(entityId, allSigs);
        renderCompanyOverview(dossier);
        renderChipPortfolio(dossier.portfolio);
        renderStatusStats(signals);
        renderRiskIndicators(dossier.risks);
        renderVerificationTrend(dossier.trend);
        renderHighImpactItems(signals);
        renderRecentChanges(signals);
    } else {
        const dossier = buildChipDossier(entityId, allSigs);
        renderChipOverview(dossier);
        renderCompanyContext(dossier.companyContext);
        renderSiblingChips(dossier.siblings);
        renderChipRiskIndicators(dossier.risks);
        renderChipRecentChanges(signals);
        renderVerificationTimeline(signals);
    }
}

// ===== Company Dossier Functions (Phase 8) =====

function renderCompanyOverview(dossier) {
    const el = document.getElementById('companyOverview');
    if (!el) return;
    el.innerHTML = `
        <div class="info-row"><span>地區：</span><strong>${esc(regionLabel(dossier.region))}</strong></div>
        <div class="info-row"><span>信號總數：</span><strong>${dossier.signalCount}</strong></div>
        <div class="info-row"><span>最新信號：</span><strong>${formatDate(dossier.latestDate)}</strong></div>
        <div class="info-row"><span>最高 ABF 影響：</span><strong>${esc(IMPACT_LABEL[dossier.highestImpact] || '—')}</strong></div>
        <div class="info-row"><span>芯片數量：</span><strong>${dossier.chipCount}</strong></div>
    `;
}

function renderChipPortfolio(portfolio) {
    const el = document.getElementById('chipPortfolio');
    if (!el) return;
    if (portfolio.length === 0) {
        el.innerHTML = '<div class="sidebar-empty">無</div>';
        return;
    }
    el.innerHTML = portfolio.slice(0, 8).map(c => `
        <div class="sidebar-list-item" data-chip="${esc(c.chipName)}">
            <div class="item-title"><a href="chip-signals.html?name=${esc(c.chipName)}">${esc(c.chipName)}</a></div>
            <div class="item-meta">${c.signalCount} 信號 · ${esc(IMPACT_LABEL[c.highestImpact] || '—')}</div>
        </div>
    `).join('');
    el.querySelectorAll('.sidebar-list-item').forEach(el2 => {
        el2.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const chip = el2.dataset.chip;
            window.location.href = `chip-signals.html?name=${encodeURIComponent(chip)}`;
        });
    });
}

function renderRiskIndicators(risks) {
    const el = document.getElementById('companyRisks');
    if (!el) return;
    if (risks.totalRiskSignals === 0) {
        el.innerHTML = '<div class="sidebar-empty">無風險信號</div>';
        return;
    }
    let html = '';
    if (risks.conflictingEvidenceCount > 0) {
        html += `<div class="risk-row"><span class="risk-label">矛盾證據</span><span class="risk-count">${risks.conflictingEvidenceCount}</span></div>`;
    }
    if (risks.lowConfHighImpactCount > 0) {
        html += `<div class="risk-row"><span class="risk-label">低信度高影響</span><span class="risk-count">${risks.lowConfHighImpactCount}</span></div>`;
    }
    if (risks.staleVerificationCount > 0) {
        html += `<div class="risk-row"><span class="risk-label">驗證過期</span><span class="risk-count">${risks.staleVerificationCount}</span></div>`;
    }
    el.innerHTML = html;
}

function renderVerificationTrend(trend) {
    const el = document.getElementById('verificationTrend');
    if (!el) return;
    if (trend.every(t => t.count === 0)) {
        el.innerHTML = '<div class="sidebar-empty">無驗證趨勢數據</div>';
        return;
    }
    el.innerHTML = trend.map(t => `
        <div class="trend-row">
            <span class="trend-month">${t.month}</span>
            <span class="trend-count">${t.count > 0 ? t.count : '—'}</span>
        </div>
    `).join('');
}

// ===== Chip Dossier Functions (Phase 8) =====

function renderChipOverview(dossier) {
    const el = document.getElementById('chipOverview');
    if (!el) return;
    const specs = dossier.specs;
    el.innerHTML = `
        <div class="info-row"><span>公司：</span><strong><a href="company-signals.html?id=${esc(dossier.companyId)}">${esc(dossier.companyName)}</a></strong></div>
        <div class="info-row"><span>地區：</span><strong>${esc(regionLabel(dossier.region))}</strong></div>
        <div class="info-row"><span>信號總數：</span><strong>${dossier.signalCount}</strong></div>
        <div class="info-row"><span>最新信號：</span><strong>${formatDate(dossier.latestDate)}</strong></div>
        <div class="info-row"><span>最高 ABF 影響：</span><strong>${esc(IMPACT_LABEL[dossier.highestImpact] || '—')}</strong></div>
        ${specs.package_type ? `<div class="info-row"><span>封裝：</span><strong>${esc(specs.package_type)}</strong></div>` : ''}
        ${specs.cowos_required ? `<div class="info-row"><span>CoWoS：</span><strong>是</strong></div>` : ''}
        ${specs.abf_size ? `<div class="info-row"><span>ABF 尺寸：</span><strong>${esc(specs.abf_size)}</strong></div>` : ''}
        ${specs.abf_layers ? `<div class="info-row"><span>ABF 層數：</span><strong>${specs.abf_layers}</strong></div>` : ''}
        ${specs.hbm ? `<div class="info-row"><span>HBM：</span><strong>${esc(specs.hbm)}</strong></div>` : ''}
    `;
}

function renderCompanyContext(ctx) {
    const el = document.getElementById('chipCompanyContext');
    if (!el || !ctx.companyId) return;
    el.innerHTML = `
        <div class="info-row"><span>公司信號總數：</span><strong>${ctx.totalCompanySignals}</strong></div>
        <div class="info-row"><span>其他芯片數：</span><strong>${ctx.otherChipCount}</strong></div>
        <div class="info-row"><span>返回公司：</span><strong><a href="company-signals.html?id=${esc(ctx.companyId)}">${esc(ctx.companyName)} →</a></strong></div>
    `;
}

function renderChipRiskIndicators(risks) {
    const el = document.getElementById('chipRisks');
    if (!el) return;
    if (risks.totalRiskSignals === 0) {
        el.innerHTML = '<div class="sidebar-empty">無風險信號</div>';
        return;
    }
    let html = '';
    if (risks.conflictingEvidenceCount > 0) {
        html += `<div class="risk-row"><span class="risk-label">矛盾證據</span><span class="risk-count">${risks.conflictingEvidenceCount}</span></div>`;
    }
    if (risks.lowConfHighImpactCount > 0) {
        html += `<div class="risk-row"><span class="risk-label">低信度高影響</span><span class="risk-count">${risks.lowConfHighImpactCount}</span></div>`;
    }
    if (risks.staleVerificationCount > 0) {
        html += `<div class="risk-row"><span class="risk-label">驗證過期</span><span class="risk-count">${risks.staleVerificationCount}</span></div>`;
    }
    el.innerHTML = html;
}

// Legacy Company Sidebar Functions (kept for backward compatibility)
function renderRelatedChips(signals) {
    const chips = [...new Set(signals.map(s => s.chip_name).filter(Boolean))].sort();
    const list = document.getElementById('relatedChips');
    if (!list) return;
    list.innerHTML = chips.map(name => `
        <div class="sidebar-item">
            <a href="chip-signals.html?name=${esc(name)}">${esc(name)}</a>
        </div>
    `).join('') || '<div class="sidebar-empty">無</div>';
}

function renderStatusStats(signals) {
    const stats = {};
    signals.forEach(s => {
        stats[s.status] = (stats[s.status] || 0) + 1;
    });
    const list = document.getElementById('statusStats');
    if (!list) return;
    list.innerHTML = Object.entries(stats).map(([status, count]) => `
        <div class="status-stat-row">
            <span class="status-stat-label">${esc(statusLabel(status))}</span>
            <span class="status-stat-value">${count}</span>
        </div>
    `).join('');
}

function renderHighImpactItems(signals) {
    const highImpact = signals.filter(s => s.abf_demand_impact === 'high' || s.abf_demand_impact === 'explosive')
        .sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))
        .slice(0, 5);
    const list = document.getElementById('highImpactItems');
    if (!list) return;
    if (highImpact.length === 0) {
        list.innerHTML = '<div class="sidebar-empty">無高 ABF 影響項目</div>';
        return;
    }
    list.innerHTML = highImpact.map(s => `
        <div class="sidebar-list-item" data-id="${esc(s.id)}">
            <div class="item-title">${esc(s.chip_name)} — ${esc(stageLabel(s.stage))}</div>
            <div class="item-meta">${impactBadge(s.abf_demand_impact)} · 信度 ${s.confidence_score}</div>
        </div>
    `).join('');
    list.querySelectorAll('.sidebar-list-item').forEach(el => {
        el.addEventListener('click', () => {
            const signal = allSignals.find(s => s.id === el.dataset.id);
            if (signal) openDrawer(signal);
        });
    });
}

function renderRecentChanges(signals) {
    const sorted = [...signals].sort((a, b) => new Date(b.last_verified_at || 0) - new Date(a.last_verified_at || 0)).slice(0, 5);
    const list = document.getElementById('recentChanges');
    if (!list) return;
    list.innerHTML = sorted.map(s => `
        <div class="sidebar-list-item" data-id="${esc(s.id)}">
            <div class="item-meta">${formatDate(s.last_verified_at)}</div>
            <div class="item-title">${esc(s.title)}</div>
        </div>
    `).join('');
    list.querySelectorAll('.sidebar-list-item').forEach(el => {
        el.addEventListener('click', () => {
            const signal = allSignals.find(s => s.id === el.dataset.id);
            if (signal) openDrawer(signal);
        });
    });
}

// Chip Sidebar Functions
function renderChipInfo(signal) {
    const list = document.getElementById('chipInfo');
    if (!list) return;
    list.innerHTML = `
        <div class="info-row"><span>封裝：</span><strong>${esc(signal.package_type || '—')}</strong></div>
        <div class="info-row"><span>CoWoS：</span><strong>${signal.cowos_required ? '是' : '否'}</strong></div>
        <div class="info-row"><span>ABF 尺寸：</span><strong>${esc(signal.abf_size || '—')}</strong></div>
        <div class="info-row"><span>ABF 層數：</span><strong>${signal.abf_layers || '—'}</strong></div>
    `;
}

function renderChipRecentChanges(signals) {
    // Sort by last_status_changed_at when present, fall back to last_verified_at
    const sorted = [...signals].sort((a, b) => {
        const dateA = a.last_status_changed_at || a.last_verified_at || '';
        const dateB = b.last_status_changed_at || b.last_verified_at || '';
        return new Date(dateB || 0) - new Date(dateA || 0);
    }).slice(0, 5);
    const list = document.getElementById('chipRecentChanges');
    if (!list) return;
    if (sorted.length === 0) {
        list.innerHTML = '<div class="sidebar-empty">尚無最近變更</div>';
        return;
    }
    list.innerHTML = sorted.map(s => {
        const changeDate = s.last_status_changed_at || s.last_verified_at;
        return `
            <div class="sidebar-list-item" data-id="${esc(s.id)}">
                <div class="item-meta">${formatDate(changeDate)}</div>
                <div class="item-title">${esc(s.title)}</div>
            </div>
        `;
    }).join('');
    list.querySelectorAll('.sidebar-list-item').forEach(el => {
        el.addEventListener('click', () => {
            const signal = allSignals.find(s => s.id === el.dataset.id);
            if (signal) openDrawer(signal);
        });
    });
}

function renderVerificationTimeline(signals) {
    const sorted = [...signals].sort((a, b) => new Date(b.last_verified_at || 0) - new Date(a.last_verified_at || 0));
    const list = document.getElementById('verificationTimeline');
    if (!list) return;
    list.innerHTML = sorted.map(s => `
        <div class="timeline-event">
            <div class="event-date">${formatDate(s.last_verified_at)}</div>
            <div class="event-status"><span class="signal-status-chip ${statusChipClass(s.status)}">${esc(statusLabel(s.status))}</span></div>
            <div class="event-title">${esc(s.title)}</div>
        </div>
    `).join('');
}

function renderSiblingChips(siblings) {
    const list = document.getElementById('siblingChips');
    if (!list) return;
    if (!siblings || siblings.length === 0) {
        list.innerHTML = '<div class="sidebar-empty">無</div>';
        return;
    }
    list.innerHTML = siblings.map(s => `
        <div class="sidebar-list-item" data-chip="${esc(s.chipName)}">
            <div class="item-title"><a href="chip-signals.html?name=${esc(s.chipName)}">${esc(s.chipName)}</a></div>
            <div class="item-meta">${s.signalCount} 信號</div>
        </div>
    `).join('');
    list.querySelectorAll('.sidebar-list-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const chip = el.dataset.chip;
            window.location.href = `chip-signals.html?name=${encodeURIComponent(chip)}`;
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

// ===== Detail Drawer (Reused) =====

function openDrawer(signal) {
    const overlay = document.getElementById('drawerOverlay');
    const title = document.getElementById('drawerTitle');
    const body = document.getElementById('drawerBody');
    if (!overlay || !title || !body) return;

    title.textContent = signal.title;
    
    // Minimal version for entity pages
    let html = `
        <div class="drawer-section">
            <h3 class="drawer-section-title">信號詳情</h3>
            <div class="drawer-field"><span class="drawer-field-label">狀態</span><span class="signal-status-chip ${statusChipClass(signal.status)}">${esc(statusLabel(signal.status))}</span></div>
            <div class="drawer-field"><span class="drawer-field-label">信度</span><span>${confidenceBar(signal.confidence_score)}</span></div>
            <div class="drawer-field"><span class="drawer-field-label">最後驗證</span><span>${formatDate(signal.last_verified_at)}</span></div>
        </div>
        <div class="drawer-section">
            <h3 class="drawer-section-title">證據摘要</h3>
            <p class="drawer-text">${esc(signal.evidence_summary || '無')}</p>
        </div>
    `;

    body.innerHTML = html;
    overlay.style.display = 'flex';
}

function bindEvents() {
    const watchBtn = document.getElementById('entityWatchBtn');
    if (watchBtn) {
        watchBtn.addEventListener('click', () => {
            const active = entityType === 'company' 
                ? toggleWatchCompany(entityId)
                : toggleWatchChip(entityId);
            
            watchBtn.innerHTML = `${active ? '&#9733;' : '&#9734;'} ${active ? (entityType === 'company' ? '取消關注' : '取消關注') : (entityType === 'company' ? '關注公司' : '關注芯片')}`;
            watchBtn.classList.toggle('active', active);
        });
    }

    const closeBtn = document.getElementById('drawerClose');
    const overlay = document.getElementById('drawerOverlay');
    if (closeBtn) closeBtn.addEventListener('click', () => overlay.style.display = 'none');
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
}
