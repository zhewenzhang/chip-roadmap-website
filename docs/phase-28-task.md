# Phase 28 任務指令 — 信號流首頁（index.html 主軸頁面）

> 項目路徑：`D:\chip-roadmap-website`
> 前置：Phase 27 完成
> 範圍：完全重寫 index.html，合併 signals.html 功能
> 工期：3 工作日
> Spec：§ 4

---

## 概述

index.html 變成產品主軸：左欄信號流（70%）+ 右欄關注 sidebar（30%）。signals.html 變成跳轉到 index.html 的兼容頁。

---

## 任務 A — 重寫 `index.html`

完整替換 `index.html` 的 `<body>` 內容（保留 `<head>` + global-nav.js script）為：

```html
<body>
    <!-- Global nav 由 global-nav.js 注入 -->

    <main class="home-page" id="homePage">
        <div class="home-container">
            <header class="page-head">
                <div class="page-head-inner">
                    <div class="page-head-eyebrow">SIGNALS / LIVE</div>
                    <h1 class="page-head-title">信號流</h1>
                    <p class="page-head-meta">Last update <span id="lastUpdateTime">—</span></p>
                </div>
            </header>

            <div class="home-grid">
                <!-- Main column (70%) -->
                <section class="home-main">
                    <!-- Summary strip -->
                    <div class="home-summary" id="homeSummary">
                        <span class="home-summary-item">— verified</span>
                        <span class="home-summary-item">— watch</span>
                        <span class="home-summary-item">— explosive</span>
                        <span class="home-summary-item">NEW: — today</span>
                    </div>

                    <!-- Filter bar -->
                    <div class="filter-bar" id="homeFilterBar">
                        <div class="filter-group">
                            <button class="filter-btn active" data-time="all">全部</button>
                            <button class="filter-btn" data-time="today">今日</button>
                            <button class="filter-btn" data-time="7d">7 天</button>
                        </div>
                        <div class="filter-divider"></div>
                        <select class="filter-select" id="filterImpact">
                            <option value="">全部影響</option>
                            <option value="explosive">爆發性</option>
                            <option value="high">高</option>
                            <option value="medium">中</option>
                            <option value="low">低</option>
                        </select>
                        <select class="filter-select" id="filterStage">
                            <option value="">全部階段</option>
                            <option value="rumor">傳聞</option>
                            <option value="announced">已宣布</option>
                            <option value="sampling">送樣</option>
                            <option value="design_win">設計勝出</option>
                            <option value="pilot">試產</option>
                            <option value="ramp">爬產</option>
                            <option value="volume">量產</option>
                        </select>
                        <select class="filter-select" id="filterCompany">
                            <option value="">全部公司</option>
                        </select>
                    </div>

                    <!-- Signal stream -->
                    <div class="signal-stream" id="signalStream">
                        <div class="empty-state">
                            <div class="empty-state-icon">◈</div>
                            <div class="empty-state-title">載入中...</div>
                        </div>
                    </div>

                    <div class="signal-stream-pager">
                        <button class="empty-state-cta" id="loadMoreBtn" style="display:none">載入更多</button>
                    </div>
                </section>

                <!-- Sidebar (30%) -->
                <aside class="home-sidebar">
                    <div class="section">
                        <div class="section-title-bar">
                            <h3 class="section-title">我的關注</h3>
                            <a class="section-action" href="#" id="manageWatchlistBtn">管理</a>
                        </div>
                        <div class="section-body" id="watchlistBlock">
                            <div class="empty-state-sub">點公司或芯片詳情頁的關注按鈕加入</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title-bar">
                            <h3 class="section-title">高影響信號</h3>
                        </div>
                        <div class="section-body" id="highImpactBlock"></div>
                    </div>

                    <div class="section">
                        <div class="section-title-bar">
                            <h3 class="section-title">本週新增</h3>
                        </div>
                        <div class="section-body" id="weekRecentBlock"></div>
                    </div>
                </aside>
            </div>
        </div>
    </main>

    <script type="module" src="js/modules/global-nav.js"></script>
    <script type="module" src="js/modules/home.js"></script>
</body>
```

