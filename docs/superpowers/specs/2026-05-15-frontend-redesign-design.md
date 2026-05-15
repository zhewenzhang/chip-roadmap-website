# 前端重設計規格 — Signal-First Reader Experience

> 日期：2026-05-15
> 範圍：chip-roadmap-website 全前端重構（8 個頁面）
> 工期：4-5 週（8 個 phase，可部分並行）
> 核心原則：Signal → Impact → Action

---

## 1. 問題陳述

當前產品已被付費用戶認可，但每個頁面像獨立產品。具體表現：

1. **5 種不同的 page header 模式**（.hero / .companies-header / .roadmap-header / .entity-header / .signals-header）
2. **沒有單條信號的詳情頁** — 只有抽屜，無法分享 URL，無展開「影響分析」的空間
3. **頁面之間缺乏聯動** — 用戶從一頁跳到另一頁不知道為什麼要跳
4. **沒有清晰的主軸** — 「首頁」是一般介紹頁，不是核心工作流入口
5. **CSS 4435 行單檔，px/rem 混用，backward-compat token 累積**

---

## 2. 產品框架

**核心動作（確認）：** 用戶最高頻打開平台 = 瀏覽最新可信信號流  
**核心價值（確認）：** 用戶看到信號後，最想知道「這條信號的供應鏈影響」  
**整體 DNA：** Signal（信號）→ Impact（影響）→ Action（決策）

---

## 3. 信息架構（IA）

### 3.1 重組後頁面結構

```
🏠 信號流          index.html                  ← 重做為主軸頁面
📄 信號詳情（新）  signal.html?id=xxx          ← 新建頁面
🏢 公司目錄        companies.html              ← 重設計
   ├─ 公司詳情     company.html?id=xxx         ← 重命名自 company-signals.html
   └─ 芯片詳情     chip.html?name=xxx          ← 重命名自 chip-signals.html
🗺️ 路線圖          roadmap.html               ← 重設計
📊 行業洞察        insights.html               ← 重設計
⚙️ Admin           admin/                      ← 不動
```

**砍掉：** 獨立的芯片索引頁（chips.html）。芯片只能從公司詳情頁進入或直接 URL。  
**砍掉：** 舊的 signals.html（功能合併進 index.html）。

### 3.2 用戶路徑

```
路徑 A（最高頻）：信號流 → 信號詳情 → 公司/芯片詳情 → 信號流
路徑 B（探索型）：公司目錄 → 公司詳情 → 點某條信號 → 信號詳情
路徑 C（時間型）：路線圖 → 信號詳情 → 路線圖
```

---

## 4. 信號流首頁（index.html）

### 4.1 版面（雙欄）

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Navbar：◆ 芯片情報 信號流 公司 路線圖 洞察    [⌘K 搜尋] [關注 12]            │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌─主欄（70%）─────────────────────────┐ ┌─Sidebar（30%）────────┐           │
│ │ 摘要條：30 verified · 5 explosive   │ │ 我的關注              │           │
│ │ 篩選列：[全部][今日][7天] 影響 階段 │ │   ◆ NVIDIA   ●3        │           │
│ │ ──                                  │ │   ◆ AMD      ●1        │           │
│ │ ┌─Signal Card──────────────────┐   │ │   ◇ H200     ●2        │           │
│ │ │ [explosive][volume]          │   │ │ ──                     │           │
│ │ │ NVIDIA H200 SXM5 量產        │   │ │ 高影響信號            │           │
│ │ │ NVIDIA / H200 · 2024 Q2 ...  │   │ │   ⚡ H200 量產         │           │
│ │ │ 證據摘要 2-3 行...           │   │ │   ⚡ B200 ramp         │           │
│ │ │ confidence 92 · 5h · 來源    │   │ │ ──                     │           │
│ │ │ 影響→ SK Hynix · Ajinomoto   │   │ │ 本週新增              │           │
│ │ └──────────────────────────────┘   │ │   +5 verified         │           │
│ │ ... 更多卡片 ...                    │ │   +3 watch            │           │
│ │ 載入更多 (10 條/頁)                 │ │                        │           │
│ └─────────────────────────────────────┘ └────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────────────┘

Mobile：sidebar 收起為「☰ 關注 (12)」按鈕，抽屜展開
```

### 4.2 信號卡片（核心組件）5 個信息層

1. **徽章層**：影響等級 badge + 階段 badge
2. **標題層**：信號標題（30字以內）
3. **Metadata 層**：公司 · 芯片 · 時間 · 封裝 · ABF · HBM
4. **證據層**：evidence_summary 截斷至 2-3 行
5. **Hook 層**：confidence + 驗證時間 + 主要來源 + `影響→ 公司A 公司B 公司C` + `詳情→`

### 4.3 篩選邏輯

預設可見：時間（全部/今日/7天）、影響、階段、公司  
進階篩選收進抽屜：confidence range、region、signal_type、has_conflicting_evidence

### 4.4 砍掉的元素

- 舊的「hero + 介紹文字」（產品已驗證，不需 sell）
- CRT 掃描線特效（讓內容讀起來舒服）
- 12 個 sidebar widget 拼湊（整合為 3 個有意義的）

---

## 5. 信號詳情頁（signal.html，新建）

### 5.1 版面結構（單欄，max-width 48rem）

```
← 信號流 [referrer-aware]              [關注] [分享]

