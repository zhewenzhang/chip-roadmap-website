/**
 * Admin AI Extract Helper Module — Phase 14
 *
 * Responsibilities:
 * - DeepSeek settings get/save (localStorage)
 * - Extraction prompt get/save/reset (localStorage)
 * - DeepSeek API call (fetch, OpenAI-compatible shape)
 * - JSON extraction from model output
 * - AI candidate signal normalization
 *
 * Does NOT:
 * - store API keys in Firestore or source code
 * - expose keys to public pages
 * - write to Firestore directly
 */

import { classifyImportRow, validateRow } from './import-signals.js';
import { resolveCompanyId, validateSignalShape } from './signal-validation.js';

// ===== Settings =====

export const AI_SETTINGS_KEYS = {
    apiKey: 'chiproadmap.deepseek.apiKey',
    baseUrl: 'chiproadmap.deepseek.baseUrl',
    model: 'chiproadmap.deepseek.model',
    prompt: 'chiproadmap.deepseek.extractionPrompt',
};

const DEFAULTS = {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
};

export const DEFAULT_EXTRACTION_PROMPT = `你是半導體 AI 芯片、先進封裝與 ABF 載板供應鏈情報分析員。

你的任務是從輸入材料中抽取「可被人類後續驗證」的 supply-chain signals。

只輸出 JSON，不要輸出 Markdown，不要解釋。

輸出格式：
{
  "signals": [
    {
      "title": "",
      "company_id": "",
      "company_name": "",
      "chip_name": "",
      "region": "",
      "stage": "",
      "status": "draft",
      "confidence_score": 40,
      "abf_demand_impact": "",
      "evidence_summary": "",
      "confidence_reason": "",
      "signal_type": "",
      "release_year": "",
      "release_quarter": "",
      "package_type": "",
      "cowos_required": "",
      "abf_size": "",
      "abf_layers": "",
      "hbm": "",
      "expected_volume": "",
      "impact_scope": "",
      "conflicting_evidence": "",
      "last_verified_by": "",
      "tags": "",
      "source_regions": "",
      "sources": "",
      "notes": "",
      "verification_note": ""
    }
  ]
}

規則：
- 不確定的欄位留空，不要編造。
- status 一律使用 draft，除非輸入材料明確包含已驗證來源，也仍然只建議 watch，不可直接 verified。
- confidence_score 使用 0-100，但沒有明確來源時不要超過 60。
- stage 只能使用：rumor, announced, sampling, design_win, pilot, ramp, volume。
- abf_demand_impact 只能使用：low, medium, high, explosive。
- region 只能使用：USA, China, Taiwan, Japan, Korea, Europe, Other。
- evidence_summary 必須引用輸入材料中的具體線索。
- confidence_reason 必須說明為什麼這只是 draft/watch，而不是 verified。`;

export function loadAiSettings() {
    return {
        apiKey: localStorage.getItem(AI_SETTINGS_KEYS.apiKey) || '',
        baseUrl: localStorage.getItem(AI_SETTINGS_KEYS.baseUrl) || DEFAULTS.baseUrl,
        model: localStorage.getItem(AI_SETTINGS_KEYS.model) || DEFAULTS.model,
    };
}

export function saveAiSettings(settings) {
    if (settings.apiKey !== undefined) localStorage.setItem(AI_SETTINGS_KEYS.apiKey, settings.apiKey);
    if (settings.baseUrl !== undefined) localStorage.setItem(AI_SETTINGS_KEYS.baseUrl, settings.baseUrl);
    if (settings.model !== undefined) localStorage.setItem(AI_SETTINGS_KEYS.model, settings.model);
}

export function loadExtractionPrompt() {
    return localStorage.getItem(AI_SETTINGS_KEYS.prompt) || DEFAULT_EXTRACTION_PROMPT;
}

export function saveExtractionPrompt(prompt) {
    localStorage.setItem(AI_SETTINGS_KEYS.prompt, prompt);
}

export function resetExtractionPrompt() {
    localStorage.removeItem(AI_SETTINGS_KEYS.prompt);
    return DEFAULT_EXTRACTION_PROMPT;
}

// ===== DeepSeek API =====

/**
 * Test connection by sending a tiny request.
 */
export async function testDeepSeekConnection(settings) {
    const { apiKey, baseUrl, model } = settings;
    if (!apiKey) throw new Error('請先輸入 API Key');

    const url = buildChatUrl(baseUrl);

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: 'Reply with exactly: ok' },
                { role: 'user', content: 'test' },
            ],
            max_tokens: 10,
        }),
    });

    if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        if (resp.status === 404) {
            throw new Error('API endpoint 找不到 (404)。請確認 base URL 正確，或嘗試加上 /v1 後綴。');
        }
        throw new Error(`連線測試失敗 (${resp.status}): ${body.slice(0, 200)}`);
    }

    const data = await resp.json();
    return { ok: true, model: data.model || model };
}

