/**
 * Entity Intelligence Derivation Module — Phase 8
 *
 * Shared derivation layer for company and chip intelligence dossiers.
 * All data derived from normalized signals; no external data sources.
 *
 * Exports:
 *   buildCompanyDossier(companyId, signals)
 *   buildChipDossier(chipName, signals)
 *   getCompanyChipPortfolio(companyId, signals)
 *   getChipCompanyContext(chipName, signals)
 *   getSiblingChips(companyId, signals, excludeChipName)
 *   getEntityRiskIndicators(entityType, entityId, signals)
 *   getVerificationTrend(signals, entityType, entityId, months=6)
 */

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

function formatDate(d) {
    if (!d) return '—';
    try { return new Date(d).toISOString().slice(0, 10); } catch { return '—'; }
}

function getMonthKey(dateStr) {
    if (!dateStr) return '';
    try { return new Date(dateStr).toISOString().slice(0, 7); } catch { return ''; }
}

/**
 * Build a comprehensive company intelligence dossier.
 *
 * @param {string} companyId
 * @param {Array} signals — full normalized signal array
 * @returns {Object} dossier
 */
export function buildCompanyDossier(companyId, signals) {
    const companySignals = signals.filter(s => s.company_id === companyId);
    const portfolio = getCompanyChipPortfolio(companyId, signals);
    const risks = getEntityRiskIndicators('company', companyId, signals);
    const trend = getVerificationTrend(signals, 'company', companyId, 6);

    // Compute latest signal date
    let latestDate = '';
    for (const s of companySignals) {
        const d = s.last_verified_at || s.updatedAt || s.createdAt || '';
        if (d > latestDate) latestDate = d;
    }

    // Compute highest impact
    let highestImpact = '';
    let highestImpactRank = 0;
    for (const s of companySignals) {
        const rank = IMPACT_SORT[s.abf_demand_impact] || 0;
        if (rank > highestImpactRank) {
            highestImpactRank = rank;
            highestImpact = s.abf_demand_impact;
        }
    }

    // Get company name from first signal
    const companyName = companySignals[0]?.company_name || companyId;
    const region = companySignals[0]?.region || '';

    return {
        companyId,
        companyName,
        region,
        signalCount: companySignals.length,
        latestDate,
        highestImpact,
        chipCount: portfolio.length,
        portfolio,
        risks,
        trend,
    };
}

/**
 * Build a comprehensive chip intelligence dossier.
 *
 * @param {string} chipName
 * @param {Array} signals — full normalized signal array
 * @returns {Object} dossier
 */
export function buildChipDossier(chipName, signals) {
    const chipSignals = signals.filter(s => s.chip_name === chipName);
    const companyContext = getChipCompanyContext(chipName, signals);
    const siblings = getSiblingChips(chipSignals[0]?.company_id || '', signals, chipName);
    const risks = getEntityRiskIndicators('chip', chipName, signals);

    // Compute latest signal date
    let latestDate = '';
    for (const s of chipSignals) {
        const d = s.last_verified_at || s.updatedAt || s.createdAt || '';
        if (d > latestDate) latestDate = d;
    }

    // Compute highest impact
    let highestImpact = '';
    let highestImpactRank = 0;
    for (const s of chipSignals) {
        const rank = IMPACT_SORT[s.abf_demand_impact] || 0;
        if (rank > highestImpactRank) {
            highestImpactRank = rank;
            highestImpact = s.abf_demand_impact;
        }
    }

    // Get primary company and specs from first signal
    const primarySignal = chipSignals[0];

    return {
        chipName,
        signalCount: chipSignals.length,
        latestDate,
        highestImpact,
        companyId: primarySignal?.company_id || '',
        companyName: primarySignal?.company_name || '',
        region: primarySignal?.region || '',
        specs: primarySignal ? {
            package_type: primarySignal.package_type || '',
            cowos_required: primarySignal.cowos_required || false,
            abf_size: primarySignal.abf_size || '',
            abf_layers: primarySignal.abf_layers || null,
            hbm: primarySignal.hbm || '',
        } : {},
        companyContext,
        siblings,
        risks,
    };
}

/**
 * Get the chip portfolio for a company.
 *
 * @param {string} companyId
 * @param {Array} signals
 * @returns {Array<{ chipName, signalCount, highestImpact, latestDate }>}
 */
