# Task: Signals Phase 8 - Entity-Centered Intelligence System

## Context

Project: `D:\chip-roadmap-website`

The signals system has now completed 7 phases:

- Phase 1–2: signals foundation and trust workflow
- Phase 3–3.1: watchlists and entity intelligence pages
- Phase 4–4.1: signal history and watchlist workspace consistency
- Phase 5–5.1: admin data quality workspace
- Phase 6–6.1: roadmap V2 as verified timeline derived from signals
- Phase 7–7.1: companies as intelligence directory + insights as signal-derived summary + V1 cleanup

The product now has:
- Signals as system of record
- Roadmap as verified timeline
- Companies as intelligence directory
- Insights as signal-derived summary
- Admin as data quality workspace

The next step is to make the **entity layer** (companies, chips) feel like a coherent intelligence system, not isolated pages.

---

## Goal

Ship Phase 8 with:

1. shared entity-intelligence derivation layer
2. stronger company dossiers (signal summary, chip portfolio, risk indicators)
3. stronger chip dossiers (signal history, company context, sibling chips)
4. smoother cross-page intelligence workflow (signals → entity → related signals → related entities)

---

## Non-Goals

Do not implement:
- AI-generated dossiers
- external data enrichment
- company financial data
- supply chain graph visualization
- multi-entity comparison tool
- subscription/paywall logic

This is about entity intelligence depth, not commercialization.

---

## Phase 8 Scope

Four workstreams:

1. shared entity-intelligence derivation module
2. company dossier enrichment on `company-signals.html`
3. chip dossier enrichment on `chip-signals.html`
4. cross-page intelligence navigation improvements

---

## Workstream 1: Shared Entity-Intelligence Derivation Module

### Required feature

Create `js/modules/entity-intelligence.js` as a shared derivation module.

### Responsibilities

Given signals data and an entity identifier, compute:
- signal count, latest signal, highest impact (already partially in buildSignalMetrics)
- chip portfolio summary (for companies)
- company context (for chips)
- sibling entities
- risk indicators (conflicting evidence, low confidence high impact)
- verification trend (signals over time)

### Required exports

- `buildCompanyDossier(companyId, signals)`
- `buildChipDossier(chipName, signals)`
- `getCompanyChipPortfolio(companyId, signals)`
- `getChipCompanyContext(chipName, signals)`
- `getSiblingChips(companyId, signals, excludeChip)`
- `getEntityRiskIndicators(entityType, entityId, signals)`

### Constraint

This module must be importable by both `entity-signals.js` and `app.js` without circular dependencies.

---

## Workstream 2: Company Dossier Enrichment

### Required feature

Enhance `company-signals.html` sidebar to show a richer company dossier.

### Required sections

1. **Company Overview** — name, region, category, total signal count, latest signal date
2. **Chip Portfolio** — list of unique chips with signal counts, sorted by impact
3. **Risk Indicators** — count of signals with conflicting evidence, low confidence + high impact
4. **Verification Trend** — compact signal count by month (last 6 months)
5. **Related Companies** — companies sharing similar chip domains (based on category overlap)

### UI constraint

Keep the sidebar compact. Do not turn it into a full company profile page.

---

## Workstream 3: Chip Dossier Enrichment

### Required feature

Enhance `chip-signals.html` sidebar to show a richer chip dossier.

### Required sections

1. **Chip Overview** — chip name, company, total signal count, latest signal date
2. **Company Context** — company name, region, total signals from this company
3. **Sibling Chips** — other chips from the same company, with signal counts
4. **Signal Timeline** — compact timeline of signal status changes for this chip
5. **Risk Indicators** — conflicting evidence, confidence anomalies

### UI constraint

Same as company: compact, signal-derived, not editorial.

---

## Workstream 4: Cross-Page Intelligence Navigation

### Required feature

Improve the navigation flow between signals, entities, and related content.

### Required improvements

1. **Signal drawer** → entity links (company, chip) already exist; add "related chips" or "related signals" section
2. **Company page** → chip links should go to `chip-signals.html` (not just names)
3. **Chip page** → sibling chips should be clickable and navigate to their chip pages
4. **Company page** → add a "back to directory" link to `companies.html`
5. **Chip page** → add a "back to company" link to `company-signals.html?id=...`

### Principle

The user should always be able to navigate:
- from any signal → its company → its chips → other signals
- from any chip → its company → sibling chips → other signals
- from any company → its chips → individual chip intelligence

---

## Data Rules

### Dossier derivation

All dossier data must come from existing signals fields:
- `company_id`, `company_name`, `chip_name`
- `stage`, `status`, `confidence_score`, `abf_demand_impact`
- `createdAt`, `last_verified_at`, `last_status_changed_at`
- `conflicting_evidence`, `verification_note`
- `package_type`, `abf_size`, `abf_layers`, `hbm`

No new Firestore collections or fields should be required.

### Verification trend

Group signals by month of `last_verified_at` (or `createdAt` if not verified).
Show last 6 months with count per month.

---

## UX Requirements

### Entity pages should feel like:

- intelligence dossiers, not static profiles
- signal-derived, not manually curated
- cross-referenced, not isolated

### Navigation should feel like:

- following a trail of intelligence
- not bouncing between unrelated pages

### Empty states:

- quiet and informative
- do not imply broken data

---

## Acceptance Criteria

### Shared derivation

- `entity-intelligence.js` exists and exports required functions
- no circular dependencies

### Company dossier

- company page shows chip portfolio, risk indicators, verification trend
- all data derived from signals

### Chip dossier

- chip page shows company context, sibling chips, signal timeline
- all data derived from signals

### Cross-page navigation

- signal → entity → related content flow works
- breadcrumb/back links exist on entity pages
- no dead ends

### Build

- `npm run build` passes

---

## Deliverable Report

1. files changed
2. shared derivation decisions
3. company dossier modules
4. chip dossier modules
5. cross-page workflow improvements
6. deferred scope
7. build result
8. commit hash
