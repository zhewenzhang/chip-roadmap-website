/**
 * Signal Validation Pipeline — Phase 16
 *
 * Shared validation + company resolver for ALL entry points:
 *   Manual (collectSignalForm), Import (validateRow), AI Extract (classifyAiCandidates)
 *
 * Exports:
 *   validateSignalShape(data) → { ok, errors, normalized }
 *   resolveCompanyId(name, companies) → { resolved, candidateId, candidateName, confidence }
 */

import {
    STAGE_ENUM, STATUS_ENUM, IMPACT_ENUM, REGION_OPTIONS,
} from '../js/modules/signals-schema.js';

// ===== Simplified ↔ Traditional Chinese Mapping =====
// Maps Simplified → Traditional for the characters found in V2 target company names.
// T_TO_S is built automatically as the reverse mapping.
const S_TO_T = {
    '华': '華', '为': '為', '尔': '爾', '电': '電', '讯': '訊',
    '飞': '飛', '亚': '亞', '当': '當', '击': '擊', '术': '術',
    '网': '網', '络': '絡', '设': '設', '备': '備', '车': '車',
    '东': '東', '门': '門', '问': '問', '关': '關', '兴': '興',
    '产': '產', '发': '發', '体': '體', '导': '導', '马': '馬',
    '龙': '龍', '齐': '齊', '丰': '豐', '优': '優', '传': '傳',
    '伟': '偉', '伦': '倫', '协': '協', '历': '歷', '压': '壓',
    '参': '參', '双': '雙', '变': '變', '号': '號', '湾': '灣',
    '韩': '韓', '长': '長', '际': '際', '阶': '階', '随': '隨',
    '隐': '隱', '难': '難', '雾': '霧', '领': '領', '风': '風',
    '麦': '麥', '腾': '騰', '胜': '勝', '脑': '腦', '芯': '芯',
    '纪': '紀', '云': '雲', '苹': '蘋', '线': '線', '数': '數',
    '积': '積', '硕': '碩', '开': '開', '节': '節', '动': '動',
    '里': '裡', '逊': '遜', '谷': '穀', '软': '軟', '微': '微',
    '歌': '歌', '果': '果', '摩': '摩', '程': '程', '壁': '壁',
    '仞': '仞', '燧': '燧', '路': '路', '鼎': '鼎', '寒': '寒',
    '武': '武', '曼': '曼', '深': '深', '度': '度', '字': '字',
    '跳': '跳', '昆': '崑', '仑': '崙', '百': '百',
};

const T_TO_S = {};
for (const [s, t] of Object.entries(S_TO_T)) {
    if (!(t in T_TO_S)) T_TO_S[t] = s;
}

function toNormalizedForm(s) {
    // Fold Simplified → Traditional. Characters already in Traditional pass through.
    // Latin characters pass through unchanged.
    return s.split('').map(c => S_TO_T[c] || c).join('');
}

/**
 * Resolve a company name or alias to an internal company_id.
 *
 * Matching strategies (in order):
 * 1. Exact match on company.id (case-insensitive)
 * 2. Exact match on name_en or name_cn
 * 3. Fuzzy: lowercase + remove punctuation/diacritics, compare normalized names
 *
 * @param {string} name — company name from any source (AI, Excel, manual)
 * @param {Array} companies — array of company objects from Firestore
 * @returns {{ resolved: boolean, candidateId: string, candidateName: string, confidence: 'high'|'low' }}
 */