╔══════ Signal Hero ══════════════════════════════════╗
║ 標題                                                ║
║ [影響徽章][階段徽章][狀態徽章] confidence X        ║
║ release · package · ABF · HBM · volume              ║
╚═════════════════════════════════════════════════════╝

A. 信號事實（KV-Table）
B. 影響鋪開（impact-tree，差異化核心）
C. 證據摘要 + 衝突證據
D. 相關信號（同公司/同芯片/同主題各 3 條）
E. 信號歷史（status/confidence 變更時間軸）
```

### 5.2 「影響鋪開」區塊（核心差異化）

```
[ H200 量產 ]
    │
    ├──→ TSMC          CoWoS-S 產能吃緊        [受益]
    ├──→ Ajinomoto     ABF 16L 需求增加        [受益]
    ├──→ SK Hynix      HBM3E 獨家供應          [受益]
    ├──→ Ibiden        ABF 基板訂單增加        [受益]
    └──→ AMD MI300X    競爭壓力                [受影響]

ABF 需求估算：+200K 基板/季 · CoWoS 月產能 +20%
```

**數據來源（MVP）：** 人工填寫 `impact_entities[]` 字段 + 規則模板補全  
**Schema 補丁：** signals 文件加入 `impact_entities: [{company_id, relation: "benefit"|"impacted", reason: string}]`  
**Admin UI 改動：** Admin signal 編輯表單加入「影響實體」管理區

### 5.3 相關信號自動推導

同 `company_id` 取 3 條 + 同 `chip_name` 取 3 條 + 同 `abf_demand_impact` 取 3 條，去重後限 9 條。

---

## 6. 設計系統

### 6.1 Tokens（取代當前 4435 行單檔）

```css
:root {
  /* Colors */
  --bg: #0a0a0a;
  --bg-panel: #0d0d0d;
  --bg-hover: #1a2e1a;
  --fg: #33ff00;
  --fg-dim: #22aa00;
  --fg-muted: #888;
  --accent: #ffb000;
  --danger: #ff3333;
  --border: #1f521f;
  --border-bright: #33ff00;

  /* Spacing scale (4px base, REM ONLY) */
  --s-1: 0.25rem; --s-2: 0.5rem; --s-3: 0.75rem; --s-4: 1rem;
  --s-6: 1.5rem;  --s-8: 2rem;   --s-12: 3rem;   --s-16: 4rem;

  /* Typography scale */
  --t-xs: 0.75rem; --t-sm: 0.875rem; --t-base: 1rem;
  --t-md: 1.125rem; --t-lg: 1.375rem; --t-xl: 1.75rem; --t-2xl: 2.25rem;

  /* Layout */
  --max-content: 72rem;
  --max-reading: 48rem;
  --sidebar-w: 20rem;
  --nav-h: 4rem;
}
```

**砍掉：** 所有 `--color-*` backward-compat token。代碼裡的引用全部替換。

### 6.2 統一頁面 header

唯一允許的 page header：

```html
<header class="page-head">
  <div class="page-head-inner">
    <div class="page-head-eyebrow">SECTION_NAME / TYPE</div>
    <h1 class="page-head-title">頁面標題</h1>
    <p class="page-head-meta">輔助信息</p>
  </div>
