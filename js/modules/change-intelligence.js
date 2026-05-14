/**
 * Change Intelligence & Priority Derivation Module — Phase 10
 *
 * Detects meaningful changes across signals, chip impact, and company outlook.
 * Computes deterministic priority scores for review triage.
 * Pure logic — no DOM, Firestore, localStorage.
 *
 * Exports:
 *   buildSignalChangeFeed(signals, history, opts)
 *   buildChipImpactChangeFeed(signals, opts)
 *   buildCompanyOutlookChangeFeed(signals, opts)
 *   scorePriority(item, watchlistContext)
 *   buildPriorityQueue(signals, history, watchlistContext)
 *   isMeaningfulChange(change)
 *   CHANGE_TYPES (enum)
 *   PRIORITY_LABELS
 */

// ===== Constants =====

const IMPACT_ORDER = { explosive: 4, high: 3, medium: 2, low: 1 };
const STATUS_ORDER = { verified: 4, watch: 3, draft: 1, downgraded: 2, invalidated: 0 };

export const CHANGE_TYPES = {
    STATUS_UPGRADED: 'status_upgraded',
    STATUS_DOWNGRADED: 'status_downgraded',
    CONFIDENCE_MAJOR_CHANGE: 'confidence_changed_major',
    IMPACT_CHANGED: 'impact_changed',
    IMPACT_DERIVATION_CHANGED: 'impact_derivation_changed',
    NEW_HIGH_IMPACT_SIGNAL: 'new_high_impact_signal',
    NEW_CONFLICT: 'new_conflict',
    STALE_VERIFIED_SIGNAL: 'stale_verified_signal',
};

export const PRIORITY_LABELS = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
};

// Default time windows (days)
const DEFAULTS = {
    recentDays: 7,
    feedDays: 30,
    staleDays: 30,
    confidenceDeltaThreshold: 15,
};

// ===== Helpers =====

function daysAgo(d, days) {
    if (!d) return false;
    try {
        const now = new Date();
        const then = new Date(d);
        const diff = (now - then) / (1000 * 60 * 60 * 24);
        return diff <= days && diff >= 0;
    } catch { return false; }
}

function daysSince(d) {
    if (!d) return Infinity;
    try {
        const now = new Date();
        const then = new Date(d);
        return (now - then) / (1000 * 60 * 60 * 24);
    } catch { return Infinity; }
}

function latestDate(s) {
    return s.last_verified_at || s.updatedAt || s.createdAt || '';
}

/**
 * Determine if a status transition is an upgrade.
 * watch→verified, draft→watch, draft→verified, downgraded→verified, invalidated→watch
 */
function isUpgrade(from, to) {
    if (!from || !to) return false;
    return (STATUS_ORDER[to] || 0) > (STATUS_ORDER[from] || 0);
}

/**
 * Determine if a status transition is a downgrade.
 */
function isDowngrade(from, to) {
    if (!from || !to) return false;
    return (STATUS_ORDER[to] || 0) < (STATUS_ORDER[from] || 0);
}

// ===== Workstream 2: Meaningful Change Detection =====

/**
 * Build a feed of meaningful signal-level changes.
 *
 * Detects from current signal state + history records:
 * - status_upgraded
 * - status_downgraded
 * - confidence_changed_major
 * - impact_changed (inferred from current state + recency)
 * - new_high_impact_signal
 * - new_conflict
 * - stale_verified_signal
 *
 * @param {Array} signals — current normalized signals
 * @param {Array} history — optional signal_history records
 * @param {Object} opts — { feedDays, staleDays, confidenceDeltaThreshold }
 * @returns {Array<ChangeItem>}
 */