/**
 * Extract signals from source text using DeepSeek.
 */
export async function extractSignalsWithDeepSeek({ settings, prompt, sourceText, imageDataUrl }) {
    const { apiKey, baseUrl, model } = settings;
    if (!apiKey) throw new Error('請先輸入 API Key');
    if (!sourceText && !imageDataUrl) throw new Error('請輸入文字或上傳圖片');

    const url = buildChatUrl(baseUrl);

    // Build messages: text is required, image is optional fallback
    let userContent;
    if (sourceText && imageDataUrl) {
        // Try multipart if image provided; if model doesn't support it, the API will error
        userContent = [
            { type: 'text', text: sourceText },
            { type: 'image_url', image_url: { url: imageDataUrl } },
        ];
    } else if (sourceText) {
        userContent = sourceText;
    } else {
        userContent = [
            { type: 'text', text: '請解析這張圖片中的半導體/AI芯片/ABF供應鏈情報，輸出 JSON signals。' },
            { type: 'image_url', image_url: { url: imageDataUrl } },
        ];
    }

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: userContent },
            ],
            temperature: 0.1,
        }),
    });

    if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        if (resp.status === 404) {
            throw new Error('API endpoint 找不到 (404)。請確認 base URL 正確，或嘗試加上 /v1 後綴。');
        }
        if (resp.status === 400 && body.includes('image')) {
            throw new Error('此模型/端點目前無法直接解析圖片。請先使用 OCR 取得文字，再貼入文字解析區。');
        }
        throw new Error(`DeepSeek API 呼叫失敗 (${resp.status}): ${body.slice(0, 300)}`);
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('模型回傳了空內容');

    return text;
}

function buildChatUrl(baseUrl) {
    let url = baseUrl.replace(/\/$/, '');
    // If URL doesn't already end with /v1/chat/completions, append it
    if (!url.includes('/chat/completions')) {
        url += '/v1/chat/completions';
    }
    return url;
}

// ===== JSON Parsing =====

/**
 * Parse model output JSON safely.
 * Handles Markdown fences, finds first { and last }, requires signals array.
 */
