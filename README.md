# Chip Roadmap — 半導體產業分析

A minimalist monochrome static website for semiconductor industry intelligence. Tracks 250+ companies, chip roadmaps, market data, and industry insights.

## Design System

- **Minimalist Monochrome** — Pure black/white palette, zero border-radius, no shadows
- **Typography** — Playfair Display (headings), Source Serif 4 (body), JetBrains Mono (labels/meta)
- **Visual Language** — Line-based decorations, color inversion hovers, instant 100ms transitions
- **Texture** — SVG noise overlay, repeating-linear-gradient patterns

## Data

- **67 chips** tracked across timelines
- **255 companies** in database (25 with detailed profiles)
- **5 companies** with roadmap data (NVIDIA, AMD, Intel, Huawei Ascend, Cambricon)
- **Market regions**: China, USA, Taiwan, Europe, Japan, Korea, Israel, Canada

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Home — stats overview, latest updates, insights, top players |
| `roadmap.html` | Timeline visualization with company filters |
| `companies.html` | Company grid with search and detail modals |
| `insights.html` | Industry trends, ABF analysis, key insights |

## Tech Stack

- **HTML5** — Semantic structure
- **CSS3** — CSS Grid/Flexbox, custom properties, responsive design
- **JavaScript** — Native ES6+, Fetch API, modular data loading
- **Zero build tools** — Static files, deploy anywhere

## Project Structure

```
chip-roadmap-website/
├── index.html              # 首頁
├── roadmap.html            # 時間軸
├── companies.html          # 公司分析
├── insights.html           # 行業洞察
├── css/
│   └── style.css           # Monochrome design system
├── js/
│   └── app.js              # Application logic
├── data/
│   ├── companies.json      # Company profiles
│   ├── roadmaps.json       # Roadmap timelines
│   ├── market.json         # Market statistics
│   └── insights.json       # Industry analysis
└── .github/workflows/      # GitHub Actions deploy
```

## Deployment

Pushed to `main` → GitHub Actions auto-deploys to Pages.

## Disclaimer

Data sourced from public company filings, official announcements, and industry reports. For reference only; not investment advice.

---

2026 Semiconductor Industry Intelligence