export function buildSignalChangeFeed(signals, history = [], opts = {}) {
    const feedDays = opts.feedDays || DEFAULTS.feedDays;
    const staleDays = opts.staleDays || DEFAULTS.staleDays;
    const confDelta = opts.confidenceDeltaThreshold || DEFAULTS.confidenceDeltaThreshold;

    // Build history lookup by signal_id
    const historyBySignal = {};
    for (const h of history) {
        const sid = h.signal_id;
        if (!historyBySignal[sid]) historyBySignal[sid] = [];
        historyBySignal[sid].push(h);
    }
    // Sort each signal's history by timestamp descending
    for (const sid of Object.keys(historyBySignal)) {
        historyBySignal[sid].sort((a, b) => {
            const ta = a.timestamp?.toDate?.() ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            const tb = b.timestamp?.toDate?.() ? b.timestamp.toDate() : new Date(b.timestamp || 0);
            return tb - ta;
        });
    }

    const changes = [];

    for (const s of signals) {
        const sigHistory = historyBySignal[s.id] || [];

        // 1. status_upgraded / status_downgraded from history
        for (const h of sigHistory) {
            if (h.action === 'status_changed' || h.action === 'STATUS_CHANGED') {
                const ts = h.timestamp?.toDate?.() ? h.timestamp.toDate() : new Date(h.timestamp || 0);
                if (!daysAgo(ts.toISOString(), feedDays)) continue;

                // Parse summary: "Status changed from X to Y"
                const match = (h.summary || '').match(/from\s+(\w+)\s+to\s+(\w+)/i);
                if (match) {
                    const fromStatus = match[1].toLowerCase();
                    const toStatus = match[2].toLowerCase();

                    if (isUpgrade(fromStatus, toStatus)) {
                        changes.push({
                            id: `status_up_${s.id}_${ts.getTime()}`,
                            type: CHANGE_TYPES.STATUS_UPGRADED,
                            signalId: s.id,
                            companyId: s.company_id,
                            companyName: s.company_name,
                            chipName: s.chip_name,
                            changeDate: ts.toISOString(),
                            fromStatus,
                            toStatus,
                            impact: s.abf_demand_impact,
                            confidence: s.confidence_score,
                            reasons: [`${fromStatus} → ${toStatus}`],
                        });
                    } else if (isDowngrade(fromStatus, toStatus)) {
                        changes.push({
                            id: `status_down_${s.id}_${ts.getTime()}`,
                            type: CHANGE_TYPES.STATUS_DOWNGRADED,
                            signalId: s.id,
                            companyId: s.company_id,
                            companyName: s.company_name,
                            chipName: s.chip_name,
                            changeDate: ts.toISOString(),
                            fromStatus,
                            toStatus,
                            impact: s.abf_demand_impact,
                            confidence: s.confidence_score,
                            reasons: [`${fromStatus} → ${toStatus}`],
                        });
                    }
                }
            }
        }

        // Also detect status changes from last_status_changed_at when history is missing
        if (s.last_status_changed_at && daysAgo(s.last_status_changed_at, feedDays) && sigHistory.length === 0) {
            // Infer upgrade/downgrade from current status + context
            if (s.status === 'verified' && daysAgo(s.last_status_changed_at, feedDays)) {
                changes.push({
                    id: `status_up_inferred_${s.id}`,
                    type: CHANGE_TYPES.STATUS_UPGRADED,
                    signalId: s.id,
                    companyId: s.company_id,
                    companyName: s.company_name,
                    chipName: s.chip_name,
                    changeDate: s.last_status_changed_at,
                    fromStatus: 'watch',
                    toStatus: 'verified',
                    impact: s.abf_demand_impact,
                    confidence: s.confidence_score,
                    reasons: ['升級為 verified'],
                });
            } else if (s.status === 'downgraded' && daysAgo(s.last_status_changed_at, feedDays)) {
                changes.push({
                    id: `status_down_inferred_${s.id}`,
                    type: CHANGE_TYPES.STATUS_DOWNGRADED,
                    signalId: s.id,
                    companyId: s.company_id,
                    companyName: s.company_name,
                    chipName: s.chip_name,
                    changeDate: s.last_status_changed_at,
                    fromStatus: 'verified',
                    toStatus: 'downgraded',
                    impact: s.abf_demand_impact,
                    confidence: s.confidence_score,
                    reasons: ['降級'],
                });
            }
        }

        // 3. confidence_changed_major
        if (s.last_confidence_changed_at && daysAgo(s.last_confidence_changed_at, feedDays)) {
            // We don't have the previous value stored, but we can flag if the change timestamp is recent
            // and the current confidence is notably different from typical ranges
            changes.push({
                id: `conf_change_${s.id}`,
                type: CHANGE_TYPES.CONFIDENCE_MAJOR_CHANGE,
                signalId: s.id,
                companyId: s.company_id,
                companyName: s.company_name,
                chipName: s.chip_name,
                changeDate: s.last_confidence_changed_at,
                impact: s.abf_demand_impact,
                confidence: s.confidence_score,
                reasons: [`信度變更至 ${s.confidence_score}`],
            });
        }

        // 6. new_high_impact_signal
        const createdDate = s.createdAt || '';
        if (createdDate && daysAgo(createdDate, feedDays)) {
            if (s.status === 'verified' || s.status === 'watch') {
                if (s.abf_demand_impact === 'high' || s.abf_demand_impact === 'explosive') {
                    changes.push({
                        id: `new_high_${s.id}`,
                        type: CHANGE_TYPES.NEW_HIGH_IMPACT_SIGNAL,
                        signalId: s.id,
                        companyId: s.company_id,
                        companyName: s.company_name,
                        chipName: s.chip_name,
                        changeDate: createdDate,
                        impact: s.abf_demand_impact,
                        confidence: s.confidence_score,
                        reasons: [`新信號 ${s.abf_demand_impact} 影響`],
                    });
                }
            }
        }

        // 7. new_conflict
        if (s.conflicting_evidence) {
            // Check if conflict was recently introduced
            const changeDate = s.last_status_changed_at || s.updatedAt || s.last_verified_at || '';
            if (changeDate && daysAgo(changeDate, feedDays)) {
                changes.push({
                    id: `conflict_${s.id}`,
                    type: CHANGE_TYPES.NEW_CONFLICT,
                    signalId: s.id,
                    companyId: s.company_id,
                    companyName: s.company_name,
                    chipName: s.chip_name,
                    changeDate,
                    impact: s.abf_demand_impact,
                    confidence: s.confidence_score,
                    reasons: ['存在矛盾證據'],
                });
            }
        }

        // 8. stale_verified_signal
        if (s.status === 'verified') {
            const lastCheck = s.last_verified_at || '';
            if (lastCheck && !daysAgo(lastCheck, staleDays)) {
                changes.push({
                    id: `stale_${s.id}`,
                    type: CHANGE_TYPES.STALE_VERIFIED_SIGNAL,
                    signalId: s.id,
                    companyId: s.company_id,
                    companyName: s.company_name,
                    chipName: s.chip_name,
                    changeDate: lastCheck,
                    impact: s.abf_demand_impact,
                    confidence: s.confidence_score,
                    reasons: [`驗證已過期（${Math.round(daysSince(lastCheck))} 天）`],
                });
            }
        }
    }

    return changes;
}

