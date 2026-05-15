# Phase 29 任務指令 — 信號詳情頁（signal.html + Schema 補丁）

> 項目路徑：`D:\chip-roadmap-website`
> 前置：Phase 28 完成
> 範圍：**新建頁面** + Firestore schema 補丁 + Admin 表單擴充
> 工期：4 工作日
> Spec：§ 5, § 10

---

## 概述

本 Phase 完成兩件事：
1. 新建 `signal.html?id=xxx` 詳情頁（**產品差異化核心**：影響鋪開）
2. signals collection 加 `impact_entities[]` 字段 + Admin 表單能編輯它

---

## 任務 A — Schema 補丁

### A-1：擴展 `js/modules/signals-schema.js`

在文件末尾、`normalizeSignal` 函數內部，找到 return 對象，加入 `impact_entities`：

```js
// 在 return { ... } 中追加：
impact_entities: Array.isArray(raw.impact_entities)
    ? raw.impact_entities
        .filter(e => e && e.company_id)
        .map(e => ({
            company_id: String(e.company_id),
            relation: ['benefit', 'impacted', 'neutral'].includes(e.relation) ? e.relation : 'neutral',
            reason: String(e.reason || '').slice(0, 80),
            order: Number.isFinite(e.order) ? Number(e.order) : 999,
        }))
        .sort((a, b) => a.order - b.order)
    : [],
```

並在文件頂部 export 新常量：

```js
export const IMPACT_RELATION_ENUM = ['benefit', 'impacted', 'neutral'];
export const IMPACT_RELATION_LABEL = {
    benefit: '受益',
    impacted: '受影響',
    neutral: '中性',
};
```

---

## 任務 B — 新建 `signal.html`

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>信號詳情 — 芯片情報</title>
    <meta name="description" content="單條信號的完整事實、影響鋪開、證據摘要與相關信號。">
    <link rel="stylesheet" href="css/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <main class="signal-detail-page">
        <div class="signal-detail-container">
            <div class="crumb" data-crumb>
                <a class="crumb-link" href="index.html">← 信號流</a>
            </div>

            <div id="signalDetailRoot">
                <div class="empty-state">
                    <div class="empty-state-icon">◈</div>
                    <div class="empty-state-title">載入中...</div>
                </div>
            </div>
        </div>
    </main>

    <script type="module" src="js/modules/global-nav.js"></script>
    <script type="module" src="js/modules/signal-detail.js"></script>
</body>
</html>
```

---

## 任務 C — 新建 `js/modules/signal-detail.js`

```js
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
```

---

## 任務 D — 新建 `css/pages/signal-detail.css`

```css
.signal-detail-page { padding-top: var(--s-4); padding-bottom: var(--s-12); }
.signal-detail-container {
    max-width: var(--max-reading);
    margin: 0 auto;
    padding: 0 var(--s-6);
}
```

在 `css/style.css` 追加 `@import './pages/signal-detail.css';`

---

## 任務 E — Admin 表單加入 impact_entities 編輯

### E-1：找到 `admin/admin.js` 中的 `openSignalForm` 函數（約行 770 附近）

在 sources 編輯區之後、表單關閉前，插入一個新區塊：

```html
<div class="form-group">
    <label>影響實體（最多 10 條）</label>
    <div id="fs-impact-entities-list" style="display:flex;flex-direction:column;gap:0.5rem"></div>
    <button type="button" class="btn-secondary" id="fs-add-impact-entity" style="margin-top:0.5rem">+ 新增影響實體</button>
