/**
 * signals-schema.js — Single source of truth for signal enums, labels, sort priorities,
 * and normalization logic. All other modules import from here.
 */

// ===== Enums =====
export const STAGE_ENUM = ['rumor', 'announced', 'sampling', 'design_win', 'pilot', 'ramp', 'volume'];
export const STATUS_ENUM = ['draft', 'watch', 'verified', 'downgraded', 'invalidated', 'archived'];
export const IMPACT_ENUM = ['low', 'medium', 'high', 'explosive'];
export const REGION_OPTIONS = ['China', 'Taiwan', 'USA', 'Korea', 'Japan', 'Europe', 'Israel', 'Canada', 'Other', 'Global'];

// ===== Sort priorities =====
export const IMPACT_SORT = { explosive: 4, high: 3, medium: 2, low: 1 };

// ===== Label maps (Traditional Chinese) =====
export const STAGE_LABEL = {
    rumor: '傳聞',
    announced: '已宣布',
    sampling: '送樣',
    design_win: '設計勝出',
    pilot: '試產',
    ramp: '爬產',
    volume: '量產',
};

export const STATUS_LABEL = {
    draft: '草稿',
    watch: '觀察中',
    verified: '已驗證',
    downgraded: '降級',
    invalidated: '已失效',
    archived: '已封存',
};

export const IMPACT_LABEL = {
    low: '低',
    medium: '中',
    high: '高',
    explosive: '爆發性',
};

export const REGION_LABEL = {
    Global: '全球',
    China: '中國',
    Taiwan: '台灣',
    USA: '美國',
    US: '美國',
    Japan: '日本',
    Korea: '韓國',
    Europe: '歐洲',
    Israel: '以色列',
    Canada: '加拿大',
    Other: '其他',
};

// ===== Generic label lookup =====
export const labelize = (map, key) => map[key] || key || '';

// ===== History action types =====
export const HISTORY_ACTIONS = {
    CREATED: 'created',
    UPDATED: 'updated',
    STATUS_CHANGED: 'status_changed',
    CONFIDENCE_CHANGED: 'confidence_changed',
    ARCHIVED: 'archived',
    REVIEWED: 'reviewed',
};

export const HISTORY_ACTION_LABELS = {
    created: '已建立',
    updated: '已更新',
    status_changed: '狀態變更',
    confidence_changed: '信度變更',
    archived: '已封存',
    reviewed: '已複核',
};

// ===== Navigation Helpers =====
export function getCompanyIntelUrl(id) {
    return `company-signals.html?id=${encodeURIComponent(id)}`;
}

export function getChipIntelUrl(name) {
    return `chip-signals.html?name=${encodeURIComponent(name)}`;
}

// ===== Normalization =====
export function normalizeSignal(raw) {
    if (!raw) return null;

    const stage = STAGE_ENUM.includes(raw.stage) ? raw.stage : 'rumor';
    const status = STATUS_ENUM.includes(raw.status) ? raw.status : 'draft';
    const abf_demand_impact = IMPACT_ENUM.includes(raw.abf_demand_impact) ? raw.abf_demand_impact : 'low';
    let confidence_score = Number(raw.confidence_score) || 0;
    confidence_score = Math.max(0, Math.min(100, confidence_score));

    let abf_layers = null;
    if (raw.abf_layers != null) {
        const n = Number(raw.abf_layers);
        if (!isNaN(n) && n > 0) abf_layers = n;
    }

    let release_quarter = '';
    if (['Q1', 'Q2', 'Q3', 'Q4'].includes(raw.release_quarter)) {
        release_quarter = raw.release_quarter;
    }

    return {
        id: raw.id || '',
        title: raw.title || '',
        company_id: raw.company_id || '',
        company_name: raw.company_name || '',
        chip_name: raw.chip_name || '',
        region: raw.region || '',
        signal_type: raw.signal_type || '',
        stage,
        release_year: raw.release_year || null,
        release_quarter,
        package_type: raw.package_type || '',
        cowos_required: Boolean(raw.cowos_required),
        abf_size: raw.abf_size || '',
        abf_layers,
        hbm: raw.hbm || '',
        expected_volume: raw.expected_volume || '',
        abf_demand_impact,
        impact_scope: Array.isArray(raw.impact_scope) ? raw.impact_scope : [],
        confidence_score,
        status,
        evidence_summary: raw.evidence_summary || '',
        conflicting_evidence: raw.conflicting_evidence || '',
        last_verified_at: raw.last_verified_at || '',
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        sources: Array.isArray(raw.sources) ? raw.sources : [],
        notes: raw.notes || '',
        // Lifecycle metadata
        createdAt: raw.createdAt ? (raw.createdAt.toDate ? raw.createdAt.toDate().toISOString() : raw.createdAt) : null,
        updatedAt: raw.updatedAt ? (raw.updatedAt.toDate ? raw.updatedAt.toDate().toISOString() : raw.updatedAt) : null,
        confidence_reason: raw.confidence_reason || '',
        last_verified_by: raw.last_verified_by || '',
        last_status_changed_at: raw.last_status_changed_at || null,
        last_confidence_changed_at: raw.last_confidence_changed_at || null,
        verification_note: raw.verification_note || '',
        source_regions: Array.isArray(raw.source_regions) ? raw.source_regions : [],
        // Archive metadata (Phase 13.1)
        archived: Boolean(raw.archived),
        archived_at: raw.archived_at || '',
        archived_by: raw.archived_by || '',
        archive_reason: raw.archive_reason || '',
        import_key: raw.import_key || '',
        // Data quality review metadata (Phase 14.2)
        reviewed_at: raw.reviewed_at || '',
        reviewed_by: raw.reviewed_by || '',
        review_note: raw.review_note || '',
        // Operator review tracking (Phase 16.1)
        last_reviewed_at: raw.last_reviewed_at || null,
        // AI metadata (Phase 16)
        ai_generated: Boolean(raw.ai_generated),
        ai_model: raw.ai_model || '',
        ai_extracted_at: raw.ai_extracted_at || '',
        source_type: raw.source_type || '',  // 'manual' | 'imported' | 'ai_extracted' | 'user_contributed' (reserved)
    };
}
