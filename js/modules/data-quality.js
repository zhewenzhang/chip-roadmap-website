/**
 * Data Quality Module — shared rule evaluation for signals.
 *
 * Central place for:
 *  1. detecting signal issues
 *  2. converting issues into queue items
 *  3. computing priority
 *  4. generating human-readable and machine-usable metadata
 *
 * Exports:
 *   evaluateSignalQuality(signal, context)
 *   buildQualityQueue(signals, context)
 *   getQualitySummary(queueItems)
 *   sortQualityQueue(items, mode)
 */

// ===== Constants =====

export const QUEUE_TYPES = {
    MISSING_FIELDS: '待補全',
    NEEDS_VERIFICATION: '待驗證',
    NEEDS_REVIEW: '待複核',
    NAMING_ISSUE: '命名異常',
    LINKING_ISSUE: '關聯異常',
};

// Priority weights by queue type
const QUEUE_PRIORITY_BASE = {
    [QUEUE_TYPES.LINKING_ISSUE]: 90,
    [QUEUE_TYPES.NEEDS_REVIEW]: 70,
    [QUEUE_TYPES.NEEDS_VERIFICATION]: 60,
    [QUEUE_TYPES.NAMING_ISSUE]: 40,
    [QUEUE_TYPES.MISSING_FIELDS]: 20,
};

// High-impact signal bonus
const IMPACT_PRIORITY_BONUS = { explosive: 30, high: 20, medium: 5, low: 0 };

// Stale verification threshold (days)
const STALE_VERIFICATION_DAYS = 60;

// ===== Rule Evaluation =====

/**
 * Evaluate a single normalized signal and return a list of issues.
 *
 * @param {Object} signal — normalized signal object
 * @param {Object} context — { companies: Array, allChipNames: Set }
 * @returns {Array<{ queueType, category, reason, quickFixEligible, fields }>}
 */
export function evaluateSignalQuality(signal, context = {}) {
    const issues = [];
    const { companies = [], allChipNames = new Set() } = context;

    // --- missing_fields ---
    const missingFieldIssues = checkMissingFields(signal);
    issues.push(...missingFieldIssues);

    // --- needs_verification ---
    const verIssues = checkVerification(signal);
    issues.push(...verIssues);

    // --- needs_review ---
    const reviewIssues = checkNeedsReview(signal);
    issues.push(...reviewIssues);

    // --- naming_issue ---
    const namingIssues = checkNaming(signal, allChipNames);
    issues.push(...namingIssues);

    // --- linking_issue ---
    const linkingIssues = checkLinking(signal, companies);
    issues.push(...linkingIssues);

    return issues;
}

function checkMissingFields(signal) {
    const issues = [];

    if (!signal.evidence_summary) {
        issues.push({
            queueType: QUEUE_TYPES.MISSING_FIELDS,
            category: 'missing_fields',
            reason: '缺少證據摘要',
            quickFixEligible: true,
            fields: ['evidence_summary'],
        });
    }

    if (!signal.confidence_reason) {
        issues.push({
            queueType: QUEUE_TYPES.MISSING_FIELDS,
            category: 'missing_fields',
            reason: '缺少信度依據',
            quickFixEligible: true,
            fields: ['confidence_reason'],
        });
    }

    // CoWoS required but no ABF info
    if (signal.cowos_required && (!signal.abf_size || !signal.abf_layers)) {
        const missing = [];
        if (!signal.abf_size) missing.push('abf_size');
        if (!signal.abf_layers) missing.push('abf_layers');
        issues.push({
            queueType: QUEUE_TYPES.MISSING_FIELDS,
            category: 'missing_fields',
            reason: `CoWoS 已標記但缺少 ${missing.join('、')}`,
            quickFixEligible: true,
            fields: missing,
        });
    }

    // Verified but no verifier
    if (signal.status === 'verified' && !signal.last_verified_by) {
        issues.push({
            queueType: QUEUE_TYPES.MISSING_FIELDS,
            category: 'missing_fields',
            reason: '已驗證但未標注驗證人',
            quickFixEligible: true,
            fields: ['last_verified_by'],
        });
    }

    // Missing package_type when stage is advanced
    const advancedStages = ['pilot', 'ramp', 'volume'];
    if (advancedStages.includes(signal.stage) && !signal.package_type) {
        issues.push({
            queueType: QUEUE_TYPES.MISSING_FIELDS,
            category: 'missing_fields',
            reason: '進階階段但缺少封裝類型',
            quickFixEligible: true,
            fields: ['package_type'],
        });
    }

    return issues;
}

