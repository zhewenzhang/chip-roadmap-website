# Phase 26 任務指令 — 11 個 Primitive 組件

> 項目路徑：`D:\chip-roadmap-website`
> 前置：Phase 25 完成
> 範圍：純 CSS 新組件，**視覺零變化**（組件先建，後續 Phase 才應用）
> 工期：3 工作日
> Spec：`docs/superpowers/specs/2026-05-15-frontend-redesign-design.md` § 6.3

---

## 核心原則

這個 Phase 只**建組件**，不**應用組件**到頁面。視覺仍跟 Phase 25 相同。

---

## 11 個組件清單

每個組件一個 CSS 文件，全部放 `css/components/`。

| 文件 | 組件 | 用途 |
|------|------|------|
| signal-card.css   | `.signal-card`     | 信號摘要卡片 |
| signal-hero.css   | `.signal-hero`     | 信號詳情頁頂部 |
| kv-table.css      | `.kv-table`        | Key-Value 兩欄表 |
| impact-tree.css   | `.impact-tree`     | 影響鋪開樹（文字版） |
| badge.css         | `.badge`           | 5 種變體徽章 |
| filter-bar.css    | `.filter-bar`      | 篩選列 |
| section.css       | `.section`         | 內容區塊容器 |
| empty-state.css   | `.empty-state`     | 空狀態 |
| crumb.css         | `.crumb`           | 智能麵包屑 |
| watch-btn.css     | `.watch-btn`       | 關注按鈕 |
| entity-link.css   | `.entity-link`     | 公司◆/芯片◇統一鏈接 |

---

## 任務 A — 建 11 個組件文件

### `css/components/signal-card.css`
```css
.signal-card {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    padding: var(--s-4) var(--s-6);
    margin-bottom: var(--s-4);
    transition: var(--transition);
}
.signal-card:hover {
    border-color: var(--border-bright);
    background: var(--bg-hover);
}
.signal-card-badges { display: flex; gap: var(--s-2); margin-bottom: var(--s-2); }
.signal-card-title {
    font-size: var(--t-md);
    color: var(--fg);
    margin-bottom: var(--s-2);
    line-height: 1.3;
}
.signal-card-meta {
    font-size: var(--t-xs);
    color: var(--fg-muted);
    margin-bottom: var(--s-3);
    letter-spacing: 0.02em;
}
.signal-card-meta span + span::before { content: ' · '; color: var(--border); margin: 0 var(--s-1); }
.signal-card-body {
    font-size: var(--t-sm);
    color: var(--fg-dim);
    line-height: 1.6;
    margin-bottom: var(--s-3);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.signal-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--t-xs);
    color: var(--fg-muted);
    border-top: 1px solid var(--border);
    padding-top: var(--s-2);
}
.signal-card-impact-hook { color: var(--accent); }
.signal-card-cta { color: var(--fg); }
.signal-card-cta:hover { text-shadow: var(--glow); }
```

### `css/components/signal-hero.css`
```css
.signal-hero {
    border: 2px solid var(--border-bright);
    background: var(--bg-panel);
    padding: var(--s-8);
    margin-bottom: var(--s-8);
    box-shadow: var(--glow);
}
.signal-hero-title {
    font-size: var(--t-xl);
    color: var(--fg);
    margin-bottom: var(--s-4);
}
.signal-hero-badges { display: flex; gap: var(--s-2); margin-bottom: var(--s-3); flex-wrap: wrap; }
.signal-hero-meta {
    font-size: var(--t-sm);
    color: var(--fg-muted);
    letter-spacing: 0.03em;
}
```

### `css/components/kv-table.css`
```css
.kv-table { width: 100%; border-collapse: collapse; }
.kv-table-row {
    display: flex;
    padding: var(--s-2) 0;
    border-bottom: 1px solid var(--border);
    font-size: var(--t-sm);
}
.kv-table-row:last-child { border-bottom: none; }
.kv-table-label {
    color: var(--fg-muted);
    flex: 0 0 8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: var(--t-xs);
}
.kv-table-value {
    color: var(--fg);
    flex: 1;
    word-break: break-word;
}
```

