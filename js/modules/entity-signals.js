/**
 * Entity Signals Module — Phase 9 (Impact Engine + Entity-Centered Intelligence)
 * Handles the logic for company and chip intelligence pages.
 * Uses entity-intelligence.js for dossier derivation.
 * Uses impact-engine.js for chip-to-ABF impact derivation.
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
    getSiblingChips, getEntityRiskIndicators, getVerificationTrend,
    getRelatedCompanies
} from './entity-intelligence.js';
import {
    deriveChipImpact, deriveCompanyAbfOutlook,
    isImpactDerivable
} from './impact-engine.js';
import {
    buildSignalChangeFeed, buildChipImpactChangeFeed, buildCompanyOutlookChangeFeed,
    buildPriorityQueue, CHANGE_TYPES
} from './change-intelligence.js';

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

function sourceBadge(signal) {
    if (signal.ai_generated) {
        return '<span class="source-badge source-badge-ai">AI</span>';
    }
    if (signal.source_type === 'imported') {
        return '<span class="source-badge source-badge-imported">匯入</span>';
    }
    return '';
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
        // Render impact headers even for empty entities
        if (type === 'company') renderCompanyAbfHeader([], allSignals);
        else renderChipImpactHeader([], allSignals);
        renderSidebar(filtered, allSignals);
        bindEvents();
        return;
    }

    renderEntityInfo(filtered);

    // Phase 9: Render impact headers
    if (type === 'company') renderCompanyAbfHeader(filtered, allSignals);
    else renderChipImpactHeader(filtered, allSignals);

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
            <td>${esc(s.title)} ${sourceBadge(s)}</td>
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

// ===== Phase 9: Impact Header Rendering =====

const STAGE_LABELS_MAP = { pilot: '試產', ramp: '爬坡', volume: '量產', design_win: '設計獲勝', sampling: '送樣', announced: '宣布', rumor: '傳聞' };
const VOLUME_LABELS_MAP = { low: '低', medium: '中', high: '高' };

/**
 * Render chip-level impact header on chip-signals.html
 */
function renderChipImpactHeader(signals, allSigs) {
    const container = document.getElementById('chipImpactHeader');
    if (!container) return;

    const impact = deriveChipImpact(entityId, allSigs);

    if (impact.insufficientData) {
        container.style.display = 'block';
        container.innerHTML = `<div class="impact-header-title">影響摘要</div>
            <p style="color:var(--color-muted-fg);font-style:italic;font-size:0.85rem">尚無足夠驗證信號可推導影響</p>`;
        return;
    }

    // Build impact badge class
    const impactCls = impact.abfDemandImpact === 'explosive' ? 'impact-explosive'
        : impact.abfDemandImpact === 'high' ? 'impact-high'
        : impact.abfDemandImpact === 'medium' ? 'impact-medium' : 'impact-low';

    let html = `<div class="impact-header-title">影響摘要 — ${esc(impact.chipName)}</div>`;

    // Main row: badge + confidence
    html += `<div class="impact-main-row">
        <span class="impact-badge ${impactCls}">${esc(IMPACT_LABEL[impact.abfDemandImpact] || impact.abfDemandImpact)}</span>
        <span class="impact-confidence">推導信度: ${impact.derivedConfidence ?? '—'}</span>
    </div>`;

    // Fields grid
    html += '<div class="impact-fields-grid">';

    // ABF Size
    if (impact.abfSize.value) {
        const conflictNote = impact.abfSize.conflicting ? `<span class="field-conflict">（信號間不一致）</span>` : '';
        html += `<div class="impact-field-row"><span class="field-label">ABF Size</span><span class="field-value">${esc(impact.abfSize.value)}${conflictNote}</span></div>`;
    }

    // ABF Layers
    if (impact.abfLayers.value != null) {
        const conflictNote = impact.abfLayers.range ? `<span class="field-conflict">（${impact.abfLayers.range[0]} ~ ${impact.abfLayers.range[1]}）</span>` : '';
        html += `<div class="impact-field-row"><span class="field-label">ABF 層數</span><span class="field-value">${impact.abfLayers.value}${conflictNote}</span></div>`;
    }

    // CoWoS
    html += `<div class="impact-field-row"><span class="field-label">CoWoS</span><span class="field-value">${impact.cowosDependency}</span></div>`;

    // HBM
    if (impact.hbm.value) html += `<div class="impact-field-row"><span class="field-label">HBM</span><span class="field-value">${esc(impact.hbm.value)}</span></div>`;

    // Volume
    if (impact.volumeOutlook.value) html += `<div class="impact-field-row"><span class="field-label">Volume</span><span class="field-value">${esc(VOLUME_LABELS_MAP[impact.volumeOutlook.value] || impact.volumeOutlook.value)}</span></div>`;

    // Stage
    html += `<div class="impact-field-row"><span class="field-label">Stage</span><span class="field-value">${esc(STAGE_LABELS_MAP[impact.stageOutlook] || impact.stageOutlook)}</span></div>`;

    html += '</div>'; // end fields grid

    // Source line
    html += `<div class="impact-source-line">推導依據: ${impact.verifiedCount} 條 verified、${impact.watchCount} 條 watch</div>`;

    // Driving evidence panel
    html += renderEvidencePanel(impact.drivingSignals, impact.conflictingSignals);

    container.innerHTML = html;
    container.style.display = 'block';

    // Bind evidence item clicks
    container.querySelectorAll('.evidence-item, .evidence-conflict-item').forEach(el => {
        el.addEventListener('click', () => {
            const signal = allSigs.find(s => s.id === el.dataset.signalId);
            if (signal) openDrawer(signal);
        });
    });
}

