/**
 * Impact Engine — Phase 9
 *
 * Deterministic derivation of chip-to-ABF impact and company-level ABF outlook
 * from normalized signal data. Pure logic, no DOM / Firestore / localStorage.
 *
 * Exports:
 *   deriveChipImpact(chipName, signals)
 *   deriveCompanyAbfOutlook(companyId, signals)
 *   summarizeDrivingSignals(signals)
 *   isImpactDerivable(signals)
 */

const STAGE_ORDER = { volume: 7, ramp: 6, pilot: 5, design_win: 4, sampling: 3, announced: 2, rumor: 1 };
const IMPACT_ORDER = { explosive: 4, high: 3, medium: 2, low: 1 };

function statusWeight(status) {
    if (status === 'verified') return 1.0;
    if (status === 'watch') return 0.5;
    return 0;
}

function qualifiesForImpact(signal) {
    return signal.status === 'verified' || signal.status === 'watch';
}

function pickMostRecent(signals, field) {
    const withValue = signals.filter(s => s[field]);
    if (withValue.length === 0) return { value: null, source: null };
    withValue.sort((a, b) => new Date(b.last_verified_at || b.updatedAt || b.createdAt || 0) -
                              new Date(a.last_verified_at || a.updatedAt || a.createdAt || 0));
    return { value: withValue[0][field], source: withValue[0].id };
}

function pickHighestStage(signals) {
    let bestStage = '';
    let bestOrder = 0;
    for (const s of signals) {
        const o = STAGE_ORDER[s.stage] || 0;
        if (o > bestOrder) { bestOrder = o; bestStage = s.stage; }
    }
    return bestStage;
}

function pickHighestImpact(signals) {
    let bestImpact = '';
    let bestOrder = 0;
    for (const s of signals) {
        const o = IMPACT_ORDER[s.abf_demand_impact] || 0;
        if (o > bestOrder) { bestOrder = o; bestImpact = s.abf_demand_impact; }
    }
    return bestImpact;
}

function computeDerivedConfidence(signals) {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const s of signals) {
        const w = statusWeight(s.status);
        if (w > 0) {
            weightedSum += (s.confidence_score || 0) * w;
            weightTotal += w;
        }
    }
    if (weightTotal === 0) return null;
    return Math.round(weightedSum / weightTotal);
}

function getMostCommonValue(signals, field) {
    const counts = {};
    const sources = {};
    for (const s of signals) {
        if (!s[field]) continue;
        const v = String(s[field]);
        counts[v] = (counts[v] || 0) + 1;
        if (!sources[v]) sources[v] = [];
        sources[v].push(s.id);
    }
    const keys = Object.keys(counts);
    if (keys.length === 0) return { value: null, conflicting: false, sources: [] };
    if (keys.length === 1) return { value: keys[0], conflicting: false, sources: sources[keys[0]] };
    // Multiple distinct values → conflicting
    // Pick the most common one
    let mostCommon = keys[0];
    for (const k of keys) {
        if (counts[k] > counts[mostCommon]) mostCommon = k;
    }
    return { value: mostCommon, conflicting: true, sources: sources[mostCommon] };
}

function getMedianAndRange(signals, field) {
    const values = signals.map(s => s[field]).filter(v => v != null && !isNaN(Number(v))).map(Number);
    if (values.length === 0) return { value: null, range: null, sources: [] };
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 === 1 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
    const min = values[0];
    const max = values[values.length - 1];
    const range = min === max ? null : [min, max];
    const sourceIds = signals.filter(s => s[field] != null).map(s => s.id);
    return { value: median, range, sources: sourceIds };
}

/**
 * Check if any signals qualify for impact derivation.
 */
export function isImpactDerivable(signals) {
    return signals.some(qualifiesForImpact);
}

/**
 * Summarize driving signals for an impact derivation.
 */