### `css/components/impact-tree.css`
```css
.impact-tree {
    font-family: var(--font-mono);
    font-size: var(--t-sm);
    line-height: 1.8;
    padding: var(--s-4);
    background: var(--bg-panel);
    border: 1px solid var(--border);
}
.impact-tree-root {
    color: var(--fg);
    margin-bottom: var(--s-3);
    padding-left: var(--s-2);
}
.impact-tree-branches { padding-left: var(--s-4); }
.impact-tree-branch {
    display: flex;
    align-items: baseline;
    gap: var(--s-2);
    padding: var(--s-1) 0;
}
.impact-tree-connector { color: var(--border); flex-shrink: 0; }
.impact-tree-target { color: var(--fg); min-width: 8rem; }
.impact-tree-reason { color: var(--fg-dim); flex: 1; }
.impact-tree-relation { font-size: var(--t-xs); padding: 0 var(--s-2); }
.impact-tree-relation-benefit { color: var(--fg); }
.impact-tree-relation-impacted { color: var(--accent); }
.impact-tree-relation-neutral { color: var(--fg-muted); }
.impact-tree-summary {
    margin-top: var(--s-3);
    padding-top: var(--s-3);
    border-top: 1px dashed var(--border);
    color: var(--fg-dim);
    font-size: var(--t-xs);
}
.impact-tree-empty {
    color: var(--fg-muted);
    font-style: italic;
    text-align: center;
    padding: var(--s-6);
}
```

### `css/components/badge.css`
```css
.badge {
    display: inline-block;
    padding: var(--s-1) var(--s-2);
    font-size: var(--t-xs);
    font-family: var(--font-mono);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border: 1px solid currentColor;
    line-height: 1;
}

/* impact variants */
.badge-impact-explosive { color: #33ff00; }
.badge-impact-high      { color: #33ff00; opacity: 0.75; }
.badge-impact-medium    { color: #ffb000; }
.badge-impact-low       { color: var(--fg-muted); }

/* stage variants */
.badge-stage-rumor      { color: var(--fg-muted); }
.badge-stage-announced  { color: var(--fg-dim); }
.badge-stage-sampling   { color: var(--accent); }
.badge-stage-design_win { color: var(--accent); }
.badge-stage-pilot      { color: var(--fg); }
.badge-stage-ramp       { color: var(--fg); font-weight: 700; }
.badge-stage-volume     { color: var(--fg); font-weight: 700; background: rgba(51,255,0,0.1); }

/* status variants */
.badge-status-draft       { color: var(--fg-muted); }
.badge-status-watch       { color: var(--accent); }
.badge-status-verified    { color: var(--fg); }
.badge-status-downgraded  { color: var(--fg-dim); }
.badge-status-invalidated { color: var(--danger); }
.badge-status-archived    { color: var(--fg-muted); opacity: 0.6; }

/* region/confidence (neutral) */
.badge-region { color: var(--fg-muted); }
.badge-confidence { color: var(--fg-dim); }
```

### `css/components/filter-bar.css`
```css
.filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
    padding: var(--s-3) 0;
    margin-bottom: var(--s-6);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    align-items: center;
    font-size: var(--t-sm);
}
.filter-group { display: flex; gap: var(--s-1); }
.filter-divider {
    width: 1px;
    height: 1.5rem;
    background: var(--border);
    margin: 0 var(--s-2);
}
.filter-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg-muted);
    padding: var(--s-1) var(--s-3);
    font-family: var(--font-mono);
    font-size: var(--t-xs);
    cursor: pointer;
    text-transform: uppercase;
    transition: var(--transition);
}
.filter-btn:hover { color: var(--fg); border-color: var(--fg-dim); }
.filter-btn.active {
    color: var(--bg);
    background: var(--fg);
    border-color: var(--fg);
}
.filter-select {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--fg);
    padding: var(--s-1) var(--s-2);
    font-family: var(--font-mono);
    font-size: var(--t-xs);
}
```