export function resolveCompanyId(name, companies = []) {
    if (!name || typeof name !== 'string') {
        return { resolved: false, candidateId: '', candidateName: '', confidence: 'low' };
    }

    const input = name.trim();
    if (!input) {
        return { resolved: false, candidateId: '', candidateName: '', confidence: 'low' };
    }

    // Strategy 1: exact match on id (case-insensitive)
    const byId = companies.find(c => c.id?.toLowerCase() === input.toLowerCase());
    if (byId) {
        return { resolved: true, candidateId: byId.id, candidateName: byId.name_en || byId.name || '', confidence: 'high' };
    }

    // Strategy 2: exact match on name_en or name_cn (with S↔T normalization)
    const normInputCJK = toNormalizedForm(input.toLowerCase());
    const byName = companies.find(c => {
        const n1 = c.name_en?.toLowerCase();
        const n2 = toNormalizedForm(c.name_cn?.toLowerCase() || '');
        const n3 = toNormalizedForm(c.name?.toLowerCase() || '');
        const target = normInputCJK;
        return n1 === target || n2 === target || n3 === target;
    });
    if (byName) {
        return { resolved: true, candidateId: byName.id, candidateName: byName.name_en || byName.name || '', confidence: 'high' };
    }

    // Strategy 3: fuzzy — normalize (CJK-preserving) and compare
    const normalize = s => s
        .toLowerCase()
        .replace(/[\p{P}]/gu, '')  // remove only punctuation (Unicode property), preserves CJK
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove diacritics
        .replace(/\s+/g, ' ')
        .trim();

    // CJK-aware normalize: apply S↔T fold then punctuation removal
    const normInput = normalize(toNormalizedForm(input));

    // Skip fuzzy if input is too short (1 char is too generic)
    if (normInput.length < 2) {
        return { resolved: false, candidateId: '', candidateName: '', confidence: 'low' };
    }

    const fuzzyMatches = [];

    for (const c of companies) {
        for (const field of ['name_en', 'name_cn', 'name']) {
            const val = c[field];
            if (!val) continue;
            // Apply CJK normalization before fuzzy comparison
            const normVal = normalize(toNormalizedForm(val));
            // Require significant overlap: input must be at least 60% of the company name
            // or the company name must be contained within the input
            const inputInVal = normVal.includes(normInput);
            const valInInput = normInput.includes(normVal);
            const overlapRatio = Math.min(normInput.length, normVal.length) / Math.max(normInput.length, normVal.length);
            if ((inputInVal || valInInput) && overlapRatio >= 0.5) {
                fuzzyMatches.push({ company: c, score: (inputInVal && valInInput) ? 3 : 2 });
                break;  // avoid counting same company multiple times
            }
        }
    }

    if (fuzzyMatches.length > 0) {
        // Pick highest confidence match
        fuzzyMatches.sort((a, b) => b.score - a.score);
        const best = fuzzyMatches[0];
        return {
            resolved: true,
            candidateId: best.company.id,
            candidateName: best.company.name_en || best.company.name || '',
            confidence: best.score === 3 ? 'high' : 'low',
        };
    }

    return { resolved: false, candidateId: '', candidateName: '', confidence: 'low' };
}

// ===== Signal Shape Validation =====

/**
 * Validate that a signal has the minimum required fields for creation.
 *
 * Required minimum: title, company_id, company_name, chip_name, region.
 * Other fields (stage, status, confidence_score, abf_demand_impact) have
 * defaults in normalizeSignal and are NOT required here.
 *
 * @param {Object} data — raw signal data from any entry point
 * @returns {{ ok: boolean, errors: string[], normalized: Object }}
 */
export function validateSignalShape(data) {
    const errors = [];

    if (!data) {
        return { ok: false, errors: ['No data provided'], normalized: {} };
    }

    // Trim all string fields
    const cleaned = {};
    for (const [key, val] of Object.entries(data)) {
        cleaned[key] = typeof val === 'string' ? val.trim() : val;
    }

    // Required fields (minimum for createSignal)
    const requiredFields = ['title', 'company_id', 'company_name', 'chip_name', 'region'];
    for (const field of requiredFields) {
        if (!cleaned[field]) {
            errors.push(`缺少必填欄位: ${field}`);
        }
    }

    // Validate enums if present
    if (cleaned.stage && !STAGE_ENUM.includes(cleaned.stage)) {
        errors.push(`無效 stage: "${cleaned.stage}" (可用: ${STAGE_ENUM.join(', ')})`);
    }
    if (cleaned.status && !STATUS_ENUM.includes(cleaned.status)) {
        errors.push(`無效 status: "${cleaned.status}" (可用: ${STATUS_ENUM.join(', ')})`);
    }
    if (cleaned.region && !REGION_OPTIONS.includes(cleaned.region)) {
        errors.push(`無效 region: "${cleaned.region}" (可用: ${REGION_OPTIONS.join(', ')})`);
    }
    if (cleaned.abf_demand_impact && !IMPACT_ENUM.includes(cleaned.abf_demand_impact)) {
        errors.push(`無效 abf_demand_impact: "${cleaned.abf_demand_impact}" (可用: ${IMPACT_ENUM.join(', ')})`);
    }

    // Validate confidence_score if present
    if (cleaned.confidence_score !== undefined && cleaned.confidence_score !== '') {
        const conf = Number(cleaned.confidence_score);
        if (isNaN(conf) || conf < 0 || conf > 100) {
            errors.push(`confidence_score 必須是 0-100 的數字: "${cleaned.confidence_score}"`);
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        normalized: cleaned,
    };
}
