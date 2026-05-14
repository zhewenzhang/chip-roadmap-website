/**
 * Insights Derived Data Pipeline — V2
 *
 * Builds signal-derived intelligence summaries for the insights page.
 * All modules are computed from normalized signals data.
 *
 * Exports:
 *   buildRecentSignalCounts(signals, days=30)
 *   buildRecentUpgrades(signals, days=30)
 *   buildHighImpactRecentSignals(signals, days=30)
 *   buildRiskSignals(signals)
 */

const IMPACT_LABELS = { explosive: '爆炸性', high: '高', medium: '中', low: '低' };
const STATUS_LABELS = { verified: '已驗證', watch: '觀望', draft: '草稿', downgraded: '降級', invalidated: '失效' };
const IMPACT_SORT = { explosive: 4, high: 3, medium: 2, low: 1 };

function daysAgo(d, days) {
    if (!d) return false;
    try {
        const now = new Date();
        const then = new Date(d);
        const diff = (now - then) / (1000 * 60 * 60 * 24);
        return diff <= days && diff >= 0;
    } catch { return false; }
}

/**
 * Module 1: Recent 30-day signal counts by company.
 *
 * @param {Array} signals
 * @param {number} days — window (default 30)
 * @returns {Array<{ companyId, companyName, count, chips }>} sorted by count desc
 */
export function buildRecentSignalCounts(signals, days = 30) {
    const now = new Date();
    const counts = {};

    for (const s of signals) {
        const cid = s.company_id;
        if (!cid) continue;

        // Count signals created or updated within the window
        const d = s.createdAt || s.last_verified_at || s.updatedAt || '';
        if (!daysAgo(d, days)) continue;

        if (!counts[cid]) {
            counts[cid] = { companyId: cid, companyName: s.company_name, count: 0, chips: new Set() };
        }
        counts[cid].count++;
        if (s.chip_name) counts[cid].chips.add(s.chip_name);
    }

    const result = Object.values(counts).map(c => ({ ...c, chips: [...c.chips] }));
    result.sort((a, b) => b.count - a.count);
    return result;
}

/**
 * Module 2: Recent status upgrades (e.g., watch → verified).
 *
 * Uses last_status_changed_at and current status.
 * Also includes signals that became recently verified.
 *
 * @param {Array} signals
 * @param {number} days — window (default 30)
 * @returns {Array<{ signal, fromStatus, toStatus, date }>}
 */
export function buildRecentUpgrades(signals, days = 30) {
    const upgrades = [];

    for (const s of signals) {
        if (!s.last_status_changed_at) continue;
        if (!daysAgo(s.last_status_changed_at, days)) continue;

        // If current status is verified and there was a recent change, it's likely an upgrade
        if (s.status === 'verified') {
            upgrades.push({
                signal: s,
                fromStatus: 'watch', // inferred — actual history in signal_history
                toStatus: 'verified',
                date: s.last_status_changed_at,
            });
        } else if (s.status === 'watch') {
            upgrades.push({
                signal: s,
                fromStatus: 'draft',
                toStatus: 'watch',
                date: s.last_status_changed_at,
            });
        }
    }

    upgrades.sort((a, b) => new Date(b.date) - new Date(a.date));
    return upgrades;
}

/**
 * Module 3: High ABF impact signals from the last 30 days.
 *
 * @param {Array} signals
 * @param {number} days — window (default 30)
 * @returns {Array<{ signal }>} sorted by impact + confidence
 */
export function buildHighImpactRecentSignals(signals, days = 30) {
    const items = [];

    for (const s of signals) {
        if (s.abf_demand_impact !== 'high' && s.abf_demand_impact !== 'explosive') continue;
        const d = s.last_verified_at || s.updatedAt || s.createdAt || '';
        if (!daysAgo(d, days)) continue;

        items.push({ signal: s });
    }

    items.sort((a, b) => {
        const impDiff = (IMPACT_SORT[b.signal.abf_demand_impact] || 0) - (IMPACT_SORT[a.signal.abf_demand_impact] || 0);
        if (impDiff !== 0) return impDiff;
        return b.signal.confidence_score - a.signal.confidence_score;
    });

    return items;
}

/**
 * Module 4: Risk-oriented signals.
 *
 * Includes:
 *   - signals with conflicting evidence
 *   - signals that are verified but recently changed (review needed)
 *   - signals with low confidence but high impact
 *
 * @param {Array} signals
 * @returns {Array<{ signal, riskType, reason }>}
 */
export function buildRiskSignals(signals) {
    const risks = [];

    for (const s of signals) {
        // Conflicting evidence present
        if (s.conflicting_evidence) {
            risks.push({
                signal: s,
                riskType: 'conflicting',
                reason: '存在矛盾證據',
            });
        }

        // Verified but recently changed (needs review)
        if (s.status === 'verified' && s.last_status_changed_at) {
            if (daysAgo(s.last_status_changed_at, 14)) {
                risks.push({
                    signal: s,
                    riskType: 'recent_change',
                    reason: '已驗證但近期狀態變更',
                });
            }
        }

        // Low confidence but high/explosive impact
        if ((s.abf_demand_impact === 'high' || s.abf_demand_impact === 'explosive') && s.confidence_score < 40) {
            risks.push({
                signal: s,
                riskType: 'low_conf_high_impact',
                reason: `高影響但信度偏低（${s.confidence_score}）`,
            });
        }
    }

    // Sort by severity: conflicting first, then recent_change, then low_conf
    const RISK_ORDER = { conflicting: 3, recent_change: 2, low_conf_high_impact: 1 };
    risks.sort((a, b) => (RISK_ORDER[b.riskType] || 0) - (RISK_ORDER[a.riskType] || 0));

    return risks;
}

/**
 * Get traffic light color for a signal.
 * Returns 'red', 'yellow', or 'green'.
 */
export function getLampColor(signal) {
    if (signal.status === 'downgraded' || signal.status === 'invalidated') return 'red';
    if (signal.conflicting_evidence && signal.conflicting_evidence.trim()) return 'red';
    if (signal.status === 'verified' && (signal.abf_demand_impact === 'high' || signal.abf_demand_impact === 'explosive')) return 'green';
    if (signal.status === 'watch' || signal.abf_demand_impact === 'medium') return 'yellow';
    return 'yellow';
}

/**
 * Format date as YYYY-MM-DD.
 */
export function formatDate(d) {
    if (!d) return '—';
    try { return new Date(d).toISOString().slice(0, 10); } catch { return '—'; }
}

/**
 * Helper labels.
 */
export { IMPACT_LABELS, STATUS_LABELS };