/**
 * Render company-level ABF outlook header on company-signals.html
 */
function renderCompanyAbfHeader(signals, allSigs) {
    const container = document.getElementById('companyAbfHeader');
    if (!container) return;

    const outlook = deriveCompanyAbfOutlook(entityId, allSigs);

    if (outlook.insufficientData) {
        container.style.display = 'block';
        container.innerHTML = `<div class="impact-header-title">公司 ABF 展望</div>
            <p style="color:var(--color-muted-fg);font-style:italic;font-size:0.85rem">尚無足夠驗證信號可推導 ABF 展望</p>`;
        return;
    }

    const impactCls = outlook.overallImpact === 'explosive' ? 'impact-explosive'
        : outlook.overallImpact === 'high' ? 'impact-high'
        : outlook.overallImpact === 'medium' ? 'impact-medium' : 'impact-low';

    let html = `<div class="impact-header-title">${esc(outlook.companyName)} — ABF 需求展望</div>`;

    // Main row
    html += `<div class="impact-main-row">
        <span class="impact-badge ${impactCls}">${esc(IMPACT_LABEL[outlook.overallImpact] || outlook.overallImpact)}</span>
    </div>`;

    // Fields grid
    html += '<div class="impact-fields-grid">';

    html += `<div class="impact-field-row"><span class="field-label">CoWoS 依賴芯片</span><span class="field-value">${outlook.cowosChipCount}</span></div>`;
    html += `<div class="impact-field-row"><span class="field-label">進階階段芯片</span><span class="field-value">${outlook.advancedChipCount}</span></div>`;

    if (outlook.abfLayerRange) {
        html += `<div class="impact-field-row"><span class="field-label">ABF 層數範圍</span><span class="field-value">${outlook.abfLayerRange[0]} ~ ${outlook.abfLayerRange[1]}</span></div>`;
    }

    html += '</div>';

    // Top chips
    if (outlook.topChips.length > 0) {
        html += `<div class="impact-source-line">Top 影響芯片: ${outlook.topChips.map(c =>
            `<a href="chip-signals.html?name=${encodeURIComponent(c.chipName)}">${esc(c.chipName)}</a>`
        ).join(' / ')}</div>`;
    }

    // Derivation basis line
    const chipCount = outlook.chipImpacts ? outlook.chipImpacts.filter(c => !c.insufficientData).length : 0;
    html += `<div class="impact-source-line">推導依據: ${chipCount} 款芯片可推導影響</div>`;

    container.innerHTML = html;
    container.style.display = 'block';
}

/**
 * Render driving evidence panel (shared between chip and company)
 */
function renderEvidencePanel(drivingSignals, conflictingSignals) {
    const hasDriving = drivingSignals && drivingSignals.length > 0;
    const hasConflicts = conflictingSignals && conflictingSignals.length > 0;
    if (!hasDriving && !hasConflicts) return '';

    let html = '<div class="impact-evidence-panel">';

    // Driving signals section
    if (hasDriving) {
        html += `<div class="evidence-section-title">驅動信號 (${drivingSignals.length})</div>`;
        html += '<div class="evidence-list">';

        for (const ds of drivingSignals) {
            const statusCls = ds.status === 'verified' ? 'signal-status-verified'
                : ds.status === 'watch' ? 'signal-status-watch' : '';
            html += `<div class="evidence-item" data-signal-id="${esc(ds.id)}">
                <span class="evidence-date">${formatDate(ds.last_verified_at)}</span>
                <span class="evidence-status ${statusCls}">${esc(statusLabel(ds.status))}</span>
                <span class="evidence-confidence">${ds.confidence}</span>
                <span class="evidence-reason">${esc(stageLabel(ds.stage))} · 貢獻 ${ds.contribution > 0 ? ds.contribution.toFixed(1) : '0'}</span>
            </div>`;
        }

        html += '</div>';
    }

    // Conflicting signals section — render even if no driving signals
    if (hasConflicts) {
        html += `<div class="evidence-section-title"${hasDriving ? ' style="margin-top:16px"' : ''}>矛盾信號 (${conflictingSignals.length})</div>`;
        html += '<div class="evidence-list">';

        for (const cs of conflictingSignals) {
            html += `<div class="evidence-conflict-item" data-signal-id="${esc(cs.id)}">
                <span class="evidence-reason">${esc(cs.reason)}</span>
            </div>`;
        }

        html += '</div>';
    }

    html += '</div>';
    return html;
}