### `css/components/section.css`
```css
.section {
    margin-bottom: var(--s-8);
    border: 1px solid var(--border);
    background: var(--bg-panel);
}
.section-title-bar {
    padding: var(--s-3) var(--s-4);
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.section-title {
    font-size: var(--t-sm);
    color: var(--fg);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
}
.section-action {
    font-size: var(--t-xs);
    color: var(--fg-muted);
    text-decoration: none;
}
.section-action:hover { color: var(--fg); }
.section-body { padding: var(--s-4); }
```

### `css/components/empty-state.css`
```css
.empty-state {
    text-align: center;
    padding: var(--s-12) var(--s-6);
    color: var(--fg-muted);
}
.empty-state-icon {
    font-size: var(--t-3xl);
    color: var(--fg-dim);
    margin-bottom: var(--s-4);
}
.empty-state-title {
    font-size: var(--t-md);
    color: var(--fg);
    margin-bottom: var(--s-2);
}
.empty-state-sub {
    font-size: var(--t-sm);
    line-height: 1.6;
    margin-bottom: var(--s-4);
}
.empty-state-cta {
    display: inline-block;
    border: 1px solid var(--fg);
    color: var(--fg);
    padding: var(--s-2) var(--s-4);
    text-decoration: none;
    text-transform: uppercase;
    font-size: var(--t-xs);
    letter-spacing: 0.05em;
}
.empty-state-cta:hover { background: var(--fg); color: var(--bg); }
```

### `css/components/crumb.css`
```css
.crumb {
    padding: var(--s-3) 0;
    font-size: var(--t-xs);
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.crumb-link {
    color: var(--fg-dim);
    text-decoration: none;
    transition: var(--transition);
}
.crumb-link:hover { color: var(--fg); }
.crumb-separator { margin: 0 var(--s-2); color: var(--border); }
```

### `css/components/watch-btn.css`
```css
.watch-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg-muted);
    padding: var(--s-2) var(--s-3);
    font-family: var(--font-mono);
    font-size: var(--t-xs);
    cursor: pointer;
    transition: var(--transition);
    text-transform: uppercase;
}
.watch-btn:hover { color: var(--accent); border-color: var(--accent); }
.watch-btn.active { color: var(--accent); border-color: var(--accent); }
.watch-btn-lg { padding: var(--s-3) var(--s-6); font-size: var(--t-sm); }
```

### `css/components/entity-link.css`
```css
.entity-link {
    color: var(--fg);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: var(--s-1);
    transition: var(--transition);
}
.entity-link:hover { text-shadow: var(--glow); }
.entity-icon { color: var(--fg-dim); font-size: 0.9em; }
.entity-company .entity-icon::before { content: '◆'; }
.entity-chip .entity-icon::before { content: '◇'; }
```

---

## 任務 B — 在 `css/style.css` 註冊新組件

在 `css/style.css` 的 import 區塊（Phase 25 建立的）追加：

```css
@import './tokens.css';
@import './reset.css';
@import './typography.css';
@import './layout.css';

/* Components (Phase 26) */
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

/* Legacy styles below — migration in Phase 27-32 */
```

---

## 驗收

1. `npm run build` → 通過
2. `node --test tests/*.test.js` → **90/90**
3. 視覺檢查：8 個頁面 desktop + mobile 跟 Phase 25 一致（**新組件未應用，舊樣式仍生效**）
4. 在瀏覽器控制台執行 `getComputedStyle(document.documentElement).getPropertyValue('--s-4')` 應返回 `1rem`
5. Commit：
   ```
   feat(redesign): phase 26 — 11 primitive components (CSS only, not yet applied)
   ```
6. `git push origin main`

## 完成後回報

- 列出 11 個組件文件路徑
- 確認 8 個頁面視覺無變化
