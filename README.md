# 晶片產業分析平台 (Chip Roadmap)

一個專為半導體產業情報設計的極簡主義單色風格靜態網站。追蹤 250 多家公司、晶片路線圖、市場數據和行業洞察。

## 核心設計系統

- **極簡單色 (Minimalist Monochrome)** — 純黑白配色，零圓角設計，無陰影，強調專業與冷靜的分析感。
- **字體系統** — Playfair Display (標題), Source Serif 4 (正文), JetBrains Mono (標籤與元數據)。
- **視覺語言** — 基於線條的裝飾，顏色反轉的懸停效果，瞬間 (100ms) 過渡。
- **質感細節** — SVG 噪點紋理疊加，重複線性漸變紋理。

## 數據覆蓋

- **信號追蹤** — 實時追蹤 AI 晶片與先進封裝的供應鏈驗證信號。
- **路線圖** — 追蹤 60+ 款核心晶片的發布進程。
- **公司數據** — 數據庫包含 250+ 家半導體相關企業（25+ 家深度剖析）。
- **重點廠商** — NVIDIA, AMD, Intel, 華為昇騰 (Huawei Ascend), 寒武紀 (Cambricon) 等。
- **市場區域** — 中國、美國、台灣、歐洲、日本、韓國、以色列、加拿大等。

## 主要頁面

| 頁面 | 描述 |
|------|-------------|
| `index.html` | 首頁 — 數據概覽、最新動態、核心洞察與頂級廠商。 |
| `signals.html` | **信號 (新增)** — 跨境供應鏈情報、信度驗證、ABF 影響分析與對比模式。 |
| `roadmap.html` | 路線圖 — 交互式時間軸視覺化，支持公司與類別篩選。 |
| `companies.html` | 公司庫 — 網格化列表，支持搜索與深度剖析彈窗。 |
| `insights.html` | 行業洞察 — 趨勢分析、ABF 需求專題、關鍵情報。 |

## 技術棧

- **HTML5 & CSS3** — 語義化結構，CSS Grid/Flexbox 佈局，原生 CSS 變量。
- **JavaScript (ES6+)** — 模塊化架構，原生 Fetch API，無繁重框架依賴。
- **Vite** — 構建工具，優化生產環境資源。
- **Firebase** — 後端數據庫支持 (Cloud Firestore) 與身份驗證。
- **GitHub Actions** — 自動化部署流程。

## 項目結構

```
chip-roadmap-website/
├── index.html              # 首頁
├── signals.html            # 供應鏈信號 (Phase 2.1 升級)
├── roadmap.html            # 晶片路線圖
├── companies.html          # 公司數據
├── insights.html           # 行業分析
├── admin/                  # 管理後台 (Firebase 驅動)
├── css/
│   └── style.css           # 單色設計系統主樣式
├── js/
│   ├── app.js              # 應用程序入口
│   └── modules/            # 模塊化功能 (信號、路線圖、公司等)
├── data/                   # 本地數據備份
└── .github/workflows/      # GitHub Actions 自動部署腳本
```

## 部署與開發

- **本地開發**: `npm run dev`
- **生產構建**: `npm run build`
- **自動部署**: 推送到 `main` 分支後，GitHub Actions 會自動構建並部署至 GitHub Pages。

## 免責聲明

本站點數據來源於上市公司財報、官方公告及行業調研報告。僅供參考，不構成任何投資建議。

---

2026 半導體產業情報平台 | 跨境供應鏈驗證