function checkVerification(signal) {
    const issues = [];

    // Draft or watch status
    if (signal.status === 'draft' || signal.status === 'watch') {
        issues.push({
            queueType: QUEUE_TYPES.NEEDS_VERIFICATION,
            category: 'needs_verification',
            reason: `狀態為「${signal.status}」待驗證`,
            quickFixEligible: true,
            fields: ['status', 'confidence_score', 'last_verified_at', 'last_verified_by'],
        });
    }

    // Never verified
    if (!signal.last_verified_at) {
        issues.push({
            queueType: QUEUE_TYPES.NEEDS_VERIFICATION,
            category: 'needs_verification',
            reason: '從未驗證',
            quickFixEligible: true,
            fields: ['last_verified_at', 'last_verified_by'],
        });
    }

    // Stale verification
    if (signal.last_verified_at) {
        const daysSince = (Date.now() - new Date(signal.last_verified_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > STALE_VERIFICATION_DAYS) {
            issues.push({
                queueType: QUEUE_TYPES.NEEDS_VERIFICATION,
                category: 'needs_verification',
                reason: `驗證已過期（${Math.round(daysSince)} 天前）`,
                quickFixEligible: true,
                fields: ['last_verified_at', 'last_verified_by', 'verification_note'],
            });
        }
    }

    return issues;
}

function checkNeedsReview(signal) {
    const issues = [];

    // Recent status change
    if (signal.last_status_changed_at) {
        const daysSince = (Date.now() - new Date(signal.last_status_changed_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince <= 14) {
            issues.push({
                queueType: QUEUE_TYPES.NEEDS_REVIEW,
                category: 'needs_review',
                reason: `近期狀態變更（${Math.round(daysSince)} 天前）`,
                quickFixEligible: false,
                fields: [],
            });
        }
    }

    // Recent confidence change
    if (signal.last_confidence_changed_at) {
        const daysSince = (Date.now() - new Date(signal.last_confidence_changed_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince <= 14) {
            issues.push({
                queueType: QUEUE_TYPES.NEEDS_REVIEW,
                category: 'needs_review',
                reason: `近期信度變更（${Math.round(daysSince)} 天前）`,
                quickFixEligible: false,
                fields: [],
            });
        }
    }

    // Conflicting evidence present
    if (signal.conflicting_evidence) {
        issues.push({
            queueType: QUEUE_TYPES.NEEDS_REVIEW,
            category: 'needs_review',
            reason: '存在矛盾證據',
            quickFixEligible: false,
            fields: [],
        });
    }

    return issues;
}

function checkNaming(signal, allChipNames) {
    const issues = [];
    const chipName = (signal.chip_name || '').trim();

    if (!chipName) {
        issues.push({
            queueType: QUEUE_TYPES.NAMING_ISSUE,
            category: 'naming_issue',
            reason: '芯片名稱為空',
            quickFixEligible: true,
            fields: ['chip_name'],
        });
        return issues;
    }

    // Detect trailing/leading whitespace variants
    if (chipName !== chipName.trim()) {
        issues.push({
            queueType: QUEUE_TYPES.NAMING_ISSUE,
            category: 'naming_issue',
            reason: '芯片名稱含多餘空白',
            quickFixEligible: true,
            fields: ['chip_name'],
        });
    }

    // Check for likely duplicate with different casing/spacing
    const normalized = chipName.toLowerCase().replace(/\s+/g, ' ');
    for (const existing of allChipNames) {
        const existingNorm = existing.toLowerCase().replace(/\s+/g, ' ');
        if (existing !== chipName && existingNorm === normalized) {
            issues.push({
                queueType: QUEUE_TYPES.NAMING_ISSUE,
                category: 'naming_issue',
                reason: `可能與現有芯片名「${existing}」重複（大小寫/空白差異）`,
                quickFixEligible: true,
                fields: ['chip_name'],
            });
            break;
        }
    }

    return issues;
}

function checkLinking(signal, companies) {
    const issues = [];

    // Missing company_id
    if (!signal.company_id) {
        issues.push({
            queueType: QUEUE_TYPES.LINKING_ISSUE,
            category: 'linking_issue',
            reason: '缺少 company_id',
            quickFixEligible: true,
            fields: ['company_id'],
        });
    }

    // company_id not in catalog
    if (signal.company_id && companies.length > 0) {
        const companyIds = new Set(companies.map(c => c.id));
        if (!companyIds.has(signal.company_id)) {
            issues.push({
                queueType: QUEUE_TYPES.LINKING_ISSUE,
                category: 'linking_issue',
                reason: `company_id「${signal.company_id}」不在公司目錄中`,
                quickFixEligible: true,
                fields: ['company_id'],
            });
        }
    }

    // company_id and company_name conflict
    if (signal.company_id && signal.company_name && companies.length > 0) {
        const company = companies.find(c => c.id === signal.company_id);
        if (company) {
            const expectedName = company.name_cn || company.name_en;
            if (expectedName && signal.company_name !== expectedName) {
                issues.push({
                    queueType: QUEUE_TYPES.LINKING_ISSUE,
                    category: 'linking_issue',
                    reason: `公司名稱不一致：信號記錄「${signal.company_name}」vs 目錄「${expectedName}」`,
                    quickFixEligible: true,
                    fields: ['company_name'],
                });
            }
        }
    }

    return issues;
}

// ===== Queue Building =====

/**
 * Build the full quality queue from a list of signals.
 *
 * @param {Array} signals — normalized signal array
 * @param {Object} context — { companies: Array, allChipNames: Set }
 * @returns {Array<QueueItem>}
 */
export function buildQualityQueue(signals, context = {}) {
    const queueItems = [];

    for (const signal of signals) {
        const issues = evaluateSignalQuality(signal, context);
        if (issues.length === 0) continue;

        // Deduplicate: one queue item per signal, carrying all issues
        const primaryIssue = issues[0]; // first issue determines queueType
        const impactBonus = IMPACT_PRIORITY_BONUS[signal.abf_demand_impact] || 0;
        const basePriority = QUEUE_PRIORITY_BASE[primaryIssue.queueType] || 20;
        const priorityScore = Math.min(100, basePriority + impactBonus);

        queueItems.push({
            signalId: signal.id,
            signal,
            queueType: primaryIssue.queueType,
            issues,
            issueCount: issues.length,
            priorityScore,
            priorityLabel: priorityScore >= 70 ? '高' : priorityScore >= 40 ? '中' : '低',
            quickFixEligible: issues.some(i => i.quickFixEligible),
            // Flatten all fixable fields
            fixableFields: [...new Set(issues.filter(i => i.quickFixEligible).flatMap(i => i.fields))],
            // Human-readable summary
            summary: issues.map(i => i.reason).join('；'),
        });
    }

    // Default sort by priority descending
    sortQualityQueue(queueItems, 'priority');
    return queueItems;
}

// ===== Sorting =====

/**
 * Sort queue items in place.
 *
 * @param {Array} items
 * @param {'priority' | 'recent' | 'oldest'} mode
 */
export function sortQualityQueue(items, mode = 'priority') {
    switch (mode) {
        case 'priority':
            items.sort((a, b) => b.priorityScore - a.priorityScore);
            break;
        case 'recent':
            items.sort((a, b) => {
                const da = a.signal.updatedAt || a.signal.last_verified_at || '';
                const db = b.signal.updatedAt || b.signal.last_verified_at || '';
                return new Date(db || 0) - new Date(da || 0);
            });
            break;
        case 'oldest':
            items.sort((a, b) => {
                const da = a.signal.updatedAt || a.signal.last_verified_at || '';
                const db = b.signal.updatedAt || b.signal.last_verified_at || '';
                return new Date(da || 0) - new Date(db || 0);
            });
            break;
    }
}

// ===== Summary =====

/**
 * Produce summary counts by queue type.
 *
 * @param {Array} queueItems
 * @returns {Object} { [queueType]: count }
 */
export function getQualitySummary(queueItems) {
    const summary = {};
    for (const type of Object.values(QUEUE_TYPES)) {
        summary[type] = 0;
    }
    for (const item of queueItems) {
        summary[item.queueType] = (summary[item.queueType] || 0) + 1;
    }
    return summary;
}
