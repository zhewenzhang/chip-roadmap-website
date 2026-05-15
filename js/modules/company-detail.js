import { getCompanyDoc, loadSignals } from '../firebase/db.js';
import { STAGE_LABEL, IMPACT_LABEL, REGION_LABEL } from './signals-schema.js';
import { renderCrumb } from './global-crumb.js';

function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getId() {
    return new URLSearchParams(window.location.search).get('id');
}

function renderHeader(c) {
    return `<header class="page-head">
        <div class="page-head-inner">
            <div class="page-head-eyebrow">COMPANY / ${esc((c.region || c.country || 'GLOBAL').toUpperCase())}</div>
            <h1 class="page-head-title">◆ ${esc(c.name_en || c.id)}</h1>
            <p class="page-head-meta">${[c.name_cn, c.category, esc(REGION_LABEL[c.country] || c.country)].filter(Boolean).join(' · ')}</p>
        </div>
    </header>`;
}

function renderOverview(c) {
    const rows = [
        ['Founded', c.founded || '—'],
        ['HQ', c.headquarters || '—'],
        ['Market Cap', c.market_cap || '—'],
        ['Category', c.category || '—'],
        ['Region', REGION_LABEL[c.country] || c.country || '—'],
        ['Foundry', c.foundry || '—'],
    ];
    return `<section class="section">
        <div class="section-title-bar"><h3 class="section-title">公司概覽</h3></div>
        <div class="section-body">
            <div class="kv-table">${rows.map(([k, v]) => `<div class="kv-table-row"><div class="kv-table-label">${k}</div><div class="kv-table-value">${esc(v)}</div></div>`).join('')}</div>
            ${c.description ? `<p style="margin-top:1rem;line-height:1.7;color:var(--fg-dim)">${esc(c.description)}</p>` : ''}
            ${c.market_position ? `<p style="margin-top:0.5rem;font-size:var(--t-sm);color:var(--fg-muted);font-style:italic">${esc(c.market_position)}</p>` : ''}
        </div>
    </section>`;
}

function renderSignalCard(s) {
    return `<a href="signal.html?id=${encodeURIComponent(s.id)}" class="signal-card" style="text-decoration:none;color:inherit;display:block">
        <div class="signal-card-badges">
            <span class="badge badge-impact-${s.abf_demand_impact}">${esc(IMPACT_LABEL[s.abf_demand_impact])}</span>
            <span class="badge badge-stage-${s.stage}">${esc(STAGE_LABEL[s.stage])}</span>
        </div>
        <h3 class="signal-card-title">${esc(s.title)}</h3>
        <div class="signal-card-meta"><span>${esc(s.chip_name)}</span>${s.release_year ? `<span>${s.release_year} ${s.release_quarter || ''}</span>` : ''}</div>
        <div class="signal-card-body">${esc(s.evidence_summary || '')}</div>
    </a>`;
}

function renderSignals(signals) {
    if (!signals.length) return `<section class="section">
        <div class="section-title-bar"><h3 class="section-title">最近信號</h3></div>
        <div class="section-body"><div class="empty-state-sub">該公司暫無收錄信號</div></div>
    </section>`;
    return `<section class="section">
        <div class="section-title-bar">
            <h3 class="section-title">最近信號 (${signals.length})</h3>
            <a class="section-action" href="index.html?company=${signals[0].company_id}">全部 →</a>
        </div>
        <div class="section-body">${signals.slice(0, 5).map(renderSignalCard).join('')}</div>
    </section>`;
}

function renderChips(signals) {
    const chips = {};
    signals.forEach(s => {
        if (!s.chip_name) return;
        if (!chips[s.chip_name]) chips[s.chip_name] = { name: s.chip_name, signals: [], maxImpact: s.abf_demand_impact };
        chips[s.chip_name].signals.push(s);
        const order = { explosive: 4, high: 3, medium: 2, low: 1 };
        if ((order[s.abf_demand_impact] || 0) > (order[chips[s.chip_name].maxImpact] || 0)) {
            chips[s.chip_name].maxImpact = s.abf_demand_impact;
        }
    });
    const list = Object.values(chips);
    if (!list.length) return '';
    return `<section class="section">
        <div class="section-title-bar"><h3 class="section-title">芯片組合</h3></div>
        <div class="section-body">
            ${list.map(c => `<a class="entity-link entity-chip" href="chip.html?name=${encodeURIComponent(c.name)}" style="display:block;padding:0.5rem 0;border-bottom:1px solid var(--border)">
                <span class="entity-icon"></span> ${esc(c.name)}
                <span style="float:right;font-size:var(--t-xs)"><span class="badge badge-impact-${c.maxImpact}">${esc(IMPACT_LABEL[c.maxImpact])}</span> · ${c.signals.length} 信號</span>
            </a>`).join('')}
        </div>
    </section>`;
}

