# Company Intelligence Pipeline Rules v2.0

> 修正于 2026-05-15，基于 Round 1 复盘反馈。

## 1. 目录结构：RUN_ID 隔离

每次 run 必须使用独立子目录，按 `日期/RUN_ID` 隔离：

```
agent-inbox/company-intel/
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
└── PIPELINE-RULES-v2.md
```

**禁止跨 RUN 混写同一文件。** 每个 RUN_ID 目录是独立的不可变快照。

## 2. Queue 状态管理

Collector 处理完每家公司后，**必须**更新 `queue/company-seeds.jsonl` 中对应条目的 status：
- 有来源写入 raw → `status: "done"`
- 无来源写入 unverified → `status: "unverified"`
- 处理失败/超时 → `status: "failed"` (保留 pending 以便 retry)

## 3. Review 标准（v2）

### 3.1 硬条件（不通过 → rejected）
1. company_id 存在且仅小写英文、数字、hyphen
2. name_en 存在
3. region 合法
4. 至少有 1 个 source url
5. why_track 非空
6. company_type 非空

### 3.2 review_score 计算（满分 100）
| 维度 | 分值 | 说明 |
|------|------|------|
| 基本字段完整 | 20 | 所有必填字段存在且格式正确 |
| 有官方来源 | 20 | 公司官网、年报、交易所公告、法说会 |
| 有第二独立来源 | 15 | 与官方来源不同的其他可信来源 |
| supply_chain_role 合理 | 10 | 角色与公司实际匹配 |
| ABF/advanced_packaging 判断有依据 | 15 | 来源中能找到支撑 |
| why_track 具体 | 10 | 非泛泛而谈，有具体数据或事件 |
| 无明显幻想或矛盾 | 10 | 数据自洽，不矛盾 |

### 3.3 来源质量分级（source_tier）

| 等级 | 说明 | 示例 |
|------|------|------|
| **T1 - 官方** | 公司官方披露 | 公司官网、年报、交易所公告、法说会纪要 |
| **T2 - 可信产业** | 行业权威机构 | TrendForce、Yole、IDC、Gartner、产业分析师报告、知名行业媒体 |
| **T3 - 财经/聚合** | 财经平台汇总 | 雪球、东方财富、同花顺、CNPP、百度百科 |
| **T4 - 低可信** | 论坛/自媒体 | 贴吧、个人博客、未署名文章 |

### 3.4 Decision 规则

| 条件 | decision |
|------|----------|
| review_score >= 75 **且** 有至少 1 个 T1 来源 | `reviewed` (import-ready) |
| review_score >= 60 **且** 有至少 2 个 T2 来源 | `reviewed` (import-ready) |
| review_score >= 60 但来源质量不足 | `reviewed_needs_human_check` |
| review_score < 60 | `rejected` |

### 3.5 reviewed 输出格式

`reviewed` 和 `reviewed_needs_human_check` 都写入同一文件，通过 `review.decision` 字段区分：

```json
{
  "review": {
    "reviewed_by": "arkclaw-company-intel-reviewer",
    "reviewed_at": "ISO timestamp",
    "review_run_id": "RUN_ID",
    "review_score": 77,
    "decision": "reviewed_needs_human_check",
    "source_tier_summary": "T3x2",
    "issues": ["no official source", "why_track brief"],
    "possible_duplicate": false,
    "duplicate_reason": ""
  }
}
```

`company-import-minimal.reviewed.csv` 只包含 `decision=reviewed` 的条目，不包含 `reviewed_needs_human_check`。

## 4. Unverified Schema（统一格式）

```json
{
  "company_name": "公司名称",
  "region": "China | Taiwan | USA | Japan | Korea | Europe | Other",
  "category_hint": "ABF | substrate | OSAT | advanced_packaging | AI_chip | EDA | IP | equipment | material | cloud_chip",
  "reason": "network_limited | no_source_found | timeout",
  "needs_retry": true,
  "created_at": "ISO timestamp"
}
```

**禁止写入 company_id、name_en 等字段。** unverified 是种子占位，不是半成品数据。

## 5. Pipeline Report 格式

```markdown
# Pipeline Report — {RUN_ID}

## Run Info
- Run Date: YYYY-MM-DD
- Run ID: {RUN_ID}
- Published at: ISO timestamp

## Current Run Counts
| Category | Count |
|----------|-------|
| Raw | N |
| Reviewed (import-ready) | N |
| Reviewed (needs human check) | N |
| Rejected | N |
| Unverified | N |

## Date Total Counts (YYYY-MM-DD cumulative)
| Category | Total |
|----------|-------|
| Raw | N |
| Reviewed | N |
| Rejected | N |
| Unverified | N |

## Companies (this run)
| company_id | name | score | decision | source_tier |
|------------|------|-------|----------|-------------|

## Most Worth Human Review
- ...

## Can Background Import?
- import-ready count: N
- needs_human_check count: N
- recommendation: ...

## Output Paths
- ...
```

## 6. Source 分级优先级

Collector 搜索时应优先寻找高可信来源：

```
优先级：T1 > T2 > T3 > T4

搜索策略：
1. 先搜公司官网 + "annual report" / "investor relations"
2. 再搜行业报告 (TrendForce/Yole/IDC)
3. 最后补充财经平台信息
```

如果只有 T3/T4 来源，data_quality.needs_human_review 必须为 true。