export function summarizeDrivingSignals(signals) {
    const driving = [];
    const conflicting = [];
    for (const s of signals) {
        if (!qualifiesForImpact(s)) continue;
        driving.push({
            id: s.id,
            status: s.status,
            stage: s.stage,
            confidence: s.confidence_score,
            last_verified_at: s.last_verified_at,
            contribution: statusWeight(s.status),
        });
    }
    driving.sort((a, b) => new Date(b.last_verified_at || 0) - new Date(a.last_verified_at || 0));

    // Detect conflicts in abf_size and abf_layers
    const sizeResult = getMostCommonValue(signals.filter(qualifiesForImpact), 'abf_size');
    const layersResult = getMedianAndRange(signals.filter(qualifiesForImpact), 'abf_layers');

    if (sizeResult.conflicting) {
        const allSizes = {};
        for (const s of signals.filter(qualifiesForImpact)) {
            if (s.abf_size) {
                if (!allSizes[s.abf_size]) allSizes[s.abf_size] = [];
                allSizes[s.abf_size].push(s.id);
            }
        }
        for (const [val, ids] of Object.entries(allSizes)) {
            if (val !== sizeResult.value) {
                conflicting.push({ id: ids[0], reason: `ABF 尺寸分歧: "${val}" vs "${sizeResult.value}"` });
            }
        }
    }

    if (layersResult.range) {
        for (const s of signals.filter(qualifiesForImpact)) {
            if (s.abf_layers != null) {
                const v = Number(s.abf_layers);
                if (v !== layersResult.value) {
                    conflicting.push({ id: s.id, reason: `ABF 層數分歧: ${v} vs ${layersResult.value}` });
                }
            }
        }
    }

    return { driving, conflicting };
}

/**
 * Derive chip-level ABF / packaging impact summary.
 *
 * @param {string} chipName
 * @param {Array} signals — full normalized signal array
 * @returns {Object} impact summary
 */
export function deriveChipImpact(chipName, signals) {
    const chipSignals = signals.filter(s => s.chip_name === chipName);
    const qualifying = chipSignals.filter(qualifiesForImpact);

    if (qualifying.length === 0) {
        return {
            chipName,
            insufficientData: true,
            reasonsByField: {},
        };
    }

    // ABF demand impact
    const abfDemandImpact = pickHighestImpact(qualifying);
    const verifiedCount = qualifying.filter(s => s.status === 'verified').length;
    const watchCount = qualifying.filter(s => s.status === 'watch').length;

    // ABF size consensus
    const abfSize = getMostCommonValue(qualifying, 'abf_size');

    // ABF layers consensus
    const abfLayers = getMedianAndRange(qualifying, 'abf_layers');

    // CoWoS dependency
    const cowosVerified = qualifying.some(s => s.cowos_required === true);
    const cowosWatch = chipSignals.some(s => (s.status === 'watch' || s.status === 'draft') && s.cowos_required === true);
    let cowosDependency = 'No';
    if (cowosVerified) cowosDependency = 'Yes';
    else if (cowosWatch) cowosDependency = 'Likely';

    // HBM
    const hbm = pickMostRecent(qualifying, 'hbm');
    if (!hbm.value) {
        const hbmWatch = pickMostRecent(chipSignals.filter(s => s.status === 'watch'), 'hbm');
        hbm.value = hbmWatch.value;
        hbm.source = hbmWatch.source;
    }

    // Volume outlook
    const volume = pickMostRecent(qualifying, 'expected_volume');

    // Stage outlook
    const stageOutlook = pickHighestStage(qualifying);

    // Derived confidence
    const derivedConfidence = computeDerivedConfidence(qualifying);

    // Driving signals
    const { driving: drivingSignals, conflicting: conflictingSignals } = summarizeDrivingSignals(chipSignals);

    // Reason text generation
    const reasonsByField = {};
    reasonsByField.abf_demand_impact = `基於 ${verifiedCount} 條 verified、${watchCount} 條 watch 信號，最高 ${abfDemandImpact}`;

    if (abfSize.value) {
        reasonsByField.abf_size = abfSize.conflicting
            ? `${qualifying.filter(s => s.abf_size).length} 條信號中有分歧，最常見 "${abfSize.value}"`
            : `${qualifying.filter(s => s.abf_size).length} 條信號一致為 ${abfSize.value}`;
    }

    if (abfLayers.value != null) {
        reasonsByField.abf_layers = abfLayers.range
            ? `${qualifying.filter(s => s.abf_layers != null).length} 條信號值域 ${abfLayers.range[0]} ~ ${abfLayers.range[1]}`
            : `${qualifying.filter(s => s.abf_layers != null).length} 條信號一致為 ${abfLayers.value} 層`;
    }

    const cowosCount = qualifying.filter(s => s.cowos_required).length;
    reasonsByField.cowos_dependency = cowosCount > 0
        ? `${cowosCount} 條 verified/watch 信號標記 CoWoS required`
        : '無信號標記 CoWoS required';

    if (hbm.value) reasonsByField.hbm = `最近 verified 信號標記 ${hbm.value}`;
    if (volume.value) reasonsByField.volume_outlook = `最近 verified 信號標記 ${volume.value}`;
    reasonsByField.stage_outlook = `最高階段 ${stageOutlook}（${verifiedCount} verified、${watchCount} watch）`;

    return {
        chipName,
        abfDemandImpact,
        abfSize,
        abfLayers,
        cowosDependency,
        hbm: { value: hbm.value, source: hbm.source },
        volumeOutlook: { value: volume.value, source: volume.source },
        stageOutlook,
        derivedConfidence,
        drivingSignals,
        conflictingSignals,
        insufficientData: false,
        reasonsByField,
        verifiedCount,
        watchCount,
    };
}

