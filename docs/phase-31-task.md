# Phase 31 任務指令 — Roadmap 矩陣重設計

> 項目路徑：`D:\chip-roadmap-website`
> 前置：Phase 30 完成
> 範圍：roadmap.html 完全重寫為矩陣網格
> 工期：2 工作日
> Spec：§ 8.4

---

## 任務 A — 重寫 `roadmap.html`

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>路線圖 — 芯片情報</title>
    <meta name="description" content="從 verified 信號派生的芯片路線圖矩陣。">
    <link rel="stylesheet" href="css/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <main class="roadmap-page">
        <div class="roadmap-container">
            <header class="page-head">
                <div class="page-head-inner">
                    <div class="page-head-eyebrow">ROADMAP / VERIFIED TIMELINE</div>
                    <h1 class="page-head-title">芯片路線圖</h1>
                    <p class="page-head-meta">僅顯示 verified + pilot/ramp/volume 信號 · <span id="cellCount">—</span> 條</p>
                </div>
            </header>

            <div class="filter-bar" id="roadmapFilter">
                <button class="filter-btn active" data-company="">全部</button>
                <!-- 動態填充公司 -->
            </div>

            <div class="roadmap-matrix-wrap">
                <div class="roadmap-matrix" id="roadmapMatrix">
                    <div class="empty-state"><div class="empty-state-icon">◈</div><div class="empty-state-title">載入中...</div></div>
                </div>
            </div>

            <div class="roadmap-legend">
                <span class="badge badge-impact-explosive">⚡ 爆發性</span>
                <span class="badge badge-impact-high">↑ 高</span>
                <span class="badge badge-impact-medium">→ 中</span>
                <span class="badge badge-status-verified">verified</span>
                <span class="badge badge-status-watch">watch</span>
            </div>
        </div>
    </main>
    <script type="module" src="js/modules/global-nav.js"></script>
    <script type="module" src="js/modules/roadmap-matrix.js"></script>
</body>
</html>
```

---

## 任務 B — 新建 `js/modules/roadmap-matrix.js`

```js
import { loadSignals, loadCompanies } from '../firebase/db.js';
import { IMPACT_LABEL, STAGE_LABEL, STATUS_LABEL } from './signals-schema.js';
import { isRoadmapEligibleSignal } from './roadmap-derived.js';

let allEligible = [];
let companies = {};
let currentCompany = '';

function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function buildMatrix(signals) {
    const byCompany = {};
    const quartersSet = new Set();

    signals.forEach(s => {
        const key = `${s.release_year}-${s.release_quarter}`;
        quartersSet.add(key);
        if (!byCompany[s.company_id]) byCompany[s.company_id] = {};
        if (!byCompany[s.company_id][key]) byCompany[s.company_id][key] = [];
        byCompany[s.company_id][key].push(s);
    });

    const quarters = [...quartersSet].sort((a, b) => {
        const [ay, aq] = a.split('-');
        const [by, bq] = b.split('-');
        if (ay !== by) return Number(ay) - Number(by);
        return aq.localeCompare(bq);
    });

    const companyIds = Object.keys(byCompany).sort((a, b) => {
        const aName = companies[a]?.name_en || a;
        const bName = companies[b]?.name_en || b;
        return aName.localeCompare(bName);
    });

    return { quarters, companyIds, byCompany };
}

function renderCell(signals) {
    if (!signals.length) return '<td class="roadmap-cell roadmap-cell-empty"></td>';
    return `<td class="roadmap-cell">
        ${signals.map(s => `<a href="signal.html?id=${encodeURIComponent(s.id)}" class="roadmap-chip roadmap-chip-${s.abf_demand_impact} roadmap-chip-status-${s.status}" title="${esc(s.title)}">
            ${s.abf_demand_impact === 'explosive' ? '⚡' : s.abf_demand_impact === 'high' ? '↑' : ''}${esc(s.chip_name)}
        </a>`).join('')}
    </td>`;
}