</header>
```

砍掉：.hero / .hero-v2 / .companies-header / .roadmap-header / .entity-header / .signals-header

### 6.3 10 個 primitive 組件

| 組件 | 用途 | 出現頁面 |
|------|------|---------|
| `signal-card` | 信號摘要卡片 | 首頁、公司詳情、芯片詳情、信號詳情（相關信號區） |
| `signal-hero` | 信號詳情頁頂部摘要 | 信號詳情 |
| `kv-table` | Key-Value 兩欄表 | 信號詳情、公司詳情、芯片詳情 |
| `impact-tree` | 影響鋪開樹（文字） | 信號詳情 |
| `badge` | 5 種變體（impact/stage/status/region/confidence） | 全站 |
| `filter-bar` | 篩選列 | 首頁、公司目錄、洞察 |
| `section` | 內容區塊容器 | 全站 |
| `empty-state` | 空狀態（icon+title+sub+CTA） | 全站 |
| `crumb` | 麵包屑（帶 referrer 智能） | 詳情頁 |
| `watch-btn` | 關注按鈕（2 種尺寸） | 全站 |
| `entity-link` | 公司◆ / 芯片◇ 統一鏈接（含 hover tooltip）| 全站 |

### 6.4 CSS 檔案拆分

```
css/
  ├── tokens.css
  ├── reset.css
  ├── typography.css
  ├── layout.css
  ├── components/
  │   ├── signal-card.css
  │   ├── signal-hero.css
  │   ├── kv-table.css
  │   ├── impact-tree.css
  │   ├── badge.css
  │   ├── filter-bar.css
  │   ├── section.css
  │   ├── empty-state.css
  │   ├── crumb.css
  │   ├── watch-btn.css
  │   └── entity-link.css
  ├── pages/
  │   ├── home.css
  │   ├── signal-detail.css
  │   ├── companies.css
  │   ├── company-detail.css
  │   ├── chip-detail.css
  │   ├── roadmap.css
  │   └── insights.css
  └── style.css  (只 @import)
```

Vite 打包後仍是單一 CSS，但開發時可獨立修改。

---

## 7. 跨頁聯動模式

### 7.1 Navbar 增強

- 4 個主要入口（左到右）：信號流 / 公司 / 路線圖 / 洞察
- Admin 入口只對登入用戶可見，顯示在右上角（位置與「關注 (12)」並列）
- 「首頁」rename 為「信號流」（連結指向 `index.html`）
- 當前頁底線高亮（取代僅字色變化）
- 右上：⌘K 全局搜尋按鈕 + 「關注 (12)」抽屜入口 + Admin (若已登入)

### 7.2 智能麵包屑（sessionStorage referrer）

```
從首頁進來：     ← 信號流
從公司詳情進來： ← NVIDIA
從路線圖進來：   ← Roadmap 2024 Q2
直接 URL 進來：  信號流 › NVIDIA › 此信號（fallback）
```

實現：每次站內鏈接點擊時，sessionStorage 寫入 `referrer_path` + `referrer_scroll`。詳情頁讀取顯示。

### 7.3 EntityLink（公司/芯片統一鏈接）

```html
<a class="entity-link entity-company" href="company.html?id=nvidia">
  <span class="entity-icon">◆</span>NVIDIA
</a>
<a class="entity-link entity-chip" href="chip.html?name=H200">
  <span class="entity-icon">◇</span>H200 SXM5
