import { loadSignals, loadCompanies } from '../firebase/db.js';
import { STAGE_LABEL, IMPACT_LABEL } from './signals-schema.js';
import { renderCrumb } from './global-crumb.js';

function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const getName = () => new URLSearchParams(window.location.search).get('name');

function aggregate(signals) {
    if (!signals.length) return null;
    const latest = signals[0];
    const order = { explosive: 4, high: 3, medium: 2, low: 1 };
    const maxImpact = signals.reduce((max, s) =>
        (order[s.abf_demand_impact] || 0) > (order[max] || 0) ? s.abf_demand_impact : max, '');
    const stages = [...new Set(signals.map(s => s.stage))];
    return {
        chipName: latest.chip_name,
        companyId: latest.company_id,
        companyName: latest.company_name,
        package: latest.package_type,
        abfLayers: latest.abf_layers,
        cowos: latest.cowos_required,
        hbm: latest.hbm,
        releaseYear: latest.release_year,
        releaseQuarter: latest.release_quarter,
        maxImpact,
        stages,
        count: signals.length,
    };
}

async function init() {
    const name = getName();
    const root = document.getElementById('chipDetailRoot');
    if (!name) {
        root.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div><div class="empty-state-title">缺少芯片名稱</div></div>`;
        return;
    }
    renderCrumb('信號流');

    const [sResult, cMap] = await Promise.all([loadSignals(), loadCompanies()]);
    const allSignals = sResult.ok ? sResult.data : [];
    const chipSignals = allSignals.filter(s => s.chip_name === name);

    if (chipSignals.length === 0) {
        root.innerHTML = `<div class="empty-state"><div class="empty-state-icon">404</div><div class="empty-state-title">芯片不存在或暫無信號</div></div>`;
        return;
    }

    const agg = aggregate(chipSignals);
    const company = cMap[agg.companyId];
    document.title = `${name} — 芯片情報`;

    root.innerHTML = `
        <header class="page-head">
            <div class="page-head-inner">
                <div class="page-head-eyebrow">CHIP / DETAIL</div>
                <h1 class="page-head-title">◇ ${esc(name)}</h1>
                <p class="page-head-meta">
                    <a class="entity-link entity-company" href="company.html?id=${agg.companyId}"><span class="entity-icon"></span>${esc(company?.name_en || agg.companyName)}</a>
                    ${agg.releaseYear ? ` · ${agg.releaseYear} ${agg.releaseQuarter || ''}` : ''}
                </p>
            </div>
        </header>
        <div class="entity-grid">
            <div class="entity-main">
                <section class="section">
                    <div class="section-title-bar"><h3 class="section-title">芯片規格</h3></div>
                    <div class="section-body">
                        <div class="kv-table">
                            <div class="kv-table-row"><div class="kv-table-label">廠商</div><div class="kv-table-value">${esc(company?.name_en || agg.companyName)}</div></div>
                            <div class="kv-table-row"><div class="kv-table-label">封裝</div><div class="kv-table-value">${esc(agg.package || '—')}</div></div>
                            <div class="kv-table-row"><div class="kv-table-label">ABF 層數</div><div class="kv-table-value">${agg.abfLayers ? agg.abfLayers + 'L' : '—'}</div></div>
                            <div class="kv-table-row"><div class="kv-table-label">CoWoS</div><div class="kv-table-value">${agg.cowos ? '需要' : '不需要'}</div></div>
                            <div class="kv-table-row"><div class="kv-table-label">HBM</div><div class="kv-table-value">${esc(agg.hbm || '—')}</div></div>
                            <div class="kv-table-row"><div class="kv-table-label">階段</div><div class="kv-table-value">${agg.stages.map(s => `<span class="badge badge-stage-${s}">${STAGE_LABEL[s]}</span>`).join(' ')}</div></div>
                        </div>
                    </div>
                </section>

                <section class="section">
                    <div class="section-title-bar"><h3 class="section-title">該芯片所有信號 (${chipSignals.length})</h3></div>
                    <div class="section-body">
                        ${chipSignals.map(s => `<a href="signal.html?id=${encodeURIComponent(s.id)}" class="signal-card" style="text-decoration:none;color:inherit;display:block">
                            <div class="signal-card-badges">
                                <span class="badge badge-impact-${s.abf_demand_impact}">${IMPACT_LABEL[s.abf_demand_impact]}</span>
                                <span class="badge badge-stage-${s.stage}">${STAGE_LABEL[s.stage]}</span>
                            </div>
                            <h3 class="signal-card-title">${esc(s.title)}</h3>
                            <div class="signal-card-body">${esc(s.evidence_summary || '')}</div>
                        </a>`).join('')}
                    </div>
                </section>
            </div>
            <aside class="entity-sidebar">
                <div class="section">
                    <div class="section-title-bar"><h3 class="section-title">影響等級</h3></div>
                    <div class="section-body">
                        ${agg.maxImpact ? `<span class="badge badge-impact-${agg.maxImpact}" style="font-size:var(--t-base);padding:0.5rem 1rem">${IMPACT_LABEL[agg.maxImpact]}</span>` : '—'}
                    </div>
                </div>
                <div class="section">
                    <div class="section-title-bar"><h3 class="section-title">下一步</h3></div>
                    <div class="section-body">
                        <button class="watch-btn watch-btn-lg" id="chipWatchBtn" data-name="${esc(name)}">☆ 關注芯片</button>
                        <a href="company.html?id=${agg.companyId}" style="display:block;margin-top:0.5rem;color:var(--fg);text-decoration:none">→ 看 ${esc(company?.name_en || agg.companyName)} 完整檔案</a>
                    </div>
                </div>
            </aside>
        </div>
    `;

    // Watch button
    const btn = document.getElementById('chipWatchBtn');
    const update = () => {
        try {
            const wl = JSON.parse(localStorage.getItem('watchlist') || '{"companies":[],"chips":[]}');
            const active = wl.chips.includes(name);
            btn.classList.toggle('active', active);
            btn.textContent = active ? '★ 已關注' : '☆ 關注芯片';
        } catch {}
    };
    update();
    btn.addEventListener('click', () => {
        let wl;
        try { wl = JSON.parse(localStorage.getItem('watchlist') || '{"companies":[],"chips":[]}'); }
        catch { wl = { companies: [], chips: [] }; }
        const idx = wl.chips.indexOf(name);
        if (idx >= 0) wl.chips.splice(idx, 1); else wl.chips.push(name);
        localStorage.setItem('watchlist', JSON.stringify(wl));
        update();
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