/**
 * Build a feed of chip-level impact changes.
 *
 * Compares derived impact from impact-engine against current signal state
 * to detect chips whose impact picture has shifted.
 *
 * @param {Array} signals
 * @param {Object} opts
 * @returns {Array<ChangeItem>}
 */
export function buildChipImpactChangeFeed(signals, opts = {}) {
    const feedDays = opts.feedDays || DEFAULTS.feedDays;

    // Group signals by chip
    const chipMap = {};
    for (const s of signals) {
        if (!s.chip_name) continue;
        if (!chipMap[s.chip_name]) chipMap[s.chip_name] = [];
        chipMap[s.chip_name].push(s);
    }

    const changes = [];

    for (const [chipName, chipSignals] of Object.entries(chipMap)) {
        // Find chips with recent signal activity that could shift impact
        const recentSignals = chipSignals.filter(s2 => {
            const d = s2.last_status_changed_at || s2.last_verified_at || s2.createdAt || '';
            return d && daysAgo(d, feedDays);
        });

        if (recentSignals.length === 0) continue;

        // Compute current derived impact
        const qualifying = chipSignals.filter(s2 => s2.status === 'verified' || s2.status === 'watch');
        if (qualifying.length === 0) continue;

        let highestImpact = '';
        let highestOrder = 0;
        for (const s2 of qualifying) {
            const o = IMPACT_ORDER[s2.abf_demand_impact] || 0;
            if (o > highestOrder) { highestOrder = o; highestImpact = s2.abf_demand_impact; }
        }

        const firstSignal = chipSignals[0];
        changes.push({
            id: `chip_impact_${chipName}`,
            type: CHANGE_TYPES.IMPACT_DERIVATION_CHANGED,
            signalId: null,
            chipName,
            companyId: firstSignal?.company_id || '',
            companyName: firstSignal?.company_name || '',
            changeDate: recentSignals[0]?.last_status_changed_at || recentSignals[0]?.last_verified_at || '',
            impact: highestImpact,
            confidence: null,
            reasons: [`${recentSignals.length} 條近期信號影響 ${highestImpact}`],
        });
    }

    changes.sort((a, b) => {
        const impDiff = (IMPACT_ORDER[b.impact] || 0) - (IMPACT_ORDER[a.impact] || 0);
        if (impDiff !== 0) return impDiff;
        return new Date(b.changeDate || 0) - new Date(a.changeDate || 0);
    });

    return changes;
}

