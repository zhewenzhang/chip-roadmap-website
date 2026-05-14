# Company Scaffolding Workflow — V2 Foundation Data

> **Purpose**: Build structured company records for V2 expansion without inventing facts.
> Every field must be traced to an authoritative source before migration.

## Four-Stage Workflow

### Stage A — Operator Reviews Target List

Edit `data/target-companies.txt`. Each line:

```
id | name_en | name_cn    # [STATUS] optional comment
```

Status markers:
- `[V2-ADD]` — New company, V2-priority. Will generate empty skeleton.
- `[V1-UPDATE]` — Exists in V1, needs V2 fields (abf_demand_impact, ai_chip_focus, etc.).
- `[V1-KEEP]` — Exists, no V2 changes needed.
- `[EXISTS]` — Already in V1 with adequate data.

**ID rules**: lowercase, `[a-z0-9_]` only, must start with letter.

### Stage B — Scaffolding Tool Generates Templates

```bash
node scripts/scaffold-companies.js
```

Output: `data/companies-template.json`

This file contains:
- **V2-ADD**: Skeleton records with all fact fields empty (`""`, `null`, `[]`)
- **V1-UPDATE**: Existing records with V2 fields appended (empty)
- **V1-KEEP/EXISTS**: Preserved as-is with `__status` tracking

**The tool NEVER invents facts.** No descriptions, market caps, or founded years are filled.

### Stage C — Operator Fills Facts

Open `data/companies-template.json` and fill:

1. **Fact fields** — Use authoritative sources (财报、官網、Wikipedia、年报)
2. **`__sources` object** — Record the URL/source for each field you fill

Example:

```json
{
  "huawei_ascend": {
    "id": "huawei_ascend",
    "name_en": "Huawei Ascend",
    "name_cn": "華為昇騰",
    "country": "China",
    "region": "China",
    "__sources": {
      "country": "https://en.wikipedia.org/wiki/Huawei",
      "region": "https://en.wikipedia.org/wiki/Huawei",
      "category": "https://www.huawei.com/en/ascend",
      "founded": "https://en.wikipedia.org/wiki/Huawei"
    }
  }
}
```

**Time estimate**: ~20 minutes per company × 37 V2-ADD = ~12 hours total.
**Recommended**: Split across 3 days, 4 hours per day.

### Stage D — Migration to Firestore

```bash
# Not yet implemented — placeholder for future phase
# node scripts/migrate-companies.js
```

The migration script will:
1. Read `data/companies-template.json`
2. For each entry:
   - `__status: V2-ADD` → `setDoc()` to create new document
   - `__status: V1-UPDATE` → `updateDoc()` to merge new fields
   - `__status: V1-KEEP/EXISTS` → skip
3. Strip `__sources`, `__status`, `__last_updated`, `__updated_by` before writing
4. Report success/failure per company

## Schema Reference

Each company document in Firestore has this shape:

| Field | Type | V2 Required? | Description |
|-------|------|:------------:|-------------|
| `id` | string | ✅ | Unique identifier (same as Firestore doc ID) |
| `name_en` | string | ✅ | English name |
| `name_cn` | string | ✅ | Chinese name |
| `country` | string | ✅ | Country of headquarters |
| `region` | string | ✅ | Geographic region (USA/China/Taiwan/etc.) |
| `category` | string | ✅ | Business category (AI加速器/代工/HBM/載板/etc.) |
| `headquarters` | string | | City, country |
| `founded` | number | | Year founded |
| `market_cap` | string | | Market cap (e.g., "$3T") |
| `description` | string | | 1-2 sentence company description |
| `abf_demand_impact` | string | ✅ V2 | ABF substrate demand: low/medium/high/explosive |
| `ai_chip_focus` | string | ✅ V2 | AI chip focus area (训练/推理/ASIC/等) |
| `foundry` | string | ✅ V2 | Primary foundry (TSMC/Samsung/SMIC/等) |
| `packaging_partners` | string[] | ✅ V2 | Packaging/OSAT partners |
| `key_customers` | string[] | ✅ V2 | Major customers |
| `market_position` | string | | 1-line market position summary |
| `analysis` | object | | SWOT analysis |
| `products` | string[] | | Product names |
| `roadmap` | object[] | | Product roadmap entries |

## Internal Tracking Fields (stripped before migration)

| Field | Purpose |
|-------|---------|
| `__status` | EXISTS / V1-UPDATE / V2-ADD / V1-KEEP |
| `__sources` | Per-field source URL tracking |
| `__last_updated` | ISO date of last operator edit |
| `__updated_by` | Operator email or name |

## Troubleshooting

**"Skipping malformed line"**: Check that the line has 3 pipe-separated fields: `id | name_en | name_cn`.

**"Skipping invalid ID"**: ID must match `^[a-z][a-z0-9_]*$`. No uppercase, no hyphens, no starting with number.

**Template has too few entries**: Check that all lines in `target-companies.txt` have a status marker (`[V2-ADD]`, `[V1-UPDATE]`, etc.).
