# Phase 30 任務指令 — 公司目錄 + 公司詳情 + 芯片詳情重設計

> 項目路徑：`D:\chip-roadmap-website`
> 前置：Phase 29 完成
> 範圍：companies.html / company.html / chip.html 完全重寫
> 工期：3 工作日
> Spec：§ 8.1, § 8.2, § 8.3

---

## 任務 A — `companies.html`（公司目錄：表格 → 卡片網格）

### A-1：重寫 body

```html
<body>
    <main class="companies-page">
        <div class="companies-container">
            <header class="page-head">
                <div class="page-head-inner">
                    <div class="page-head-eyebrow">COMPANIES / DIRECTORY</div>
                    <h1 class="page-head-title">公司目錄</h1>
                    <p class="page-head-meta"><span id="companyCount">—</span> 公司 · <span id="companySignalCount">—</span> 條相關信號</p>
                </div>
            </header>

            <div class="filter-bar">
                <input type="search" class="filter-select" id="companySearch" placeholder="搜尋公司..." style="flex:1;max-width:20rem">
                <div class="filter-divider"></div>
                <select class="filter-select" id="filterRegion">
                    <option value="">全部地區</option>
                </select>
                <select class="filter-select" id="filterCategory">
                    <option value="">全部類別</option>
                </select>
                <select class="filter-select" id="filterImpact">
                    <option value="">全部 ABF 影響</option>
                    <option value="explosive">爆發性</option>
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                </select>
            </div>

            <div class="company-grid" id="companyGrid">
                <div class="empty-state">
                    <div class="empty-state-icon">◈</div>
                    <div class="empty-state-title">載入中...</div>
                </div>
            </div>
        </div>
    </main>
    <script type="module" src="js/modules/global-nav.js"></script>
    <script type="module" src="js/modules/companies-page.js"></script>
</body>
```

### A-2：新建 `js/modules/companies-page.js`

```js
import { loadCompanies, loadSignals } from '../firebase/db.js';
import { IMPACT_LABEL, REGION_LABEL } from './signals-schema.js';

let companies = [];
let signals = [];
let signalsByCompany = {};

function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function maxImpact(sigs) {
    const order = { explosive: 4, high: 3, medium: 2, low: 1 };
    return sigs.reduce((max, s) => {
        return (order[s.abf_demand_impact] || 0) > (order[max] || 0) ? s.abf_demand_impact : max;
    }, '');
}

function renderCard(c) {
    const sigs = signalsByCompany[c.id] || [];
    const sigCount = sigs.length;
    const impact = c.abf_demand_impact || maxImpact(sigs);
    return `<a href="company.html?id=${c.id}" class="company-card">
        <div class="company-card-header">
            <span class="entity-icon" style="color:var(--accent)">◆</span>
            <h3 class="company-card-name">${esc(c.name_en || c.id)}</h3>
        </div>
        ${c.name_cn ? `<div class="company-card-cn">${esc(c.name_cn)}</div>` : ''}
        <div class="company-card-meta">
            ${esc(REGION_LABEL[c.country] || c.country || '')} · ${esc(c.category || '')}
        </div>
        ${c.market_cap ? `<div class="company-card-cap">💰 ${esc(c.market_cap)}</div>` : ''}
        <div class="company-card-stats">
            <span>📡 ${sigCount} 信號</span>
            ${impact ? `<span class="badge badge-impact-${impact}">⚡ ${esc(IMPACT_LABEL[impact])}</span>` : ''}
        </div>
    </a>`;
}

function populateFilters() {
    const regions = [...new Set(companies.map(c => c.country).filter(Boolean))].sort();
    const categories = [...new Set(companies.map(c => c.category).filter(Boolean))].sort();
    document.getElementById('filterRegion').innerHTML = '<option value="">全部地區</option>' +
        regions.map(r => `<option value="${esc(r)}">${esc(REGION_LABEL[r] || r)}</option>`).join('');
    document.getElementById('filterCategory').innerHTML = '<option value="">全部類別</option>' +
        categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

function applyFilters() {
    const q = document.getElementById('companySearch').value.trim().toLowerCase();
    const region = document.getElementById('filterRegion').value;
    const category = document.getElementById('filterCategory').value;
    const impact = document.getElementById('filterImpact').value;

    let result = [...companies];
    if (q) result = result.filter(c =>
        (c.name_en || '').toLowerCase().includes(q) ||
        (c.name_cn || '').includes(q) ||
        (c.id || '').toLowerCase().includes(q)
    );
    if (region) result = result.filter(c => c.country === region);
    if (category) result = result.filter(c => c.category === category);
    if (impact) result = result.filter(c => {
        const sigs = signalsByCompany[c.id] || [];
        return (c.abf_demand_impact === impact) || sigs.some(s => s.abf_demand_impact === impact);
    });

    const grid = document.getElementById('companyGrid');
    if (result.length === 0) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◈</div><div class="empty-state-title">沒有匹配公司</div></div>`;
    } else {
        grid.innerHTML = result.map(renderCard).join('');
    }
    document.getElementById('companyCount').textContent = result.length;
}

