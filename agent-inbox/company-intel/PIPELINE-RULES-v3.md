# Company Intelligence Pipeline Rules v3.0

> 升级于 2026-05-15，基于用户反馈全面重构。

## 1. 目录结构：RUN_ID 隔离

每次 run 使用独立子目录，按 `日期/RUN_ID` 隔离：

```
agent-inbox/company-intel/
├── plans/
│   └── YYYY-MM-DD/
│       └── {RUN_ID}/
│           └── planner-selection.json
├── raw/
│   └── YYYY-MM-DD/
│       └── {RUN_ID}/
│           ├── company-profiles.raw.jsonl
│           ├── source-log.raw.jsonl
│           └── collector-report.md
├── reviewed/
│   └── YYYY-MM-DD/
│       └── {RUN_ID}/
│           ├── company-profiles.reviewed.jsonl
│           ├── company-import-minimal.reviewed.csv
│           └── review-report.md
├── rejected/
│   └── YYYY-MM-DD/
│       └── {RUN_ID}/
│           └── company-profiles.rejected.jsonl
├── unverified/
│   └── YYYY-MM-DD/
│       └── {RUN_ID}/
│           └── unverified-seeds.jsonl
├── state/
│   ├── pipeline-state.json
│   └── run-env.json
├── queue/
│   └── company-seeds.jsonl
└── PIPELINE-RULES-v3.md
```

**禁止跨 RUN 混写同一文件。** 每个 RUN_ID 目录是独立的不可变快照。

## 2. 四角色流水线

```
Planner → Collector → Reviewer → Publisher
```

- Planner：选公司，输出 planner-selection.json
- Collector：收集 raw data，输出完整 schema JSONL
- Reviewer：审查质量，分为 reviewed/rejected
- Publisher：检查完整性，更新状态

## 3. Planner 规则

每轮选 3 家公司，优先级：
- P0: ABF substrate / IC substrate / CoWoS 瓶颈
- P1: OSAT / HBM / substrate equipment
- P2: 中国 AI chip / GPU / ASIC / cloud chip
- P3: 一般半导体

不重复已 reviewed 的公司（除非缺少关键字段需要 enrichment）。

## 4. Collector Schema（完整）

```json
{
  "company_id": "lowercase-slug-id",
  "name_en": "",
  "name_cn": "",
  "aliases": [],
  "region": "",
  "country": "",
  "headquarters": "",
  "founded": null,
  "website": "",
  "company_type": "",
  "market_data": {
    "ticker": "",
    "exchange": "",
    "market_cap": "",
    "market_cap_date": "",
    "revenue_latest": "",
    "employee_count": "",
    "fiscal_year": "",
    "confidence": 0.0,
    "sources": []
  },
  "supply_chain_role": [],
  "main_products": [{"name":"","category":"","description":""}],
  "abf_relevance": {"level":"","reason":""},
  "advanced_packaging_relevance": {"level":"","technologies":[],"reason":""},
  "china_relevance": {"level":"","reason":""},
  "key_customers_or_partners": [],
  "competitors": [],
  "company_analysis": {
    "strengths": [],
    "weaknesses": [],
    "opportunities": [],
    "threats": [],
    "confidence": 0.0,
    "basis": ""
  },
  "tracking_priority": {"level":"","reason":"","watch_topics":[]},
  "source_quality": {"overall":"","official_sources":0,"industry_sources":0,"weak_sources":0,"notes":""},
  "import_decision": {"decision":"","reason":"","required_human_checks":[]},
  "why_track": "",
  "data_quality": {"confidence":0.0,"missing_fields":[],"needs_human_review":true},
  "sources": [{"title":"","url":"","publisher":"","source_type":"","published_at":"","accessed_at":"","supports_fields":[]}],
  "agent_meta": {"run_id":"","selected_by_planner":true,"discovered_by":"","last_checked_at":"","change_type":""}
}
```

## 5. Review 评分（满分 100）

| 维度 | 分值 |
|------|------|
| 基本字段完整 | 20 |
| market_data 有 ticker/exchange/market_cap 或合理说明 | 15 |
| company_analysis SWOT 四项完整 | 15 |
| 有 strong source | 15 |
| 有第二 medium+ source | 10 |
| supply_chain_role / tracking_priority 合理 | 10 |
| ABF / advanced packaging 判断有依据 | 10 |
| 无明显幻想或矛盾 | 5 |

## 6. Decision 规则

| 条件 | decision |
|------|----------|
| review_score >= 75 且 source_quality 不为 weak | `import_ready` |
| review_score >= 60 | `reviewed_needs_human_check` |
| review_score < 60 | `rejected` |

## 7. Unverified Schema

```json
{
  "company_name": "",
  "region": "",
  "category_hint": "",
  "reason": "network_limited | no_source_found | timeout",
  "needs_retry": true,
  "created_at": ""
}
```

## 8. Pipeline Report 格式

必须包含：
- Run Info（RUN_ID、日期）
- Current Run Counts（本轮）
- Date Total Counts（累计）
- Companies 表格（含 score/decision/source_tier/tracking_priority）
- market_data 完成度
- SWOT 完成度
- 哪些公司会被 AutoImporter 写入后台
- 哪些字段需要人工修正
- Output Paths

## 9. Source 质量分级

| 等级 | 说明 |
|------|------|
| strong | 公司官网、年报、交易所公告、法说会、官方新闻稿 |
| medium | 可信行业媒体、分析师报告、市场研究、客户/供应商公告 |
| weak | 百科、论坛、转载站、通用目录、社交媒体 |