/**
 * Derive company-level ABF demand outlook.
 *
 * @param {string} companyId
 * @param {Array} signals — full normalized signal array
 * @returns {Object} company ABF outlook
 */
export function deriveCompanyAbfOutlook(companyId, signals) {
    const companySignals = signals.filter(s => s.company_id === companyId);
    const chips = [...new Set(companySignals.map(s => s.chip_name).filter(Boolean))];

    if (chips.length === 0 || !isImpactDerivable(companySignals)) {
        return {
            companyId,
            companyName: companySignals[0]?.company_name || companyId,
            insufficientData: true,
        };
    }

    // Per-chip impact derivation
    const chipImpacts = chips.map(name => deriveChipImpact(name, companySignals));

    // Highest ABF demand impact across chips
    const impactChips = chipImpacts.filter(c => c.abfDemandImpact);
    const overallImpact = impactChips.length > 0
        ? pickHighestImpact(impactChips.map(c => ({ abf_demand_impact: c.abfDemandImpact })))
        : null;

    // Count chips with CoWoS Yes
    const cowosChips = chipImpacts.filter(c => c.cowosDependency === 'Yes').length;

    // Count chips at advanced stages
    const advancedStages = ['pilot', 'ramp', 'volume'];
    const advancedChips = chipImpacts.filter(c => advancedStages.includes(c.stageOutlook)).length;

    // ABF layer range across chips
    const allLayers = [];
    for (const c of chipImpacts) {
        if (c.abfLayers.value != null) allLayers.push(c.abfLayers.value);
        if (c.abfLayers.range) {
            allLayers.push(c.abfLayers.range[0], c.abfLayers.range[1]);
        }
    }
    const layerMin = allLayers.length > 0 ? Math.min(...allLayers) : null;
    const layerMax = allLayers.length > 0 ? Math.max(...allLayers) : null;
    const abfLayerRange = layerMin !== null && layerMax !== layerMin ? [layerMin, layerMax] : null;

    // Top 3 chips by impact
    const sorted = chipImpacts
        .filter(c => !c.insufficientData)
        .sort((a, b) => (IMPACT_ORDER[b.abfDemandImpact] || 0) - (IMPACT_ORDER[a.abfDemandImpact] || 0) ||
                         (b.derivedConfidence || 0) - (a.derivedConfidence || 0))
        .slice(0, 3)
        .map(c => ({ chipName: c.chipName, impact: c.abfDemandImpact, confidence: c.derivedConfidence }));

    return {
        companyId,
        companyName: companySignals[0]?.company_name || companyId,
        overallImpact,
        cowosChipCount: cowosChips,
        advancedChipCount: advancedChips,
        abfLayerRange,
        topChips: sorted,
        chipImpacts,
        insufficientData: overallImpact === null,
    };
}