</div>
```

### E-2：在 admin.js 加入 impact_entities 渲染與綁定

在 `openSignalForm` 函數中（modal 渲染後），加入：

```js
function renderImpactEntities(entities) {
    const list = document.getElementById('fs-impact-entities-list');
    if (!list) return;
    list.innerHTML = entities.map((e, idx) => `
        <div class="impact-entity-row" data-idx="${idx}" style="display:flex;gap:0.5rem;align-items:center">
            <input list="companyIds" value="${(e.company_id || '').replace(/"/g, '&quot;')}" placeholder="company_id" data-field="company_id" style="flex:1;padding:4px;background:var(--bg);border:1px solid var(--border);color:var(--fg)">
            <select data-field="relation" style="padding:4px;background:var(--bg);border:1px solid var(--border);color:var(--fg)">
                <option value="benefit" ${e.relation === 'benefit' ? 'selected' : ''}>受益</option>
                <option value="impacted" ${e.relation === 'impacted' ? 'selected' : ''}>受影響</option>
                <option value="neutral" ${e.relation === 'neutral' ? 'selected' : ''}>中性</option>
            </select>
            <input value="${(e.reason || '').replace(/"/g, '&quot;')}" placeholder="原因（80字內）" maxlength="80" data-field="reason" style="flex:2;padding:4px;background:var(--bg);border:1px solid var(--border);color:var(--fg)">
            <input type="number" value="${e.order || 999}" data-field="order" style="width:4rem;padding:4px;background:var(--bg);border:1px solid var(--border);color:var(--fg)">
            <button type="button" class="btn-danger" data-action="remove-entity" data-idx="${idx}" style="padding:4px 8px">×</button>
        </div>
    `).join('');
}

// Initialize datalist for company IDs
if (!document.getElementById('companyIds')) {
    const dl = document.createElement('datalist');
    dl.id = 'companyIds';
    dl.innerHTML = companiesData.map(c => `<option value="${c.id}">${c.name_en || c.id}</option>`).join('');
    document.body.appendChild(dl);
}

let currentEntities = Array.isArray(s.impact_entities) ? [...s.impact_entities] : [];
renderImpactEntities(currentEntities);

document.getElementById('fs-add-impact-entity').addEventListener('click', () => {
    if (currentEntities.length >= 10) { showToast('最多 10 條', 'error'); return; }
    currentEntities.push({ company_id: '', relation: 'benefit', reason: '', order: currentEntities.length + 1 });
    renderImpactEntities(currentEntities);
});

document.getElementById('fs-impact-entities-list').addEventListener('click', (e) => {
    if (e.target.dataset.action === 'remove-entity') {
        const idx = Number(e.target.dataset.idx);
        currentEntities.splice(idx, 1);
        renderImpactEntities(currentEntities);
    }
});

// In collectSignalForm function, collect impact_entities
window._collectImpactEntities = () => {
    return Array.from(document.querySelectorAll('.impact-entity-row')).map(row => ({
        company_id: row.querySelector('[data-field="company_id"]').value.trim(),
        relation: row.querySelector('[data-field="relation"]').value,
        reason: row.querySelector('[data-field="reason"]').value.trim(),
        order: Number(row.querySelector('[data-field="order"]').value) || 999,
    })).filter(e => e.company_id);
};
```

### E-3：在 `collectSignalForm` 函數的 return data 對象中加入：

```js
impact_entities: window._collectImpactEntities ? window._collectImpactEntities() : [],
```

---

## 驗收

1. `npm run build` 通過
2. `node --test tests/*.test.js` → **90/90**
3. 視覺檢查：
   - 訪問 `signal.html?id=<某現有信號ID>` 顯示完整 5 個區塊
   - 信號無 impact_entities 時顯示「暫無影響分析」
   - 點公司鏈接跳對應 company.html?id=（Phase 30 才會渲染）
   - 麵包屑顯示來源頁
4. Admin 測試：
   - 編輯一條信號，加入 3 條 impact_entities
   - 保存後刷新，能看到 3 條
   - signal.html 顯示影響鋪開
5. Commit：
   ```
   feat(redesign): phase 29 — signal detail page + impact_entities schema
   ```
6. `git push origin main`

## 完成後回報

- 給 NVIDIA H200 信號加入 5 條 impact_entities（範例：TSMC/Ajinomoto/SK_Hynix/Ibiden/AMD），確認頁面渲染
- 信號 history 區塊是否正常顯示