function renderSwot(c) {
    const a = c.analysis;
    if (!a || (!a.strengths?.length && !a.weaknesses?.length)) return '';
    const group = (title, items, cls) => items?.length
        ? `<div class="swot-group ${cls}"><div class="swot-title">${title}</div>${items.map(i => `<div class="swot-item">${esc(i)}</div>`).join('')}</div>`
        : '';
    return `<section class="section">
        <div class="section-title-bar"><h3 class="section-title">SWOT 分析</h3></div>
        <div class="section-body">
            ${group('優勢', a.strengths, 'swot-s')}
            ${group('劣勢', a.weaknesses, 'swot-w')}
            ${group('機會', a.opportunities, 'swot-o')}
            ${group('威脅', a.threats, 'swot-t')}
        </div>
    </section>`;
}

function renderSidebar(c, signals) {
    const explosive = signals.filter(s => s.abf_demand_impact === 'explosive').length;
    const high = signals.filter(s => s.abf_demand_impact === 'high').length;
    const verified = signals.filter(s => s.status === 'verified').length;
    return `<aside class="entity-sidebar">
        <div class="section">
            <div class="section-title-bar"><h3 class="section-title">核心數據</h3></div>
            <div class="section-body">
                <div class="kv-table">
                    <div class="kv-table-row"><div class="kv-table-label">市值</div><div class="kv-table-value">${esc(c.market_cap || '—')}</div></div>
                    <div class="kv-table-row"><div class="kv-table-label">成立</div><div class="kv-table-value">${esc(c.founded || '—')}</div></div>
                    <div class="kv-table-row"><div class="kv-table-label">代工</div><div class="kv-table-value">${esc(c.foundry || '—')}</div></div>
                </div>
            </div>
        </div>
        <div class="section">
            <div class="section-title-bar"><h3 class="section-title">信號統計</h3></div>
            <div class="section-body">
                <div class="kv-table">
                    <div class="kv-table-row"><div class="kv-table-label">爆發性</div><div class="kv-table-value">${explosive}</div></div>
                    <div class="kv-table-row"><div class="kv-table-label">高影響</div><div class="kv-table-value">${high}</div></div>
                    <div class="kv-table-row"><div class="kv-table-label">已驗證</div><div class="kv-table-value">${verified}</div></div>
                </div>
            </div>
        </div>
        <div class="section">
            <div class="section-title-bar"><h3 class="section-title">下一步</h3></div>
            <div class="section-body">
                <button class="watch-btn watch-btn-lg" id="entityWatchBtn" data-type="company" data-id="${c.id}">★ 關注公司</button>
                <a href="roadmap.html?company=${c.id}" style="display:block;margin-top:0.5rem;color:var(--fg);text-decoration:none">→ 看 ${esc(c.name_en || c.id)} 路線圖</a>
            </div>
        </div>
    </aside>`;
}

function bindWatchBtn(id) {
    const btn = document.getElementById('entityWatchBtn');
    if (!btn) return;
    const update = () => {
        try {
            const wl = JSON.parse(localStorage.getItem('watchlist') || '{"companies":[],"chips":[]}');
            const active = wl.companies.includes(id);
            btn.classList.toggle('active', active);
            btn.textContent = active ? '★ 已關注' : '☆ 關注公司';
        } catch {}
    };
    update();
    btn.addEventListener('click', () => {
        let wl;
        try { wl = JSON.parse(localStorage.getItem('watchlist') || '{"companies":[],"chips":[]}'); }
        catch { wl = { companies: [], chips: [] }; }
        const idx = wl.companies.indexOf(id);
        if (idx >= 0) wl.companies.splice(idx, 1); else wl.companies.push(id);
        localStorage.setItem('watchlist', JSON.stringify(wl));
        update();
    });
}

async function init() {
    const id = getId();
    const root = document.getElementById('companyDetailRoot');
    if (!id) {
        root.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div><div class="empty-state-title">缺少公司 ID</div></div>`;
        return;
    }

    renderCrumb('公司目錄');

    const [companyResult, signalsResult] = await Promise.all([getCompanyDoc(id), loadSignals()]);
    if (!companyResult.ok) {
        root.innerHTML = `<div class="empty-state"><div class="empty-state-icon">404</div><div class="empty-state-title">公司不存在</div></div>`;
        return;
    }
    const c = companyResult.data;
    const signals = (signalsResult.ok ? signalsResult.data : []).filter(s => s.company_id === id);
    document.title = `${c.name_en || id} — 芯片情報`;

    root.innerHTML = `
        ${renderHeader(c)}
        <div class="entity-grid">
            <div class="entity-main">
                ${renderOverview(c)}
                ${renderSignals(signals)}
                ${renderChips(signals)}
                ${renderSwot(c)}
            </div>
            ${renderSidebar(c, signals)}
        </div>
    `;
    bindWatchBtn(id);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
