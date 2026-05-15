# Collector Report — 20260515-163534

## Run Info
- Run Date: 2026-05-15
- Run ID: 20260515-163534
- Collector started: 2026-05-15T16:35:34+08:00

## Companies Processed

| Company | Sources Found | Source Tiers | Status |
|---------|---------------|--------------|--------|
| 珠海越亞 (Zhuhai Yueya) | 1 primary + 1 context | T3x1 + T2 context | raw (needs_human_review) |
| NVIDIA | 2 primary | T1x2 | raw (import_ready) |
| AMD | 2 primary | T1x2 | raw (import_ready) |

## Source Summary

### NVIDIA
- **T1**: NVIDIA Q4 FY2026 財報新聞稿 — 營收$215.9B(+65%), 數據中心$193.7B, Q1 FY27展望$78B
- **T1**: NVIDIA官網 About頁面 — 公司概述

### AMD
- **T1**: AMD Q1 2026 財報新聞稿 — 營收$10.3B(+38%), 數據中心$5.8B(+57%), Q2展望$11.2B
- **T1**: AMD IR新聞列表 — Meta 6GW合作, OpenAI合作, MI450/Helios, Samsung HBM4

### 珠海越亞
- **T3**: 百度百科 — 公司基本信息、財務數據(2022-2024營收/毛利率)、股東結構、IPO申請、技術專利、生產基地
- **T2**: IC&PCB聯盟 — PCB行業背景信息(context only)

## Search Limitations
- Google/Bing搜索在當前環境受限(重定向/captcha)
- Wikipedia解析為私有IP被阻斷
- 主要通過直接URL訪問IR頁面和百科獲取數據
- 珠海越亞僅獲取T3來源，缺少T1(官網/招股書)和T2(產業報告)

## Notes
- NVIDIA和AMD數據質量優秀(T1官方來源+最新財報)
- 珠海越亞數據基於百度百科(IPO公開信息匯總)，confidence=0.7，需人工確認
- FC-BGA產能利用率僅9.32%為重要發現，標記為needs_human_review