---

## 任務 B — 新建 `js/modules/home.js`

```js
/**
 * Home (signal stream) — Phase 28
 */
import { loadSignals, loadCompanies } from '../firebase/db.js';
import { STAGE_LABEL, IMPACT_LABEL, STATUS_LABEL } from './signals-schema.js';

let allSignals = [];
let companies = {};
let filtered = [];
let pageSize = 10;
let currentPage = 1;

const STAGE_BADGE_CLS = (s) => `badge badge-stage-${s}`;
const STATUS_BADGE_CLS = (s) => `badge badge-status-${s}`;
const IMPACT_BADGE_CLS = (i) => `badge badge-impact-${i}`;

function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relativeTime(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toISOString().slice(0, 10);
}

function renderSignalCard(s) {
    const company = companies[s.company_id];
    const companyName = company?.name_en || s.company_name || s.company_id;
    const impactEntities = (s.impact_entities || []).slice(0, 4);
    const impactHook = impactEntities.length
        ? impactEntities.map(e => companies[e.company_id]?.name_en || e.company_id).join(' · ')
        : '';

    const meta = [
        companyName,
        s.chip_name,
        s.release_year && s.release_quarter ? `${s.release_year} ${s.release_quarter}` : null,
        s.package_type,
        s.abf_layers ? `${s.abf_layers}L` : null,
        s.hbm
    ].filter(Boolean);

    return `<article class="signal-card" data-id="${esc(s.id)}">
        <div class="signal-card-badges">
            <span class="${IMPACT_BADGE_CLS(s.abf_demand_impact)}">${esc(IMPACT_LABEL[s.abf_demand_impact] || s.abf_demand_impact)}</span>
            <span class="${STAGE_BADGE_CLS(s.stage)}">${esc(STAGE_LABEL[s.stage] || s.stage)}</span>
            ${s.status === 'watch' ? `<span class="${STATUS_BADGE_CLS('watch')}">${esc(STATUS_LABEL.watch)}</span>` : ''}
        </div>
        <h2 class="signal-card-title"><a href="signal.html?id=${encodeURIComponent(s.id)}" style="color:inherit;text-decoration:none">${esc(s.title)}</a></h2>
        <div class="signal-card-meta">${meta.map(m => `<span>${esc(m)}</span>`).join('')}</div>
        <div class="signal-card-body">${esc(s.evidence_summary || '')}</div>
        <div class="signal-card-footer">
            <span>confidence ${s.confidence_score} · ${relativeTime(s.last_verified_at || s.updatedAt)}${s.sources?.[0]?.label ? ' · ' + esc(s.sources[0].label) : ''}</span>
            <span>
                ${impactHook ? `<span class="signal-card-impact-hook">影響→ ${esc(impactHook)}</span>` : ''}
                <a class="signal-card-cta" href="signal.html?id=${encodeURIComponent(s.id)}">詳情→</a>
            </span>
        </div>
    </article>`;
}

function applyFilters() {
    const timeFilter = document.querySelector('.filter-btn.active')?.dataset.time || 'all';
    const impact = document.getElementById('filterImpact').value;
    const stage = document.getElementById('filterStage').value;
    const companyId = document.getElementById('filterCompany').value;

    let result = [...allSignals];
    if (timeFilter === 'today') {
        const since = Date.now() - 86400000;
        result = result.filter(s => new Date(s.last_verified_at || s.updatedAt || 0).getTime() > since);
    } else if (timeFilter === '7d') {
        const since = Date.now() - 7 * 86400000;
        result = result.filter(s => new Date(s.last_verified_at || s.updatedAt || 0).getTime() > since);
    }
    if (impact) result = result.filter(s => s.abf_demand_impact === impact);
    if (stage) result = result.filter(s => s.stage === stage);
    if (companyId) result = result.filter(s => s.company_id === companyId);

    filtered = result;
    currentPage = 1;
    renderStream();
    renderSummary();
}

function renderStream() {
    const container = document.getElementById('signalStream');
    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">◈</div>
            <div class="empty-state-title">沒有符合條件的信號</div>
            <div class="empty-state-sub">調整篩選或清除條件</div>
        </div>`;
        document.getElementById('loadMoreBtn').style.display = 'none';
        return;
    }
    const visible = filtered.slice(0, currentPage * pageSize);
    container.innerHTML = visible.map(renderSignalCard).join('');
    document.getElementById('loadMoreBtn').style.display = visible.length < filtered.length ? '' : 'none';
}

