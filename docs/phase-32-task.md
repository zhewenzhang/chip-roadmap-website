# Phase 32 任務指令 — Insights 敘事頁

> 項目路徑：`D:\chip-roadmap-website`
> 前置：Phase 31 完成
> 範圍：insights.html 重寫為敘事報告流
> 工期：3 工作日
> Spec：§ 8.5

---

## 任務 A — 重寫 `insights.html`

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>行業洞察 — 芯片情報</title>
    <meta name="description" content="基於信號數據派生的趨勢報告與行業洞察。">
    <link rel="stylesheet" href="css/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <main class="insights-page">
        <div class="insights-container">
            <header class="page-head">
                <div class="page-head-inner">
                    <div class="page-head-eyebrow">INSIGHTS / ANALYSIS</div>
                    <h1 class="page-head-title">行業洞察</h1>
                    <p class="page-head-meta">敘事性趨勢報告 · 最新更新 <span id="lastInsightDate">—</span></p>
                </div>
            </header>

            <div class="filter-bar">
                <button class="filter-btn active" data-period="weekly">本週</button>
                <button class="filter-btn" data-period="monthly">本月</button>
                <button class="filter-btn" data-period="company_snapshot">公司快照</button>
            </div>

            <div id="insightsRoot">
                <div class="empty-state"><div class="empty-state-icon">◈</div><div class="empty-state-title">載入中...</div></div>
            </div>
        </div>
    </main>
    <script type="module" src="js/modules/global-nav.js"></script>
    <script type="module" src="js/modules/insights-page.js"></script>
</body>
</html>
```

---

## 任務 B — 新建 `js/modules/insights-page.js`

```js
/**
 * Insights page — Phase 32
 * Reads from new insights collection schema (defined by OpenClaw Insight Agent).
 * Falls back to derived insights from signals if no Firestore insights exist.
 */
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { loadSignals, loadCompanies } from '../firebase/db.js';
import { IMPACT_LABEL, STAGE_LABEL } from './signals-schema.js';

let currentPeriod = 'weekly';

function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function formatDate(iso) {
    if (!iso) return '—';
    const d = iso.toDate ? iso.toDate() : new Date(iso);
    return d.toISOString().slice(0, 10);
}