async function init() {
    const [cMap, sResult] = await Promise.all([loadCompanies(), loadSignals()]);
    companies = Object.values(cMap).sort((a, b) => (a.name_en || a.id).localeCompare(b.name_en || b.id));
    signals = sResult.ok ? sResult.data : [];
    signalsByCompany = signals.reduce((acc, s) => {
        (acc[s.company_id] = acc[s.company_id] || []).push(s);
        return acc;
    }, {});

    document.getElementById('companySignalCount').textContent = signals.length;
    populateFilters();
    applyFilters();

    document.getElementById('companySearch').addEventListener('input', applyFilters);
    ['filterRegion', 'filterCategory', 'filterImpact'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
```

### A-3：新建 `css/pages/companies.css`

```css
.companies-page { padding-top: var(--s-4); padding-bottom: var(--s-12); }
.companies-container {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: 0 var(--s-6);
}
.company-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-4);
    margin-top: var(--s-6);
}
@media (max-width: 900px) { .company-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .company-grid { grid-template-columns: 1fr; } }

.company-card {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    padding: var(--s-4);
    text-decoration: none;
    color: var(--fg);
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    transition: var(--transition);
}
.company-card:hover {
    border-color: var(--border-bright);
    background: var(--bg-hover);
}
.company-card-header { display: flex; align-items: center; gap: var(--s-2); }
.company-card-name { font-size: var(--t-md); margin: 0; }
.company-card-cn { font-size: var(--t-xs); color: var(--fg-muted); }
.company-card-meta { font-size: var(--t-xs); color: var(--fg-muted); }
.company-card-cap { font-size: var(--t-xs); color: var(--accent); }
.company-card-stats {
    display: flex;
    justify-content: space-between;
    margin-top: auto;
    padding-top: var(--s-2);
    border-top: 1px solid var(--border);
    font-size: var(--t-xs);
}
```

在 `style.css` 追加 `@import './pages/companies.css';`

---

## 任務 B — `company.html`（公司詳情，從 company-signals.html 重命名 + 重做）

### B-1：新建 `company.html`

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>公司詳情 — 芯片情報</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <main class="entity-detail-page">
        <div class="entity-detail-container">
            <div class="crumb" data-crumb>
                <a class="crumb-link" href="companies.html">← 公司目錄</a>
            </div>
            <div id="companyDetailRoot">
                <div class="empty-state"><div class="empty-state-icon">◈</div><div class="empty-state-title">載入中...</div></div>
            </div>
        </div>
    </main>
    <script type="module" src="js/modules/global-nav.js"></script>
    <script type="module" src="js/modules/company-detail.js"></script>
</body>
</html>
```

### B-2：新建 `js/modules/company-detail.js`

