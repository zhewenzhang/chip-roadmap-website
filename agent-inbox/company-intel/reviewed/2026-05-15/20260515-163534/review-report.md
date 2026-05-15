# Review Report — 20260515-163534

## Run Info
- Run Date: 2026-05-15
- Run ID: 20260515-163534
- Reviewed by: arkclaw-company-intel-reviewer

## Review Summary

| Company | Score | Decision | Source Tier | Issues |
|---------|-------|----------|-------------|--------|
| NVIDIA | 92 | reviewed | T1x2 | abf_relevance=indirect |
| AMD | 92 | reviewed | T1x2 | abf_relevance=indirect |
| 珠海越亞 | 68 | reviewed_needs_human_check | T3x1 | No T1 source, FC-BGA utilization 9.32% |

## Scoring Details

### NVIDIA (92/100)
- 基本字段完整: 20/20 ✓
- 有官方來源: 20/20 ✓ (NVIDIA Q4 FY26財報+官網)
- 有第二獨立來源: 15/15 ✓ (兩個T1來源)
- supply_chain_role合理: 10/10 ✓
- ABF/advanced_packaging判斷有依據: 10/15 (indirect relevance, but CoWoS demand driver)
- why_track具體: 8/10 (有具體財報數據)
- 無明顯幻想或矛盾: 9/10

### AMD (92/100)
- 基本字段完整: 20/20 ✓
- 有官方來源: 20/20 ✓ (AMD IR Q1 2026財報+IR新聞列表)
- 有第二獨立來源: 15/15 ✓
- supply_chain_role合理: 10/10 ✓
- ABF/advanced_packaging判斷有依據: 10/15 (indirect relevance)
- why_track具體: 8/10
- 無明顯幻想或矛盾: 9/10

### 珠海越亞 (68/100)
- 基本字段完整: 15/20 (缺少official website)
- 有官方來源: 0/20 ✗ (僅百度百科，無官網/招股書)
- 有第二獨立來源: 5/15 (百度百科引用IPO公開信息，但本身為T3)
- supply_chain_role合理: 10/10 ✓
- ABF/advanced_packaging判斷有依據: 13/15 ✓ (FC-BGA+嵌埋封裝)
- why_track具體: 8/10 ✓ (有具體數據)
- 無明顯幻想或矛盾: 7/10 (FC-BGA利用率9.32%需人工確認)

## Decision Summary
- **import_ready**: 2 (NVIDIA, AMD)
- **reviewed_needs_human_check**: 1 (珠海越亞)
- **rejected**: 0

## Recommendation
- NVIDIA和AMD可直接導入，數據質量優秀(T1官方來源)
- 珠海越亞需人工確認：1)FC-BGA產能利用率9.32%是否準確 2)2026年最新業務進展 3)IPO進展