function renderSummary() {
    const verified = allSignals.filter(s => s.status === 'verified').length;
    const watch = allSignals.filter(s => s.status === 'watch').length;
    const explosive = allSignals.filter(s => s.abf_demand_impact === 'explosive').length;
    const today = allSignals.filter(s => {
        const t = new Date(s.last_verified_at || s.updatedAt || 0).getTime();
        return t > Date.now() - 86400000;
    }).length;

    document.getElementById('homeSummary').innerHTML = `
        <span class="home-summary-item"><strong>${verified}</strong> verified</span>
        <span class="home-summary-item"><strong>${watch}</strong> watch</span>
        <span class="home-summary-item"><strong>${explosive}</strong> explosive</span>
        <span class="home-summary-item">NEW: <strong>${today}</strong> today</span>
    `;

    const latest = allSignals[0];
    if (latest) {
        document.getElementById('lastUpdateTime').textContent = relativeTime(latest.updatedAt || latest.last_verified_at);
    }
}

function renderSidebar() {
    // Watchlist
    let wl = { companies: [], chips: [] };
    try { wl = JSON.parse(localStorage.getItem('watchlist') || '{}'); } catch {}
    const wlEl = document.getElementById('watchlistBlock');
    const items = [
        ...(wl.companies || []).map(id => {
            const newCount = allSignals.filter(s => s.company_id === id && new Date(s.updatedAt || 0).getTime() > Date.now() - 7 * 86400000).length;
            const name = companies[id]?.name_en || id;
            return `<a class="entity-link entity-company" href="company.html?id=${id}"><span class="entity-icon"></span>${esc(name)}${newCount ? ` <span style="color:var(--accent)">●${newCount}</span>` : ''}</a>`;
        }),
        ...(wl.chips || []).map(name => {
            const newCount = allSignals.filter(s => s.chip_name === name && new Date(s.updatedAt || 0).getTime() > Date.now() - 7 * 86400000).length;
            return `<a class="entity-link entity-chip" href="chip.html?name=${encodeURIComponent(name)}"><span class="entity-icon"></span>${esc(name)}${newCount ? ` <span style="color:var(--accent)">●${newCount}</span>` : ''}</a>`;
        }),
    ];
    wlEl.innerHTML = items.length ? items.map(i => `<div style="padding:0.25rem 0">${i}</div>`).join('') : '<div style="font-size:var(--t-xs);color:var(--fg-muted)">點公司或芯片詳情頁的關注按鈕加入</div>';

    // High impact
    const high = allSignals.filter(s => ['explosive', 'high'].includes(s.abf_demand_impact)).slice(0, 5);
    document.getElementById('highImpactBlock').innerHTML = high.length
        ? high.map(s => `<div style="padding:0.25rem 0;font-size:var(--t-xs)"><a href="signal.html?id=${encodeURIComponent(s.id)}" style="color:var(--fg);text-decoration:none">${s.abf_demand_impact === 'explosive' ? '⚡' : '↑'} ${esc(s.chip_name)} ${esc(STAGE_LABEL[s.stage])}</a></div>`).join('')
        : '<div style="font-size:var(--t-xs);color:var(--fg-muted)">暫無高影響信號</div>';

    // Recent (this week)
    const since = Date.now() - 7 * 86400000;
    const weekVerified = allSignals.filter(s => s.status === 'verified' && new Date(s.updatedAt || 0).getTime() > since).length;
    const weekWatch = allSignals.filter(s => s.status === 'watch' && new Date(s.updatedAt || 0).getTime() > since).length;
    document.getElementById('weekRecentBlock').innerHTML = `
        <div style="font-size:var(--t-sm)">
            <div>+${weekVerified} verified</div>
            <div>+${weekWatch} watch</div>
        </div>
    `;
}