function renderMatrix() {
    const filtered = currentCompany
        ? allEligible.filter(s => s.company_id === currentCompany)
        : allEligible;

    const { quarters, companyIds, byCompany } = buildMatrix(filtered);

    if (!filtered.length) {
        document.getElementById('roadmapMatrix').innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">◈</div>
            <div class="empty-state-title">沒有符合條件的信號</div>
            <div class="empty-state-sub">verified + pilot/ramp/volume 階段的信號才會顯示在路線圖</div>
        </div>`;
        document.getElementById('cellCount').textContent = 0;
        return;
    }

    document.getElementById('cellCount').textContent = filtered.length;

    let html = '<table class="roadmap-table"><thead><tr><th class="roadmap-head-company"></th>';
    quarters.forEach(q => {
        const [y, qq] = q.split('-');
        html += `<th class="roadmap-head-quarter">${y}<br><span class="roadmap-head-q">${qq}</span></th>`;
    });
    html += '</tr></thead><tbody>';

    companyIds.forEach(cid => {
        const c = companies[cid];
        const name = c?.name_en || cid;
        html += `<tr><td class="roadmap-row-company"><a href="company.html?id=${cid}" class="entity-link entity-company"><span class="entity-icon"></span>${esc(name)}</a></td>`;
        quarters.forEach(q => {
            html += renderCell(byCompany[cid][q] || []);
        });
        html += '</tr>';
    });
    html += '</tbody></table>';

    document.getElementById('roadmapMatrix').innerHTML = html;
}

function renderFilter() {
    const companyIds = [...new Set(allEligible.map(s => s.company_id))];
    const filterBar = document.getElementById('roadmapFilter');
    filterBar.innerHTML = '<button class="filter-btn active" data-company="">全部</button>' +
        companyIds.map(id => {
            const name = companies[id]?.name_en || id;
            return `<button class="filter-btn" data-company="${esc(id)}">${esc(name)}</button>`;
        }).join('');
    filterBar.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCompany = btn.dataset.company;
            renderMatrix();
        });
    });
}

async function init() {
    const [sResult, cMap] = await Promise.all([loadSignals(), loadCompanies()]);
    if (!sResult.ok) return;
    allEligible = sResult.data.filter(isRoadmapEligibleSignal);
    companies = cMap;

    renderFilter();
    renderMatrix();

    // Apply ?company= URL parameter
    const urlCompany = new URLSearchParams(window.location.search).get('company');
    if (urlCompany) {
        const btn = document.querySelector(`.filter-btn[data-company="${urlCompany}"]`);
        if (btn) btn.click();
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
```

---

## 任務 C — 新建 `css/pages/roadmap.css`

```css
.roadmap-page { padding-top: var(--s-4); padding-bottom: var(--s-12); }
.roadmap-container {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: 0 var(--s-6);
}
.roadmap-matrix-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    background: var(--bg-panel);
    margin-top: var(--s-4);
}
.roadmap-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--t-xs);
}
.roadmap-table th, .roadmap-table td {
    border: 1px solid var(--border);
    padding: var(--s-2);
    vertical-align: top;
}
.roadmap-head-company {
    position: sticky;
    left: 0;
    background: var(--bg-panel);
    z-index: 2;
    min-width: 8rem;
}
.roadmap-head-quarter {
    text-align: center;
    background: var(--bg-panel);
    color: var(--fg-muted);
    font-weight: 600;
    min-width: 7rem;
}
.roadmap-head-q { color: var(--fg-dim); font-size: var(--t-xs); }
.roadmap-row-company {
    position: sticky;
    left: 0;
    background: var(--bg-panel);
    z-index: 1;
    font-weight: 600;
}
.roadmap-cell { padding: var(--s-1) !important; }
.roadmap-cell-empty { background: var(--bg); }
.roadmap-chip {
    display: block;
    padding: var(--s-1) var(--s-2);
    margin: var(--s-1) 0;
    background: var(--bg);
    border-left: 3px solid var(--border);
    color: var(--fg);
    text-decoration: none;
    font-size: var(--t-xs);
    line-height: 1.3;
    transition: var(--transition);
}
.roadmap-chip:hover { background: var(--bg-hover); }
.roadmap-chip-explosive { border-color: #33ff00; }
.roadmap-chip-high { border-color: #33ff00; opacity: 0.85; }
.roadmap-chip-medium { border-color: #ffb000; }
.roadmap-chip-low { border-color: var(--fg-muted); }
.roadmap-chip-status-watch { font-style: italic; color: var(--accent); }
.roadmap-legend {
    margin-top: var(--s-4);
    padding: var(--s-3) 0;
    display: flex;
    gap: var(--s-2);
    flex-wrap: wrap;
    font-size: var(--t-xs);
    color: var(--fg-muted);
    border-top: 1px solid var(--border);
}
```

在 `style.css` 追加 `@import './pages/roadmap.css';`

---

## 任務 D — 砍掉舊的 timeline.js 邏輯

`roadmap-matrix.js` 完全替代舊的 `timeline.js` 渲染。**保留 `js/modules/timeline.js` 不刪除**（避免測試破壞），但 `roadmap.html` 不再引用它。

`js/app.js` 中所有 `import { renderTimeline } from './modules/timeline.js';` 相關的 path === roadmap.html 分支代碼**保留但不會執行**（因為 roadmap.html 不再使用 app.js）。

---

## 驗收

1. `npm run build` 通過
2. `node --test tests/*.test.js` → **90/90**
3. 視覺檢查：
   - roadmap.html 顯示矩陣（公司 × 季度）
   - 每格內顯示芯片名 + 影響等級顏色
   - 點任何 chip 進入 signal.html?id=
   - 點公司名進入 company.html?id=
   - 按公司篩選正常
   - 移動端：可水平 scroll，第一列 sticky 鎖定
4. URL `roadmap.html?company=nvidia` 自動篩選 NVIDIA
5. Commit：
   ```
   feat(redesign): phase 31 — roadmap matrix (company x quarter grid)
   ```
6. `git push origin main`

## 完成後回報

- 矩陣顯示了幾家公司、幾個季度
- 點芯片是否正確跳到 signal.html