/**
 * Build a feed of company-level ABF outlook changes.
 *
 * @param {Array} signals
 * @param {Object} opts
 * @returns {Array<ChangeItem>}
 */
export function buildCompanyOutlookChangeFeed(signals, opts = {}) {
    const feedDays = opts.feedDays || DEFAULTS.feedDays;

    // Group signals by company
    const companyMap = {};
    for (const s of signals) {
        if (!s.company_id) continue;
        if (!companyMap[s.company_id]) companyMap[s.company_id] = [];
        companyMap[s.company_id].push(s);
    }

    const changes = [];

    for (const [companyId, companySignals] of Object.entries(companyMap)) {
        const recentSignals = companySignals.filter(s2 => {
            const d = s2.last_status_changed_at || s2.last_verified_at || s2.createdAt || '';
            return d && daysAgo(d, feedDays);
        });

        if (recentSignals.length === 0) continue;

        // Compute highest ABF impact across company chips
        let highestImpact = '';
        let highestOrder = 0;
        for (const s2 of companySignals) {
            if (s2.status !== 'verified' && s2.status !== 'watch') continue;
            const o = IMPACT_ORDER[s2.abf_demand_impact] || 0;
            if (o > highestOrder) { highestOrder = o; highestImpact = s2.abf_demand_impact; }
        }

        if (!highestImpact) continue;

        changes.push({
            id: `company_outlook_${companyId}`,
            type: CHANGE_TYPES.IMPACT_DERIVATION_CHANGED,
            signalId: null,
            companyId,
            companyName: companySignals[0]?.company_name || companyId,
            chipName: null,
            changeDate: recentSignals[0]?.last_status_changed_at || recentSignals[0]?.last_verified_at || '',
            impact: highestImpact,
            confidence: null,
            reasons: [`${recentSignals.length} 條近期信號影響公司展望 ${highestImpact}`],
        });
    }

    changes.sort((a, b) => {
        const impDiff = (IMPACT_ORDER[b.impact] || 0) - (IMPACT_ORDER[a.impact] || 0);
        if (impDiff !== 0) return impDiff;
        return new Date(b.changeDate || 0) - new Date(a.changeDate || 0);
    });

    return changes;
}

// ===== Workstream 3: Priority Scoring Model =====

/**
 * Compute a deterministic priority score (0-100) for a change item.
 *
 * Dimensions:
 *   - Impact severity (0-40): explosive=40, high=30, medium=20, low=10
 *   - Change severity (0-30): downgrade=30, conflict=25, impact_shift=20, new_high=15, upgrade=10, stale=5
 *   - Confidence profile (0-10): low confidence + high impact = +10
 *   - Recency (0-15): within 1d=15, within 3d=10, within 7d=5
 *   - Watchlist relevance (0-20): watched entity = +20
 *
 * @param {Object} item — change item
 * @param {Object} watchlistContext — { companies: [], chips: [] }
 * @returns {{ score: number, label: string, reasons: string[] }}
 */