export function getCompanyChipPortfolio(companyId, signals) {
    const companySignals = signals.filter(s => s.company_id === companyId);
    const chipMap = {};

    for (const s of companySignals) {
        const cn = s.chip_name;
        if (!cn) continue;
        if (!chipMap[cn]) {
            chipMap[cn] = { chipName: cn, signalCount: 0, highestImpactRank: 0, highestImpact: '', latestDate: '' };
        }
        const c = chipMap[cn];
        c.signalCount++;
        const rank = IMPACT_SORT[s.abf_demand_impact] || 0;
        if (rank > c.highestImpactRank) {
            c.highestImpactRank = rank;
            c.highestImpact = s.abf_demand_impact;
        }
        const d = s.last_verified_at || s.updatedAt || s.createdAt || '';
        if (d > c.latestDate) c.latestDate = d;
    }

    const portfolio = Object.values(chipMap);
    portfolio.sort((a, b) => b.highestImpactRank - a.highestImpactRank || b.signalCount - a.signalCount);
    return portfolio;
}

/**
 * Get company context for a chip.
 *
 * @param {string} chipName
 * @param {Array} signals
 * @returns {Object} { companyId, companyName, region, totalCompanySignals, otherChipCount }
 */
export function getChipCompanyContext(chipName, signals) {
    const chipSignals = signals.filter(s => s.chip_name === chipName);
    if (chipSignals.length === 0) return {};

    const companyId = chipSignals[0].company_id;
    const companyName = chipSignals[0].company_name;
    const region = chipSignals[0].region;
    const companySignals = signals.filter(s => s.company_id === companyId);
    const otherChips = new Set(companySignals.map(s => s.chip_name).filter(n => n !== chipName));

    return {
        companyId,
        companyName,
        region,
        totalCompanySignals: companySignals.length,
        otherChipCount: otherChips.size,
    };
}

/**
 * Get sibling chips from the same company.
 *
 * @param {string} companyId
 * @param {Array} signals
 * @param {string} excludeChipName — chip to exclude
 * @returns {Array<{ chipName, signalCount }>}
 */
export function getSiblingChips(companyId, signals, excludeChipName) {
    if (!companyId) return [];

    const companySignals = signals.filter(s => s.company_id === companyId && s.chip_name !== excludeChipName);
    const chipMap = {};

    for (const s of companySignals) {
        const cn = s.chip_name;
        if (!cn) continue;
        if (!chipMap[cn]) chipMap[cn] = { chipName: cn, signalCount: 0 };
        chipMap[cn].signalCount++;
    }

    return Object.values(chipMap).sort((a, b) => b.signalCount - a.signalCount);
}

/**
 * Get risk indicators for an entity.
 *
 * @param {'company' | 'chip'} entityType
 * @param {string} entityId — company_id or chip_name
 * @param {Array} signals
 * @returns {Object} { conflictingEvidenceCount, lowConfHighImpactCount, staleVerificationCount }
 */
export function getEntityRiskIndicators(entityType, entityId, signals) {
    const entitySignals = entityType === 'company'
        ? signals.filter(s => s.company_id === entityId)
        : signals.filter(s => s.chip_name === entityId);

    let conflictingEvidenceCount = 0;
    let lowConfHighImpactCount = 0;
    let staleVerificationCount = 0;

    for (const s of entitySignals) {
        if (s.conflicting_evidence) conflictingEvidenceCount++;

        if ((s.abf_demand_impact === 'high' || s.abf_demand_impact === 'explosive') && s.confidence_score < 40) {
            lowConfHighImpactCount++;
        }

        if (s.last_verified_at && !daysAgo(s.last_verified_at, 60)) {
            staleVerificationCount++;
        }
    }

    return {
        conflictingEvidenceCount,
        lowConfHighImpactCount,
        staleVerificationCount,
        totalRiskSignals: conflictingEvidenceCount + lowConfHighImpactCount + staleVerificationCount,
    };
}

/**
 * Get verification trend — signal count by month for the last N months.
 *
 * @param {Array} signals
 * @param {'company' | 'chip'} entityType
 * @param {string} entityId
 * @param {number} months — default 6
 * @returns {Array<{ month, count }>}
 */
export function getVerificationTrend(signals, entityType, entityId, months = 6) {
    const entitySignals = entityType === 'company'
        ? signals.filter(s => s.company_id === entityId)
        : signals.filter(s => s.chip_name === entityId);

    // Count signals by month
    const monthCounts = {};
    for (const s of entitySignals) {
        const d = s.last_verified_at || s.createdAt || '';
        const mk = getMonthKey(d);
        if (mk) monthCounts[mk] = (monthCounts[mk] || 0) + 1;
    }

    // Generate last N months
    const now = new Date();
    const trend = [];
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mk = d.toISOString().slice(0, 7);
        trend.push({ month: mk, count: monthCounts[mk] || 0 });
    }

    return trend;
}
