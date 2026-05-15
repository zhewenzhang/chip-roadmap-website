# Phase 25 任務指令 — 設計系統地基

> 項目路徑：`D:\chip-roadmap-website`
> 前置：90/90 tests ✓，build ✓
> 範圍：純 CSS 重構，**視覺零變化**
> 工期：2 工作日
> Spec：`docs/superpowers/specs/2026-05-15-frontend-redesign-design.md` § 6

---

## 核心原則

這個 Phase 完成後，**所有頁面看起來必須跟現在一模一樣**。我們只是把基礎重新組織。

---

## 任務 A — 新建 `css/tokens.css`

```css
/*
 * Design tokens — Single source of truth for colors, spacing, typography.
 * Phase 25: Frontend Redesign Foundation
 */

:root {
    /* ============ Colors ============ */
    --bg:            #0a0a0a;
    --bg-panel:      #0d0d0d;
    --bg-hover:      #1a2e1a;
    --fg:            #33ff00;
    --fg-dim:        #22aa00;
    --fg-muted:      #888888;
    --accent:        #ffb000;
    --accent-dim:    #cc8800;
    --danger:        #ff3333;
    --border:        #1f521f;
    --border-bright: #33ff00;

    /* ============ Spacing scale (4px base, REM ONLY) ============ */
    --s-0:  0;
    --s-1:  0.25rem;   /* 4px */
    --s-2:  0.5rem;    /* 8px */
    --s-3:  0.75rem;   /* 12px */
    --s-4:  1rem;      /* 16px */
    --s-5:  1.25rem;   /* 20px */
    --s-6:  1.5rem;    /* 24px */
    --s-8:  2rem;      /* 32px */
    --s-10: 2.5rem;    /* 40px */
    --s-12: 3rem;      /* 48px */
    --s-16: 4rem;      /* 64px */
    --s-20: 5rem;      /* 80px */

    /* ============ Typography scale ============ */
    --t-xs:   0.75rem;
    --t-sm:   0.875rem;
    --t-base: 1rem;
    --t-md:   1.125rem;
    --t-lg:   1.375rem;
    --t-xl:   1.75rem;
    --t-2xl:  2.25rem;
    --t-3xl:  3rem;

    /* ============ Layout ============ */
    --max-content: 72rem;   /* 1152px */
    --max-reading: 48rem;   /* 768px */
    --sidebar-w:   20rem;   /* 320px */
    --nav-h:       4rem;    /* 64px */

    /* ============ Effects ============ */
    --font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
    --glow:      0 0 5px rgba(51, 255, 0, 0.35);
    --glow-accent: 0 0 5px rgba(255, 176, 0, 0.35);
    --transition: 100ms ease;

    /* ============ DEPRECATED — kept for migration only ============ */
    /* These will be removed in a future Phase. Do not use in new code. */
    --color-bg: var(--bg);
    --color-fg: var(--fg);
    --color-muted: var(--bg-panel);
    --color-muted-fg: var(--fg-muted);
    --color-border: var(--border);
    --color-invert-bg: var(--fg);
    --color-invert-fg: var(--bg);
    --text-primary: var(--fg);
    --text-secondary: var(--fg-muted);
    --text-muted: #555555;
    --border-color: var(--border);
}
```

---

## 任務 B — 移除 `style.css` 中的廢碼

從 `css/style.css` 找到並**完全刪除**以下選擇器及其規則：

1. 第 1-40 行附近的 `:root { ... }` 區塊（已被 `tokens.css` 取代）
2. 搜尋並刪除 `.hero-v2` 開頭的所有規則（中途棄置）
3. 保留 `.hero`、`.companies-header`、`.roadmap-header`、`.entity-header`、`.signals-header` 不動（Phase 28-31 才會逐步替換）

---

## 任務 C — 拆分 CSS 文件

新建以下空文件（內容後續 Phase 填充）：

```
css/
├── tokens.css           ← 任務 A 已建
├── reset.css            ← 新建
├── typography.css       ← 新建
├── layout.css           ← 新建
├── components/          ← 新建目錄
│   └── .gitkeep
├── pages/               ← 新建目錄
│   └── .gitkeep
└── style.css            ← 修改（任務 D）
```

### `css/reset.css`
```css
/* Reset & base — extracted from style.css Phase 25 */
*, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border-radius: 0 !important;
}

html { scroll-behavior: smooth; }

body {
    font-family: var(--font-mono);
    background: var(--bg);
    color: var(--fg);
    line-height: 1.5;
    min-height: 100vh;
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

::selection {
    background: var(--fg);
    color: var(--bg);
}
```

### `css/typography.css`
```css
/* Typography — extracted from style.css Phase 25 */
h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--fg);
    line-height: 1.2;
    text-shadow: var(--glow);
}

h1 { font-size: var(--t-xl); letter-spacing: 0.05em; text-transform: uppercase; }
h2 { font-size: var(--t-md); letter-spacing: 0.03em; text-transform: uppercase; }
h3 { font-size: var(--t-sm); }
```

### `css/layout.css`
```css
/* Layout primitives — Phase 25 */
.container {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: 0 var(--s-6);
}
```

---

## 任務 D — 改寫 `css/style.css` 為 import 入口

完整替換 `css/style.css` 文件**前 40 行**（替換掉舊的 `:root` 區塊）為：

```css
/*
 * Supply Chain Intelligence Terminal — Public Site Design System
 * Phase 25: Modular CSS architecture
 */

@import './tokens.css';
@import './reset.css';
@import './typography.css';
@import './layout.css';

/* Legacy styles below — being migrated to components/ and pages/ in Phase 26-32 */
```

**保留其餘部分不動**（h1/h2/h3 的舊規則會與 typography.css 衝突，但 typography.css 用了相同的選擇器和值，CSS cascade 會處理。確認視覺一致即可。）

---

## 任務 E — Vite build 配置確認

打開 `vite.config.js` 或 `vite.config.ts`（若存在），確保 CSS @import 順序保留。通常 Vite 預設處理 OK，不需修改。若有 issue，加：

```js
export default {
    css: { preprocessorOptions: { /* keep as is */ } }
}
```

---

## 驗收

1. `npm run build` 通過
2. `node --test tests/*.test.js` → **90/90 pass**
3. 視覺檢查（**最關鍵**）：以下頁面 desktop + mobile 必須跟 Phase 24 完成時一模一樣：
   - `index.html`
   - `companies.html`
   - `roadmap.html`
   - `insights.html`
   - `signals.html`
   - `company-signals.html?id=nvidia`
   - `chip-signals.html?name=H100 SXM5`
   - `admin/index.html`
4. Commit：
   ```
   feat(redesign): phase 25 — design system foundation (tokens + CSS split)
   ```
5. `git push origin main`

## 完成後回報

- 列出新建的所有 CSS 文件路徑
- 確認 8 個頁面視覺零變化（用 screenshot 對比或自我檢查）
- 若有任何 visual diff，明確列出