function renderSidebar(signals, allSigs) {
    if (entityType === 'company') {
        const dossier = buildCompanyDossier(entityId, allSigs);
        renderCompanyOverview(dossier);
        renderChipPortfolio(dossier.portfolio);
        renderStatusStats(signals);
        renderRiskIndicators(dossier.risks);
        renderVerificationTrend(dossier.trend);
        renderRelatedCompanies(entityId, allSigs);
        renderHighImpactItems(signals);
        renderRecentChanges(signals);
        renderCompanyChangeSummary(entityId, signals, allSigs);
    } else {
        const dossier = buildChipDossier(entityId, allSigs);
        renderChipOverview(dossier);
        renderCompanyContext(dossier.companyContext);
        renderSiblingChips(dossier.siblings);
        renderChipRiskIndicators(dossier.risks);
        renderChipRecentChanges(signals);
        renderVerificationTimeline(signals);
        renderChipImpactChanges(entityId, signals, allSigs);
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
    const block = el.closest('.sidebar-block');
    if (block) block.style.display = portfolio.length === 0 ? 'none' : '';
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
    const block = el.closest('.sidebar-block');
    if (block) block.style.display = risks.totalRiskSignals === 0 ? 'none' : '';
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
    const block = el.closest('.sidebar-block');
    if (block) block.style.display = trend.every(t => t.count === 0) ? 'none' : '';
}

function renderRelatedCompanies(companyId, signals) {
    const el = document.getElementById('relatedCompanies');
    if (!el) return;
    const block = el.closest('.sidebar-block');
    const related = getRelatedCompanies(companyId, signals, 5);
    if (related.length === 0) {
        if (block) block.style.display = 'none';
        return;
    }
    if (block) block.style.display = '';
    el.innerHTML = related.map(c => `
        <div class="sidebar-list-item" data-company="${esc(c.companyId)}">
            <div class="item-title"><a href="company-signals.html?id=${esc(c.companyId)}">${esc(c.companyName)}</a></div>
            <div class="item-meta">${c.overlapCount} 共享芯片 · ${c.signalCount} 信號</div>
        </div>
    `).join('');
    el.querySelectorAll('.sidebar-list-item').forEach(el2 => {
        el2.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const cid = el2.dataset.company;
            window.location.href = `company-signals.html?id=${encodeURIComponent(cid)}`;
        });
    });
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
    const block = list.closest('.sidebar-block');
    if (highImpact.length === 0) {
        if (block) block.style.display = 'none';
        return;
    }
    if (block) block.style.display = '';
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
    const block = list.closest('.sidebar-block');
    if (sorted.length === 0) {
        if (block) block.style.display = 'none';
        return;
    }
    if (block) block.style.display = '';
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

// ===== Phase 10: Entity Change Summary Blocks =====

/**
 * Render company-level change summary in the sidebar.
 * Shows: recent impact shifts, verified upgrades, new risk items.
 */