async function loadInsightsByType(type) {
    try {
        const q = query(
            collection(db, 'insights'),
            where('type', '==', type),
            orderBy('generated_at', 'desc'),
            limit(10)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn('[Insights] query failed, falling back:', err.message);
        return [];
    }
}

function renderMarkdown(md) {
    // Minimal markdown: headings, bold, italic, links, lists
    if (!md) return '';
    let html = esc(md);
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h2 class="insight-h1">$1</h2>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.split(/\n\n+/).map(p => p.trim().startsWith('<') ? p : `<p>${p}</p>`).join('\n');
    return html;
}

function renderInsight(insight) {
    const body = renderMarkdown(insight.body_md || '');
    return `<article class="insight-card">
        <div class="insight-card-meta">
            <span class="badge badge-region">${esc(insight.type)}</span>
            <span>${formatDate(insight.generated_at || insight.createdAt)}</span>
            <span>${insight.signal_count || 0} 條信號分析</span>
        </div>
        <h2 class="insight-card-title">${esc(insight.summary || '無摘要')}</h2>
        <div class="insight-card-body">${body}</div>
    </article>`;
}

async function renderDerivedFallback() {
    const [sResult, cMap] = await Promise.all([loadSignals(), loadCompanies()]);
    const signals = sResult.ok ? sResult.data : [];
    const since = Date.now() - 7 * 86400000;
    const recent = signals.filter(s => new Date(s.updatedAt || 0).getTime() > since);

    const explosive = recent.filter(s => s.abf_demand_impact === 'explosive');
    const high = recent.filter(s => s.abf_demand_impact === 'high');
    const byCompany = {};
    recent.forEach(s => {
        byCompany[s.company_id] = (byCompany[s.company_id] || 0) + 1;
    });
    const topCompanies = Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return `<article class="insight-card">
        <div class="insight-card-meta">
            <span class="badge badge-region">DERIVED</span>
            <span>${new Date().toISOString().slice(0, 10)}</span>
            <span>${recent.length} 條本週信號</span>
        </div>
        <h2 class="insight-card-title">本週信號摘要（自動派生）</h2>
        <div class="insight-card-body">
            <p>本週收錄 <strong>${recent.length}</strong> 條信號，其中：</p>
            <ul>
                <li>爆發性影響：<strong>${explosive.length}</strong> 條</li>
                <li>高影響：<strong>${high.length}</strong> 條</li>
            </ul>
            <h3>最活躍公司</h3>
            <ul>${topCompanies.map(([id, count]) => `<li><a class="entity-link entity-company" href="company.html?id=${id}"><span class="entity-icon"></span>${esc(cMap[id]?.name_en || id)}</a>：${count} 條</li>`).join('')}</ul>
            ${explosive.length ? `<h3>爆發性影響信號</h3><ul>${explosive.slice(0, 5).map(s => `<li><a href="signal.html?id=${encodeURIComponent(s.id)}" style="color:var(--fg);text-decoration:none">⚡ ${esc(s.title)}</a></li>`).join('')}</ul>` : ''}
            <p style="margin-top:1.5rem;color:var(--fg-muted);font-size:var(--t-xs);font-style:italic">提示：OpenClaw Insight Agent 上線後，將自動產生更豐富的敘事報告，取代此處派生內容。</p>
        </div>
    </article>`;
}

async function render() {
    const root = document.getElementById('insightsRoot');
    root.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◈</div><div class="empty-state-title">載入中...</div></div>`;

    const insights = await loadInsightsByType(currentPeriod);

    if (insights.length === 0) {
        // Fallback to derived
        const derivedHtml = await renderDerivedFallback();
        root.innerHTML = derivedHtml;
        document.getElementById('lastInsightDate').textContent = new Date().toISOString().slice(0, 10);
        return;
    }

    root.innerHTML = insights.map(renderInsight).join('');
    document.getElementById('lastInsightDate').textContent = formatDate(insights[0].generated_at || insights[0].createdAt);
}

function init() {
    document.querySelectorAll('.filter-btn[data-period]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn[data-period]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            render();
        });
    });
    render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
```

---

## 任務 C — 新建 `css/pages/insights.css`

```css
.insights-page { padding-top: var(--s-4); padding-bottom: var(--s-12); }
.insights-container {
    max-width: var(--max-reading);
    margin: 0 auto;
    padding: 0 var(--s-6);
}
.insight-card {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    padding: var(--s-6);
    margin-bottom: var(--s-6);
}
.insight-card-meta {
    display: flex;
    gap: var(--s-3);
    font-size: var(--t-xs);
    color: var(--fg-muted);
    margin-bottom: var(--s-3);
    align-items: center;
}
.insight-card-title {
    font-size: var(--t-lg);
    margin-bottom: var(--s-4);
    line-height: 1.4;
}
.insight-card-body {
    line-height: 1.7;
    color: var(--fg-dim);
}
.insight-card-body h2 {
    font-size: var(--t-md);
    margin: var(--s-4) 0 var(--s-2);
    color: var(--fg);
}
.insight-card-body h3 {
    font-size: var(--t-sm);
    margin: var(--s-3) 0 var(--s-2);
    color: var(--fg);
}
.insight-card-body p { margin-bottom: var(--s-3); }
.insight-card-body ul {
    margin: var(--s-2) 0 var(--s-3) var(--s-6);
    padding: 0;
}
.insight-card-body li { padding: var(--s-1) 0; }
.insight-card-body a { color: var(--fg); text-decoration: underline; }
.insight-card-body strong { color: var(--fg); }
.insight-card-body em { color: var(--accent); }
```

在 `style.css` 追加 `@import './pages/insights.css';`

---

## 任務 D — 整合與最終清理

### D-1：移除遺留的 backward-compat token

從 `css/tokens.css` 找到並刪除整個「DEPRECATED」區塊（Phase 25 為了平滑遷移留下的）。

如果有任何頁面或組件還在使用 `--color-fg / --color-bg / --color-border / --text-primary` 等，搜尋並全部替換成新 token。

### D-2：移除舊的 CSS 廢碼

從 `css/style.css` 搜尋並刪除：
- `.hero` 開頭的所有規則
- `.companies-header` 開頭的所有規則
- `.roadmap-header` 開頭的所有規則
- `.entity-header` 開頭的所有規則
- `.signals-header` 開頭的所有規則
- `.hero-v2` 已在 Phase 25 刪除（確認）

### D-3：style.css 最終 import 列表確認

`css/style.css` 應該只包含：

```css
/*
 * Supply Chain Intelligence Terminal — Public Site Design System
 * Phase 25-32: Signal-First Reader Experience
 */

@import './tokens.css';
@import './reset.css';
@import './typography.css';
@import './layout.css';

/* Components */
@import './components/signal-card.css';
@import './components/signal-hero.css';
@import './components/kv-table.css';
@import './components/impact-tree.css';
@import './components/badge.css';
@import './components/filter-bar.css';
@import './components/section.css';
@import './components/empty-state.css';
@import './components/crumb.css';
@import './components/watch-btn.css';
@import './components/entity-link.css';
@import './components/navbar-v2.css';
@import './components/cmdk.css';
@import './components/watch-drawer.css';
@import './components/page-head.css';

/* Pages */
@import './pages/home.css';
@import './pages/signal-detail.css';
@import './pages/companies.css';
@import './pages/entity-detail.css';
@import './pages/roadmap.css';
@import './pages/insights.css';
```

所有其他 CSS 規則（之前留在 style.css 底部的 legacy）**全部刪除**。

### D-4：檢查所有頁面視覺一致性

逐一打開：
1. index.html
2. signal.html?id=<某ID>
3. companies.html
4. company.html?id=nvidia
5. chip.html?name=H200 SXM5
6. roadmap.html
7. insights.html
8. admin/index.html

確認：
- 所有頁面 page-head 樣式一致
- 所有 badge 顏色一致
- 所有 section 邊框、padding 一致
- 移動端 (375px) 所有頁面正常

---

## 驗收

1. `npm run build` 通過（注意：刪除 legacy CSS 後 bundle size 應變小）
2. `node --test tests/*.test.js` → **90/90**
3. 視覺檢查：8 個頁面樣式統一
4. 性能檢查：
   - bundle CSS 應比 Phase 24 小至少 20%
   - 首頁 LCP < 2s
5. Commit：
   ```
   feat(redesign): phase 32 — insights narrative page + final cleanup
   ```
6. `git push origin main`

## 完成後回報

- 移除了多少行 legacy CSS（git diff stats）
- 8 個頁面截圖對比（Phase 24 前後）
- 是否還有任何視覺不一致的地方
- bundle CSS 大小變化