</a>
```

- 公司：`◆` 實心
- 芯片：`◇` 空心
- Hover 顯示快速摘要 tooltip

### 7.4 「下一步」推薦（詳情頁底部）

```
┌─ 下一步 ────────────────────────────┐
│ → 看 NVIDIA 本月其他信號（3 條新）  │
│ → 看 CoWoS-S 影響的所有信號（12 條）│
│ → 訂閱 NVIDIA 信號更新（關注）      │
└─────────────────────────────────────┘
```

每個詳情頁固定底部 3 個推薦。推薦邏輯：同公司未讀 / 同 ABF 影響類別 / 關注該公司。

### 7.5 ⌘K 全局搜尋（Command Palette）

```
┌────────────────────────────────────────┐
│ 搜尋公司 / 芯片 / 信號              ⏎ │
├────────────────────────────────────────┤
│ ▸ 公司：◆ NVIDIA, ◆ AMD               │
│ ▸ 芯片：◇ H200 SXM5, ◇ MI300X         │
│ ▸ 最新信號：H200 量產 (5h)            │
└────────────────────────────────────────┘
```

⌘K (Mac) / Ctrl+K (Win) 觸發。鍵盤完全可導航。Esc 關閉。

---

## 8. 每頁詳細設計

### 8.1 companies.html（公司目錄）

從表格改為卡片網格（3 列 desktop / 1 列 mobile）。每卡顯示：
- 名稱 + 圖標
- 國家 · 類別
- 市值
- 「📡 5 信號」← hook 進公司詳情
- 「⚡ 爆發性」← 最高 ABF 影響等級

### 8.2 company.html（公司詳情）

雙欄。主欄：公司概覽 → 最近 5 條信號 → 芯片組合 → SWOT → 下一步。Sidebar：核心數據 + ABF 影響 + SWOT 摘要 + 相關公司。砍掉現在的 12 個 sidebar block。

### 8.3 chip.html（芯片詳情）

跟公司詳情同結構，內容換成：芯片規格 → 該芯片所有信號 → 廠商鏈 → 路線圖位置 → 下一步。

### 8.4 roadmap.html（路線圖）

矩陣網格（公司 × 季度）。每格顯示芯片名 + 狀態。點 cell 進 signal detail。砍掉現在的卡片堆疊版。

### 8.5 insights.html（行業洞察）

敘事性報告流。每個趨勢一個 section（Markdown 渲染），引用具體信號（可點擊跳轉）。配合 OpenClaw Insight Agent 產生新 schema。

---

## 9. 建置路線圖（Phase 25-32）

| Phase | 標題 | 估時 | 依賴 |
|-------|------|------|------|
| 25 | 設計系統地基（tokens + CSS 拆分 + 移除廢碼）| 2d | — |
| 26 | 共用組件實作（10 個 primitive） | 3d | 25 |
| 27 | Navbar + 麵包屑 + ⌘K 搜尋 | 3d | 26 |
| 28 | 信號流首頁（index.html）| 3d | 26 |
| 29 | 信號詳情頁（signal.html，含 schema 補丁）| 4d | 26 |
| 30 | 公司目錄 + 公司詳情重設計 | 3d | 26 |
| 31 | Roadmap 矩陣重設計 | 2d | 26 |
| 32 | Insights 敘事頁 | 3d | 26 |

**總工期：23 工作日 ≈ 4-5 週**

並行可能：26 完成後，27/28/29/30/31/32 可分批並行。

### 中途檢查點

```
Phase 25 完成 → 視覺無變化，CSS 重組完成
Phase 26 完成 → 視覺無變化，組件就緒
Phase 27 完成 → Navbar + 麵包屑 + ⌘K 可用（用戶感受到關聯性）
Phase 28 完成 → 首頁變樣（最大視覺變化）
Phase 29 完成 → 信號詳情頁可分享 URL（核心差異化）
Phase 30-32 完成 → 全站視覺統一完成
```

---

## 10. Schema 變動清單

### 10.1 signals collection 新字段

```js
{
  // 現有字段...
  impact_entities: [
    { company_id: "tsmc", relation: "benefit", reason: "CoWoS 產能吃緊", order: 1 },
    { company_id: "ajinomoto", relation: "benefit", reason: "ABF 16L 需求增加", order: 2 },
    { company_id: "amd", relation: "impacted", reason: "競爭壓力", order: 3 }
  ]
}
```

**字段規範：**
- `company_id` 必須在 `companies` collection 存在（前端驗證 + admin form 用 datalist 限制）
- `relation` enum: `"benefit"` | `"impacted"` | `"neutral"`
- `reason` 字符串，最長 80 字
- `order` 數字（用於排序顯示，越小越前），預設 999
- 舊信號無此字段時，前端 `impact-tree` 顯示「（暫無影響分析）」+ 提示登入 admin 補充

### 10.2 signal.html URL 格式

```
signal.html?id={firestore_doc_id}
```

`id` 為 Firestore signals collection 的 document ID。若 id 不存在或載入失敗，顯示 404 風格頁面 + 返回信號流按鈕。

### 10.3 admin 後台 signals 編輯表單

新增「影響實體」管理區塊（multi-row form，每行 company picker datalist + relation select + reason input + order number + 刪除按鈕）。最多 10 條。

### 10.4 insights collection（未動，等 Phase 32）

新 schema 由 OpenClaw Insight Agent 規範（已在 docs/openclaw-agent-prompts.md 第 7 章定義）。Phase 32 對接該 schema。

---

## 11. 驗收標準（每個 Phase 完成後）

1. `npm run build` 通過
2. `node --test tests/*.test.js` **必須 90/90**（除非 Phase 29 加新測試）
3. 視覺檢查：每個改動的頁面 desktop + mobile 都正常顯示
4. 跨頁聯動：從首頁進信號詳情，點麵包屑返回應 scroll 回原位
5. 一個 Phase 一個 commit，commit 訊息：`feat(redesign): phase X — <短描述>`

---

## 12. 不做的事（YAGNI 清單）

- ❌ 不做光暗模式切換（保持深色終端風格）
- ❌ 不做 i18n 國際化（保持繁中）
- ❌ 不做用戶帳戶系統（關注列表存 localStorage）
- ❌ 不做 impact 可視化網絡圖（D3/Cytoscape），文字版 impact-tree 即可
- ❌ 不做 chips.html 索引頁（從公司詳情或 URL 進入）
- ❌ 不重構 admin 後台（除了 signal 編輯表單加 impact_entities）

---

## 13. 風險

| 風險 | 等級 | 緩解 |
|------|------|------|
| Phase 29 schema 變動破壞現有信號 | 中 | impact_entities 為可選字段，舊信號 fallback 空 |
| ⌘K 搜尋全文檢索性能 | 低 | 客戶端 fuzzy search，公司+芯片總量 < 200，無問題 |
| CSS 拆分影響打包順序 | 低 | Vite 自動處理 @import 順序 |
| 用戶適應期（IA 變動）| 中 | 28 完成後優先發布 preview，徵詢用戶意見 |