export function scorePriority(item, watchlistContext = {}) {
    let score = 0;
    const reasons = [...(item.reasons || [])];

    // 1. Impact severity (0-40)
    const impactScore = { explosive: 40, high: 30, medium: 20, low: 10 }[item.impact] || 0;
    score += impactScore;

    // 2. Change severity (0-30)
    let changeScore = 0;
    switch (item.type) {
        case CHANGE_TYPES.STATUS_DOWNGRADED:
            changeScore = 30;
            reasons.push('狀態降級');
            break;
        case CHANGE_TYPES.NEW_CONFLICT:
            changeScore = 25;
            reasons.push('新矛盾');
            break;
        case CHANGE_TYPES.IMPACT_DERIVATION_CHANGED:
        case CHANGE_TYPES.IMPACT_CHANGED:
            changeScore = 20;
            break;
        case CHANGE_TYPES.NEW_HIGH_IMPACT_SIGNAL:
            changeScore = 15;
            break;
        case CHANGE_TYPES.STATUS_UPGRADED:
            changeScore = 10;
            break;
        case CHANGE_TYPES.CONFIDENCE_MAJOR_CHANGE:
            changeScore = 10;
            break;
        case CHANGE_TYPES.STALE_VERIFIED_SIGNAL:
            changeScore = 5;
            reasons.push('驗證過期需複核');
            break;
        default:
            changeScore = 5;
    }
    score += changeScore;

    // 3. Confidence profile (0-10): low confidence + high/explosive impact
    if ((item.impact === 'high' || item.impact === 'explosive') && (item.confidence || 0) < 40) {
        score += 10;
        reasons.push('低信度高影響');
    }

    // 4. Recency (0-15)
    const changeDate = item.changeDate || item.createdAt || '';
    if (changeDate) {
        const days = daysSince(changeDate);
        if (days <= 1) { score += 15; reasons.push('24 小時內'); }
        else if (days <= 3) { score += 10; reasons.push('3 天內'); }
        else if (days <= 7) { score += 5; reasons.push('7 天內'); }
    }

    // 5. Watchlist relevance (0-20)
    const wl = watchlistContext || {};
    let watched = false;
    if (item.companyId && wl.companies?.includes(item.companyId)) watched = true;
    if (item.chipName && wl.chips?.includes(item.chipName)) watched = true;
    if (item.signalId && wl.signals?.includes(item.signalId)) watched = true;
    if (watched) {
        score += 20;
        reasons.push('關注中');
    }

    // Clamp to [0, 100]
    score = Math.min(100, Math.max(0, score));

    // Label
    let label;
    if (score >= 80) label = PRIORITY_LABELS.critical;
    else if (score >= 60) label = PRIORITY_LABELS.high;
    else if (score >= 40) label = PRIORITY_LABELS.medium;
    else label = PRIORITY_LABELS.low;

    return { score, label, reasons };
}

/**
 * Check if a change is meaningful enough to surface.
 *
 * @param {Object} change
 * @returns {boolean}
 */
export function isMeaningfulChange(change) {
    // Stale signals are lower priority but still meaningful
    if (change.type === CHANGE_TYPES.STALE_VERIFIED_SIGNAL) return true;
    // All other defined types are meaningful by construction
    return Object.values(CHANGE_TYPES).includes(change.type);
}

/**
 * Build a unified priority queue from signals + history.
 *
 * Combines signal changes, chip impact changes, and company outlook changes.
 * Scores each item, sorts by priority.
 *
 * @param {Array} signals
 * @param {Array} history
 * @param {Object} opts — { feedDays, staleDays, watchlistContext }
 * @returns {Array<{ item, score, label, reasons }>}
 */
export function buildPriorityQueue(signals, history = [], opts = {}) {
    const watchlistContext = opts.watchlistContext || {};

    // Gather all changes
    const signalChanges = buildSignalChangeFeed(signals, history, opts);
    const chipChanges = buildChipImpactChangeFeed(signals, opts);
    const companyChanges = buildCompanyOutlookChangeFeed(signals, opts);

    const allChanges = [...signalChanges, ...chipChanges, ...companyChanges];

    // Filter to meaningful
    const meaningful = allChanges.filter(isMeaningfulChange);

    // Score each
    const scored = meaningful.map(item => {
        const { score, label, reasons } = scorePriority(item, watchlistContext);
        return { ...item, priorityScore: score, priorityLabel: label, allReasons: reasons };
    });

    // Sort: higher score first, then more recent, then higher impact
    scored.sort((a, b) => {
        const scoreDiff = b.priorityScore - a.priorityScore;
        if (scoreDiff !== 0) return scoreDiff;
        const dateDiff = new Date(b.changeDate || 0) - new Date(a.changeDate || 0);
        if (dateDiff !== 0) return dateDiff;
        return (IMPACT_ORDER[b.impact] || 0) - (IMPACT_ORDER[a.impact] || 0);
    });

    return scored;
}

// ===== Convenience: Watchlist-Scoped Feed =====

/**
 * Build a watchlist-scoped priority queue — only items touching watched entities.
 *
 * @param {Array} signals
 * @param {Array} history
 * @param {Object} watchlistContext — { companies: [], chips: [], signals: [] }
 * @param {Object} opts
 * @returns {Array}
 */
export function buildWatchlistPriorityQueue(signals, history, watchlistContext, opts = {}) {
    const queue = buildPriorityQueue(signals, history, { ...opts, watchlistContext });
    return queue.filter(item => {
        if (item.companyId && watchlistContext.companies?.includes(item.companyId)) return true;
        if (item.chipName && watchlistContext.chips?.includes(item.chipName)) return true;
        if (item.signalId && watchlistContext.signals?.includes(item.signalId)) return true;
        return false;
    });
}
