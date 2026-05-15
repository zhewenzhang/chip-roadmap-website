/**
 * Signal detail page — Phase 29
 * URL: signal.html?id=<firestore_doc_id>
 */
import { getSignal, loadSignals, loadCompanies } from '../firebase/db.js';
import { STAGE_LABEL, STATUS_LABEL, IMPACT_LABEL, IMPACT_RELATION_LABEL, REGION_LABEL } from './signals-schema.js';
import { renderCrumb } from './global-crumb.js';

function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relativeTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function renderHero(signal) {
    return `<header class="signal-hero">
        <h1 class="signal-hero-title">${esc(signal.title)}</h1>
        <div class="signal-hero-badges">
            <span class="badge badge-impact-${signal.abf_demand_impact}">${esc(IMPACT_LABEL[signal.abf_demand_impact])}</span>
            <span class="badge badge-stage-${signal.stage}">${esc(STAGE_LABEL[signal.stage])}</span>
            <span class="badge badge-status-${signal.status}">${esc(STATUS_LABEL[signal.status])}</span>
            <span class="badge badge-confidence">confidence ${signal.confidence_score}</span>
        </div>
        <div class="signal-hero-meta">
            ${[signal.release_year && signal.release_quarter ? `${signal.release_year} ${signal.release_quarter}` : null,
               signal.package_type, signal.abf_layers ? `${signal.abf_layers}L ABF` : null,
               signal.hbm, signal.expected_volume ? `${signal.expected_volume} volume` : null]
                .filter(Boolean).map(s => esc(s)).join(' · ')}
        </div>
    </header>`;
}