function renderCompanyChangeSummary(companyId, signals, allSigs) {
    const el = document.getElementById('companyChangeSummary');
    if (!el) return;
    const block = el.closest('.sidebar-block');

    const companySignals = signals.filter(s => s.company_id === companyId);
    if (companySignals.length === 0) {
        if (block) block.style.display = 'none';
        return;
    }

    // Build change feed for this company
    const changes = buildSignalChangeFeed(allSigs, [], { feedDays: 30 })
        .filter(c => c.companyId === companyId)
        .slice(0, 5);

    // Also check for chip impact changes
    const chipChanges = buildChipImpactChangeFeed(allSigs, { feedDays: 30 })
        .filter(c => c.companyId === companyId)
        .slice(0, 3);

    const allChanges = [...changes, ...chipChanges]
        .sort((a, b) => new Date(b.changeDate || 0) - new Date(a.changeDate || 0))
        .slice(0, 6);

    if (allChanges.length === 0) {
        if (block) block.style.display = 'none';
        return;
    }
    if (block) block.style.display = '';

    const typeLabel = {
        [CHANGE_TYPES.STATUS_UPGRADED]: '升級',
        [CHANGE_TYPES.STATUS_DOWNGRADED]: '降級',
        [CHANGE_TYPES.CONFIDENCE_MAJOR_CHANGE]: '信度變更',
        [CHANGE_TYPES.NEW_HIGH_IMPACT_SIGNAL]: '新高影響',
        [CHANGE_TYPES.NEW_CONFLICT]: '新衝突',
        [CHANGE_TYPES.STALE_VERIFIED_SIGNAL]: '驗證過期',
        [CHANGE_TYPES.IMPACT_DERIVATION_CHANGED]: '影響變更',
    };

    el.innerHTML = allChanges.map(c => {
        const label = typeLabel[c.type] || c.type;
        const dateStr = c.changeDate ? new Date(c.changeDate).toISOString().slice(0, 10) : '';
        const chipRef = c.chipName
            ? `<a href="chip-signals.html?name=${encodeURIComponent(c.chipName)}">${esc(c.chipName)}</a>`
            : '';
        return `<div class="sidebar-list-item" ${c.signalId ? `data-signal-id="${esc(c.signalId)}"` : ''}>
            <div class="item-title"><span class="change-type-tag">${esc(label)}</span> ${chipRef || esc(c.companyName || '')}</div>
            <div class="item-meta">${dateStr} · ${(c.reasons || []).slice(0, 2).map(esc).join(' · ')}</div>
        </div>`;
    }).join('');

    // Bind click handlers for signal items
    el.querySelectorAll('.sidebar-list-item[data-signal-id]').forEach(itemEl => {
        itemEl.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const signal = allSigs.find(s => s.id === itemEl.dataset.signalId);
            if (signal) openDrawer(signal);
        });
    });
}

/**
 * Render chip-level impact change summary in the sidebar.
 * Shows: recent status change, confidence change, impact shift, conflict.
 */
function renderChipImpactChanges(chipName, signals, allSigs) {
    const el = document.getElementById('chipImpactChanges');
    if (!el) return;

    const chipSignals = signals.filter(s => s.chip_name === chipName);
    if (chipSignals.length === 0) {
        el.innerHTML = '<div class="sidebar-empty">無變更數據</div>';
        return;
    }

    const changes = buildSignalChangeFeed(allSigs, [], { feedDays: 30 })
        .filter(c => c.chipName === chipName)
        .slice(0, 5);

    if (changes.length === 0) {
        el.innerHTML = '<div class="sidebar-empty">近期無重大變更</div>';
        return;
    }

    const typeLabel = {
        [CHANGE_TYPES.STATUS_UPGRADED]: '升級',
        [CHANGE_TYPES.STATUS_DOWNGRADED]: '降級',
        [CHANGE_TYPES.CONFIDENCE_MAJOR_CHANGE]: '信度變更',
        [CHANGE_TYPES.NEW_HIGH_IMPACT_SIGNAL]: '新高影響',
        [CHANGE_TYPES.NEW_CONFLICT]: '新衝突',
        [CHANGE_TYPES.STALE_VERIFIED_SIGNAL]: '驗證過期',
    };

    el.innerHTML = changes.map(c => {
        const label = typeLabel[c.type] || c.type;
        const dateStr = c.changeDate ? new Date(c.changeDate).toISOString().slice(0, 10) : '';
        return `<div class="sidebar-list-item" ${c.signalId ? `data-signal-id="${esc(c.signalId)}"` : ''}>
            <div class="item-title"><span class="change-type-tag">${esc(label)}</span> ${esc(c.reasons?.[0] || '')}</div>
            <div class="item-meta">${dateStr}</div>
        </div>`;
    }).join('');

    el.querySelectorAll('.sidebar-list-item[data-signal-id]').forEach(itemEl => {
        itemEl.addEventListener('click', () => {
            const signal = allSigs.find(s => s.id === itemEl.dataset.signalId);
            if (signal) openDrawer(signal);
        });
    });
}

// ===== Detail Drawer (Reused) =====

function openDrawer(signal) {
    const overlay = document.getElementById('drawerOverlay');
    const title = document.getElementById('drawerTitle');
    const body = document.getElementById('drawerBody');
    if (!overlay || !title || !body) return;

    title.innerHTML = esc(signal.title) + sourceBadge(signal);
    
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