export function parseModelJson(text) {
    let cleaned = text.trim();

    // Remove markdown json fences
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/```\s*$/i, '');

    // Find first { and last }
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
        throw new Error('模型輸出中找不到有效的 JSON 物件');
    }

    const jsonStr = cleaned.substring(first, last + 1);
    let parsed;
    try {
        parsed = JSON.parse(jsonStr);
    } catch (e) {
        throw new Error(`JSON 解析失敗: ${e.message}`);
    }

    if (!parsed.signals || !Array.isArray(parsed.signals)) {
        throw new Error('JSON 中找不到 signals 陣列');
    }

    return parsed;
}

// ===== Candidate Normalization =====

/**
 * Normalize AI-extracted candidate signals.
 * Forces status to draft/watch (never verified), stamps AI metadata.
 */
export function normalizeAiCandidates(payload, settings) {
    const signals = payload.signals || [];
    return signals.map((raw, idx) => {
        // Safety: never allow verified status from AI output
        // Default to draft; only preserve 'watch' if explicitly requested
        let status = raw.status || 'draft';
        if (status !== 'watch') status = 'draft';

        // Clamp confidence for AI-generated
        let confidence = Number(raw.confidence_score);
        if (isNaN(confidence) || confidence < 0) confidence = 0;
        if (confidence > 100) confidence = 100;
        // AI without explicit source should not exceed 60
        if (!raw.evidence_summary || raw.evidence_summary.length < 10) {
            confidence = Math.min(confidence, 60);
        }

        return {
            ...raw,
            status,
            confidence_score: confidence,
            ai_generated: true,
            ai_model: settings.model || '',
            ai_extracted_at: new Date().toISOString(),
            source_type: 'ai_extracted',
            // Ensure arrays are arrays
            tags: Array.isArray(raw.tags) ? raw.tags : (typeof raw.tags === 'string' ? raw.tags.split(',').map(s => s.trim()).filter(Boolean) : []),
            source_regions: Array.isArray(raw.source_regions) ? raw.source_regions : (typeof raw.source_regions === 'string' ? raw.source_regions.split(',').map(s => s.trim()).filter(Boolean) : []),
            impact_scope: Array.isArray(raw.impact_scope) ? raw.impact_scope : (typeof raw.impact_scope === 'string' ? raw.impact_scope.split(',').map(s => s.trim()).filter(Boolean) : []),
            sources: Array.isArray(raw.sources) ? raw.sources : [],
        };
    });
}

/**
 * Classify AI candidate signals using Phase 16 validation pipeline.
 *
 * Each candidate goes through:
 * 1. resolveCompanyId — maps company_name → company_id
 * 2. validateSignalShape — checks required fields
 * 3. validateRow — full import validation (template guard, enum checks, etc.)
 * 4. classifyImportRow — create / update / skip / error
 *
 * @param {Array} candidates — normalized AI candidate objects (from normalizeAiCandidates)
 * @param {Array} existingSignals — current signals from Firestore
 * @param {Array} companiesData — company catalog for resolver
 * @returns {Array} classified rows with rowNumber, action, issues, data
 */
export function classifyAiCandidates(candidates, existingSignals, companiesData = []) {
    return candidates.map((candidate, idx) => {
        // Step 1: Resolve company_id from company_name
        const resolution = resolveCompanyId(candidate.company_name || candidate.company_id || '', companiesData);
        const enrichedCandidate = { ...candidate };
        if (resolution.resolved && resolution.confidence === 'high') {
            enrichedCandidate.company_id = resolution.candidateId;
            enrichedCandidate.company_name = resolution.candidateName;
        } else if (resolution.resolved && resolution.confidence === 'low') {
            // Low-confidence fuzzy match: auto-fill but flag for operator review
            enrichedCandidate.company_id = resolution.candidateId;
            enrichedCandidate.company_name = resolution.candidateName;
            enrichedCandidate._needsCompanyConfirmation = true;
            enrichedCandidate._originalCompanyName = candidate.company_name || '';
            enrichedCandidate._matchedCompanyName = resolution.candidateName;
        }

        // Step 2: Build a plain row object that validateRow expects
        const rawRow = {
            title: enrichedCandidate.title || '',
            company_id: enrichedCandidate.company_id || '',
            company_name: enrichedCandidate.company_name || '',
            chip_name: enrichedCandidate.chip_name || '',
            region: enrichedCandidate.region || '',
            stage: enrichedCandidate.stage || '',
            status: enrichedCandidate.status || 'draft',
            confidence_score: enrichedCandidate.confidence_score ?? 0,
            abf_demand_impact: enrichedCandidate.abf_demand_impact || '',
            evidence_summary: enrichedCandidate.evidence_summary || '',
            confidence_reason: enrichedCandidate.confidence_reason || '',
            last_verified_at: enrichedCandidate.last_verified_at || '',
            import_key: enrichedCandidate.import_key || '',
            signal_type: enrichedCandidate.signal_type || '',
            release_year: enrichedCandidate.release_year || '',
            release_quarter: enrichedCandidate.release_quarter || '',
            package_type: enrichedCandidate.package_type || '',
            cowos_required: enrichedCandidate.cowos_required || '',
            abf_size: enrichedCandidate.abf_size || '',
            abf_layers: enrichedCandidate.abf_layers || '',
            hbm: enrichedCandidate.hbm || '',
            expected_volume: enrichedCandidate.expected_volume || '',
            impact_scope: enrichedCandidate.impact_scope || '',
            conflicting_evidence: enrichedCandidate.conflicting_evidence || '',
            last_verified_by: enrichedCandidate.last_verified_by || '',
            tags: Array.isArray(enrichedCandidate.tags) ? enrichedCandidate.tags.join(',') : (enrichedCandidate.tags || ''),
            source_regions: Array.isArray(enrichedCandidate.source_regions) ? enrichedCandidate.source_regions.join(',') : (enrichedCandidate.source_regions || ''),
            sources: Array.isArray(enrichedCandidate.sources) ? JSON.stringify(enrichedCandidate.sources) : (enrichedCandidate.sources || ''),
            notes: enrichedCandidate.notes || '',
        };

        // Step 3: Pre-validate required fields — if missing company_id, fail early with clear message
        const shapeValidation = validateSignalShape(rawRow);
        if (!shapeValidation.ok) {
            // If company couldn't be resolved, show a helpful message
            if (!resolution.resolved && (candidate.company_name || candidate.company_id)) {
                shapeValidation.errors = [`公司無法識別: "${candidate.company_name || candidate.company_id}" — 請先在 Companies 補上`];
            }
            return {
                rowNumber: idx + 1,
                status: 'error',
                action: 'error',
                issues: shapeValidation.errors,
                data: { ...enrichedCandidate, ...rawRow },
            };
        }

        // Step 4: Full validation + classification
        const validated = validateRow(rawRow, existingSignals);
        const classified = classifyImportRow(validated, existingSignals);

        return {
            rowNumber: idx + 1,
            ...classified,
        };
    });
}