function renderFacts(signal, companies) {
    const company = companies[signal.company_id];
    const companyName = company?.name_en || signal.company_name || signal.company_id;
    const rows = [
        ['Title', esc(signal.title)],
        ['Company', `<a class="entity-link entity-company" href="company.html?id=${signal.company_id}"><span class="entity-icon"></span>${esc(companyName)}</a>`],
        ['Chip', `<a class="entity-link entity-chip" href="chip.html?name=${encodeURIComponent(signal.chip_name)}"><span class="entity-icon"></span>${esc(signal.chip_name)}</a>`],
        ['Stage', `<span class="badge badge-stage-${signal.stage}">${esc(STAGE_LABEL[signal.stage])}</span>`],
        ['Status', `<span class="badge badge-status-${signal.status}">${esc(STATUS_LABEL[signal.status])}</span>`],
        ['Release', signal.release_year ? `${signal.release_year} ${signal.release_quarter || ''}` : '—'],
        ['Package', esc(signal.package_type || '—')],
        ['ABF Layers', signal.abf_layers ? `${signal.abf_layers}L` : '—'],
        ['HBM', esc(signal.hbm || '—')],
        ['Expected Volume', esc(signal.expected_volume || '—')],
        ['Region', esc(REGION_LABEL[signal.region] || signal.region || '—')],
        ['Confidence', `${signal.confidence_score} ${signal.confidence_reason ? '· ' + esc(signal.confidence_reason) : ''}`],
        ['Last Verified', relativeTime(signal.last_verified_at)],
        ['Sources', (signal.sources || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:var(--fg);margin-right:0.5rem">${esc(s.label || s.url)}</a>`).join('') || '—'],
    ];

    return `<section class="section">
        <div class="section-title-bar"><h3 class="section-title">A. 信號事實</h3></div>
        <div class="section-body">
            <div class="kv-table">
                ${rows.map(([k, v]) => `<div class="kv-table-row"><div class="kv-table-label">${k}</div><div class="kv-table-value">${v}</div></div>`).join('')}
            </div>
        </div>
    </section>`;
}

function renderImpactTree(signal, companies) {
    const entities = signal.impact_entities || [];
    if (entities.length === 0) {
        return `<section class="section">
            <div class="section-title-bar"><h3 class="section-title">B. 影響鋪開</h3></div>
            <div class="section-body">
                <div class="impact-tree">
                    <div class="impact-tree-empty">暫無影響分析。可在 Admin 後台補充。</div>
                </div>
            </div>
        </section>`;
    }

    const root = `[ ${esc(signal.chip_name)} ${esc(STAGE_LABEL[signal.stage])} ]`;
    const branches = entities.map((e, i) => {
        const isLast = i === entities.length - 1;
        const company = companies[e.company_id];
        const name = company?.name_en || e.company_id;
        const relCls = `impact-tree-relation impact-tree-relation-${e.relation}`;
        const relLabel = IMPACT_RELATION_LABEL[e.relation] || e.relation;
        return `<div class="impact-tree-branch">
            <span class="impact-tree-connector">${isLast ? '└──→' : '├──→'}</span>
            <a class="impact-tree-target entity-link entity-company" href="company.html?id=${e.company_id}"><span class="entity-icon"></span>${esc(name)}</a>
            <span class="impact-tree-reason">${esc(e.reason || '')}</span>
            <span class="${relCls}">[${esc(relLabel)}]</span>
        </div>`;
    }).join('');

    return `<section class="section">
        <div class="section-title-bar"><h3 class="section-title">B. 影響鋪開</h3></div>
        <div class="section-body">
            <div class="impact-tree">
                <div class="impact-tree-root">${root}</div>
                <div class="impact-tree-branches">${branches}</div>
            </div>
        </div>
    </section>`;
}

function renderEvidence(signal) {
    return `<section class="section">
        <div class="section-title-bar"><h3 class="section-title">C. 證據摘要</h3></div>
        <div class="section-body">
            <p style="line-height:1.7;color:var(--fg-dim)">${esc(signal.evidence_summary || '（無）')}</p>
            ${signal.conflicting_evidence ? `<p style="margin-top:1rem;padding-top:1rem;border-top:1px dashed var(--border);color:var(--accent)"><strong>衝突證據：</strong>${esc(signal.conflicting_evidence)}</p>` : ''}
        </div>
    </section>`;
}

function renderRelated(signal, allSignals, companies) {
    const others = allSignals.filter(s => s.id !== signal.id);
    const sameCompany = others.filter(s => s.company_id === signal.company_id).slice(0, 3);
    const sameChip = others.filter(s => s.chip_name === signal.chip_name && s.company_id !== signal.company_id).slice(0, 3);
    const sameImpact = others.filter(s => s.abf_demand_impact === signal.abf_demand_impact
        && s.company_id !== signal.company_id && s.chip_name !== signal.chip_name).slice(0, 3);

    const sections = [];
    if (sameCompany.length) sections.push({ title: '同公司其他信號', items: sameCompany });
    if (sameChip.length) sections.push({ title: '同芯片相關信號', items: sameChip });
    if (sameImpact.length) sections.push({ title: '同影響等級', items: sameImpact });

    if (!sections.length) return '';

    return `<section class="section">
        <div class="section-title-bar"><h3 class="section-title">D. 相關信號</h3></div>
        <div class="section-body">
            ${sections.map(sec => `
                <div style="margin-bottom:1rem">
                    <div style="font-size:var(--t-xs);color:var(--fg-muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem">${sec.title}</div>
                    ${sec.items.map(s => `<a href="signal.html?id=${encodeURIComponent(s.id)}" style="display:block;padding:0.25rem 0;color:var(--fg);text-decoration:none;font-size:var(--t-sm)">▸ ${esc(s.title)}</a>`).join('')}
                </div>
            `).join('')}
        </div>
    </section>`;
}

function renderHistory(signal) {
    return `<section class="section">
        <div class="section-title-bar"><h3 class="section-title">E. 信號歷史</h3></div>
        <div class="section-body" style="font-size:var(--t-xs);color:var(--fg-muted)">
            ${signal.createdAt ? `<div>${relativeTime(signal.createdAt)}  created</div>` : ''}
            ${signal.last_status_changed_at ? `<div>${relativeTime(signal.last_status_changed_at)}  status → ${esc(STATUS_LABEL[signal.status])}</div>` : ''}
            ${signal.last_verified_at ? `<div>${relativeTime(signal.last_verified_at)}  verified ${signal.last_verified_by ? '(by ' + esc(signal.last_verified_by) + ')' : ''}</div>` : ''}
        </div>
    </section>`;
}

function renderNextStep(signal, companies) {
    const company = companies[signal.company_id];
    const companyName = company?.name_en || signal.company_id;
    return `<section class="section">
        <div class="section-title-bar"><h3 class="section-title">下一步</h3></div>
        <div class="section-body">
            <a href="company.html?id=${signal.company_id}" style="display:block;padding:0.5rem 0;color:var(--fg);text-decoration:none">→ 看 ${esc(companyName)} 的其他信號</a>
            <a href="chip.html?name=${encodeURIComponent(signal.chip_name)}" style="display:block;padding:0.5rem 0;color:var(--fg);text-decoration:none">→ 看 ${esc(signal.chip_name)} 的完整路徑</a>
            <a href="index.html?impact=${signal.abf_demand_impact}" style="display:block;padding:0.5rem 0;color:var(--fg);text-decoration:none">→ 看所有 ${esc(IMPACT_LABEL[signal.abf_demand_impact])} 影響信號</a>
        </div>
    </section>`;
}

async function init() {
    const id = getQueryParam('id');
    const root = document.getElementById('signalDetailRoot');

    if (!id) {
        root.innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">⚠</div>
            <div class="empty-state-title">缺少信號 ID</div>
            <div class="empty-state-sub">URL 應為 signal.html?id=xxx</div>
            <a class="empty-state-cta" href="index.html">回信號流</a>
        </div>`;
        return;
    }

    renderCrumb('信號流');

    try {
        const [signal, allResult, cMap] = await Promise.all([
            getSignal(id),
            loadSignals(),
            loadCompanies()
        ]);

        if (!signal) {
            root.innerHTML = `<div class="empty-state">
                <div class="empty-state-icon">404</div>
                <div class="empty-state-title">找不到該信號</div>
                <a class="empty-state-cta" href="index.html">回信號流</a>
            </div>`;
            return;
        }

        const allSignals = allResult.ok ? allResult.data : [];
        document.title = `${signal.title} — 芯片情報`;

        root.innerHTML = `
            ${renderHero(signal)}
            ${renderFacts(signal, cMap)}
            ${renderImpactTree(signal, cMap)}
            ${renderEvidence(signal)}
            ${renderRelated(signal, allSignals, cMap)}
            ${renderHistory(signal)}
            ${renderNextStep(signal, cMap)}
        `;
    } catch (err) {
        console.error('[SignalDetail] error:', err);
        root.innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">⚠</div>
            <div class="empty-state-title">載入錯誤</div>
            <div class="empty-state-sub">${esc(err.message)}</div>
        </div>`;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