```js
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
```

### B-3：新建 `css/pages/entity-detail.css`

```css
.entity-detail-page { padding-top: var(--s-4); padding-bottom: var(--s-12); }
.entity-detail-container {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: 0 var(--s-6);
}
.entity-grid {
    display: grid;
    grid-template-columns: 1fr var(--sidebar-w);
    gap: var(--s-8);
}
@media (max-width: 900px) {
    .entity-grid { grid-template-columns: 1fr; }
}
.entity-main { min-width: 0; }
.entity-sidebar { display: flex; flex-direction: column; }

.swot-group { margin-bottom: var(--s-4); }
.swot-title {
    font-size: var(--t-xs);
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: var(--s-2);
}
.swot-item {
    padding: var(--s-1) var(--s-2);
    border-left: 2px solid var(--border);
    margin-bottom: var(--s-1);
    font-size: var(--t-sm);
    color: var(--fg-dim);
}
.swot-s .swot-item { border-color: var(--fg); }
.swot-w .swot-item { border-color: var(--danger); }
.swot-o .swot-item { border-color: var(--accent); }
.swot-t .swot-item { border-color: var(--fg-muted); }
```

在 `style.css` 追加 `@import './pages/entity-detail.css';`

### B-4：保留 `company-signals.html` 為跳轉

把 `company-signals.html` 改為：
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>跳轉中... — 芯片情報</title>
    <script>
        const id = new URLSearchParams(window.location.search).get('id');
        window.location.replace('company.html' + (id ? '?id=' + id : ''));
    </script>
    <meta http-equiv="refresh" content="0; url=company.html">
</head>
<body><p>跳轉到新公司詳情頁...</p></body>
</html>
```

---

## 任務 C — `chip.html`（芯片詳情，從 chip-signals.html 重命名 + 重做）

類似 company.html 結構。新建 `chip.html` + `js/modules/chip-detail.js`。

### C-1：`chip.html`

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>芯片詳情 — 芯片情報</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <main class="entity-detail-page">
        <div class="entity-detail-container">
            <div class="crumb" data-crumb><a class="crumb-link" href="index.html">← 信號流</a></div>
            <div id="chipDetailRoot">
                <div class="empty-state"><div class="empty-state-icon">◈</div><div class="empty-state-title">載入中...</div></div>
            </div>
        </div>
    </main>
    <script type="module" src="js/modules/global-nav.js"></script>
    <script type="module" src="js/modules/chip-detail.js"></script>
</body>
</html>
```

### C-2：`js/modules/chip-detail.js`

```js
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
```

### C-3：保留 `chip-signals.html` 為跳轉

把 `chip-signals.html` 改為：
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>跳轉中... — 芯片情報</title>
    <script>
        const name = new URLSearchParams(window.location.search).get('name');
        window.location.replace('chip.html' + (name ? '?name=' + encodeURIComponent(name) : ''));
    </script>
    <meta http-equiv="refresh" content="0; url=chip.html">
</head>
<body><p>跳轉到新芯片詳情頁...</p></body>
</html>
```

---

## 驗收

1. `npm run build` 通過
2. `node --test tests/*.test.js` → **90/90**
3. 視覺檢查：
   - `companies.html` 顯示卡片網格（3 列 desktop / 1 列 mobile）
   - `company.html?id=nvidia` 顯示完整詳情
   - `chip.html?name=H200 SXM5` 顯示完整詳情
   - 舊 URL `company-signals.html?id=nvidia` 自動跳轉到 `company.html?id=nvidia`
4. 關注按鈕：點擊狀態切換，刷新後保持
5. Commit：
   ```
   feat(redesign): phase 30 — companies grid + company/chip detail pages
   ```
6. `git push origin main`

## 完成後回報

- 50 家公司卡片是否正常顯示
- 從 companies.html 點任意公司是否能進到 company.html
- 關注狀態 localStorage 是否正常持久化