function populateCompanyFilter() {
    const opts = Object.values(companies)
        .sort((a, b) => (a.name_en || '').localeCompare(b.name_en || ''))
        .map(c => `<option value="${esc(c.id)}">${esc(c.name_en || c.id)}</option>`)
        .join('');
    const sel = document.getElementById('filterCompany');
    sel.innerHTML = '<option value="">全部公司</option>' + opts;
}

async function init() {
    const [sResult, cMap] = await Promise.all([loadSignals(), loadCompanies()]);
    if (!sResult.ok) {
        document.getElementById('signalStream').innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">◈</div>
            <div class="empty-state-title">載入失敗</div>
        </div>`;
        return;
    }
    allSignals = sResult.data;
    companies = cMap;
    filtered = [...allSignals];

    populateCompanyFilter();
    renderSummary();
    renderStream();
    renderSidebar();

    // Bindings
    document.querySelectorAll('.filter-btn[data-time]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn[data-time]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilters();
        });
    });
    ['filterImpact', 'filterStage', 'filterCompany'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
    document.getElementById('loadMoreBtn').addEventListener('click', () => {
        currentPage++;
        renderStream();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

---

## 任務 C — 新建 `css/pages/home.css`

```css
.home-page { padding-top: var(--s-6); }
.home-container {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: 0 var(--s-6);
}
.home-grid {
    display: grid;
    grid-template-columns: 1fr var(--sidebar-w);
    gap: var(--s-8);
}
@media (max-width: 900px) {
    .home-grid { grid-template-columns: 1fr; }
    .home-sidebar { display: none; }
}
.home-summary {
    display: flex;
    gap: var(--s-6);
    padding: var(--s-3) 0;
    font-size: var(--t-sm);
    color: var(--fg-muted);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--s-4);
}
.home-summary-item strong { color: var(--fg); margin-right: var(--s-1); }
.signal-stream-pager {
    text-align: center;
    padding: var(--s-6) 0;
}
```

在 `css/style.css` 追加 `@import './pages/home.css';`

---

## 任務 D — page-head 全站樣式

新建 `css/components/page-head.css`：

```css
.page-head {
    padding: var(--s-6) 0;
    margin-bottom: var(--s-6);
}
.page-head-eyebrow {
    font-size: var(--t-xs);
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-bottom: var(--s-2);
}
.page-head-title {
    font-size: var(--t-xl);
    margin: 0;
    margin-bottom: var(--s-2);
}
.page-head-meta {
    font-size: var(--t-sm);
    color: var(--fg-muted);
}
```

在 `css/style.css` 追加 `@import './components/page-head.css';`

---

## 任務 E — 處理舊 signals.html

將 `signals.html` 改為 301 兼容跳轉：

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>跳轉中... — 芯片情報</title>
    <meta http-equiv="refresh" content="0; url=index.html">
    <script>window.location.replace('index.html' + window.location.search);</script>
</head>
<body>
    <p>正在跳轉到信號流... <a href="index.html">如未自動跳轉，請點此</a></p>
</body>
</html>
```

---

## 驗收

1. `npm run build` 通過
2. `node --test tests/*.test.js` → **90/90**
3. 視覺檢查：
   - index.html 顯示信號流（30 條），雙欄佈局
   - 篩選器：時間/影響/階段/公司可用
   - 移動端 sidebar 隱藏，主流仍正常
   - 點任何信號卡片進入 signal.html?id=xxx（Phase 29 才能正常顯示，先確認 URL 對）
4. Commit：
   ```
   feat(redesign): phase 28 — signal stream homepage (2-col + watchlist sidebar)
   ```
5. `git push origin main`

## 完成後回報

- 載入 30 條信號的時間
- 點信號卡片是否跳對 URL
- 移動端 (375px) 是否正常顯示單欄
