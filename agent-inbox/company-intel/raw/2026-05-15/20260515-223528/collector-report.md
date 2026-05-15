# Collector Report - Run 20260515-223528

## Run Info
- **RUN_ID**: 20260515-223528
- **Date**: 2026-05-15
- **Companies Processed**: 3

## Companies Collected

| Company | Region | Category | Sources | Status |
|---------|--------|----------|---------|--------|
| Marvell Technology | USA | AI_chip | 5 | ✅ Collected |
| Qualcomm | USA | AI_chip | 4 | ✅ Collected |
| MediaTek | Taiwan | AI_chip | 3 | ✅ Collected |

## Source Summary
- **Total URLs fetched**: 10
- **Successful**: 8
- **Failed**: 2 (Reuters, Yahoo Finance blocked)
- **Official sources**: 3 (Marvell官网, Qualcomm官网, MediaTek官网)
- **Strong sources**: 1 (CNBC earnings report for Qualcomm)
- **Medium sources**: 3 (Motley Fool, Bing search, TipRanks)
- **Weak sources**: 3 (百度百科)

## Data Quality Notes

### Marvell Technology
- **Source quality**: Medium
- **Key data**: Stock at ~$185 (52-week high), up 100%+ YTD. Nvidia partnership. Google AI chip talks.
- **Gaps**: Official earnings data not accessible, market cap estimated from news reports

### Qualcomm
- **Source quality**: Strong
- **Key data**: Q2 FY2025 revenue $10.6B, EPS $2.65. Q3 guidance below expectations. Data center chip shipping this year. China sales bottoming.
- **Gaps**: Full year revenue, exact market cap

### MediaTek
- **Source quality**: Weak
- **Key data**: Global #1 mobile chip supplier (by volume), TWSE: 2454, founded 1997
- **Gaps**: Recent financial data unavailable, market cap estimated, no recent earnings coverage found

## Network Environment Issues
- Wikipedia blocked (private IP)
- Yahoo Finance blocked (China access)
- Reuters blocked
- Seeking Alpha, TipRanks, Zhihu blocked (Cloudflare)
- Bing search functional but redirects to cn.bing.com
- Company official sites mostly accessible

## Output Files
- `marvell.json` - Full schema company profile
- `qualcomm.json` - Full schema company profile
- `mediatek.json` - Full schema company profile
- `source-log.raw.jsonl` - Source fetch log
- `collector-report.md` - This report
