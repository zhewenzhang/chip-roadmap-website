/**
 * Admin Import Signals Module — Phase 12A + Phase 13.2
 *
 * Excel bulk import workflow for signals with upsert support.
 * - Template download (includes import_key column)
 * - Excel upload/parse (dynamic import of xlsx)
 * - Row validation and duplicate detection
 * - Import key matching (create / update / skip / error)
 * - Preview-before-write
 * - Confirmed import via createSignal() or saveSignal()
 * - Import batch log to Firestore
 */

import { createSignal, saveSignal } from '../js/firebase/db.js';
import {
    STAGE_ENUM, STATUS_ENUM, IMPACT_ENUM, REGION_OPTIONS,
    STAGE_LABEL, STATUS_LABEL, IMPACT_LABEL, REGION_LABEL,
} from '../js/modules/signals-schema.js';

// ===== Constants =====

const REQUIRED_COLS = [
    'title', 'company_id', 'company_name', 'chip_name',
    'region', 'stage', 'status', 'confidence_score', 'abf_demand_impact',
    'evidence_summary', 'confidence_reason',
];

const OPTIONAL_COLS = [
    'import_key',
    'signal_type', 'release_year', 'release_quarter',
    'package_type', 'cowos_required', 'abf_size', 'abf_layers',
    'hbm', 'expected_volume', 'impact_scope', 'conflicting_evidence',
    'last_verified_by', 'last_verified_at', 'tags', 'source_regions', 'sources',
    'notes', 'verification_note',
];

const ALL_COLS = ['import_key', ...REQUIRED_COLS.filter(c => c !== 'import_key'), ...OPTIONAL_COLS.filter(c => c !== 'import_key')];

// Meaningful fields for change detection
const MEANINGFUL_FIELDS = [
    'title', 'company_id', 'company_name', 'chip_name', 'region',
    'stage', 'status', 'confidence_score', 'abf_demand_impact',
    'evidence_summary', 'confidence_reason', 'last_verified_at',
    'signal_type', 'release_year', 'release_quarter',
    'package_type', 'cowos_required', 'abf_size', 'abf_layers',
    'hbm', 'expected_volume', 'impact_scope', 'conflicting_evidence',
    'last_verified_by', 'tags', 'source_regions', 'sources',
    'notes', 'verification_note', 'import_key',
];

// ===== Template Generation =====

export function downloadTemplate() {
    const templateData = [
        ALL_COLS,
        [
            'nvidia_blackwell-b200_ramp_2024_q4',  // import_key
            'Example verified signal',
            'nvidia', 'NVIDIA', 'Blackwell B200',
            'USA', 'ramp', 'verified', 80, 'high',
            'Example evidence summary. Replace before import.',
            'Example confidence reason. Replace before import.',
            '2026-05-14',
            // remaining optional columns
            'product_progress', 2024, 'Q4',
            'CoWoS-L', 'yes', '77mm x 77mm', 18,
            'HBM3E', 'high', '', '',
            'admin@example.com', 'ai-accelerator,datacenter', 'USA,Taiwan', '',
            '', '',
        ],
    ];

    const wsData = templateData.map(row => {
        const out = [];
        for (let i = 0; i < ALL_COLS.length; i++) {
            out.push(row[i] ?? '');
        }
        return out;
    });

    import('xlsx').then(XLSX => {
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'signals');
        XLSX.writeFile(wb, 'signals-import-template.xlsx');
    }).catch(err => {
        console.error('Failed to generate template:', err);
        alert('模板生成失敗，請確認已安裝 xlsx 套件。');
    });
}

// ===== Excel Parsing =====

export async function parseExcelFile(file) {
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return rows;
}

// ===== Import Key =====

/**
 * Generate a deterministic import key from row data.
 */
export function buildImportKey(data) {
    const parts = [
        data.company_id,
        data.chip_name,
        data.signal_type,
        data.release_year,
        data.release_quarter,
        data.stage,
    ];
    return parts
        .map(v => String(v || '').trim().toLowerCase())
        .map(v => v.replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, ''))
        .filter(Boolean)
        .join('_');
}

// ===== Validation =====

export function validateRow(row, existingSignals) {
    const errors = [];
    const data = {};

    // Trim all string values
    for (const key of ALL_COLS) {
        let val = row[key];
        if (val === undefined || val === null) val = '';
        if (typeof val === 'string') val = val.trim();
        data[key] = val;
    }

    // Auto-generate import_key if empty
    if (!data.import_key) {
        data.import_key = buildImportKey(data);
    }

    // --- Blocking errors ---

    // Required fields
    for (const col of REQUIRED_COLS) {
        if (col === 'import_key') continue; // import_key is auto-generated
        if (!data[col] && data[col] !== 0) {
            errors.push(`缺少必填欄位: ${col}`);
        }
    }

    if (errors.length > 0) {
        return { status: 'error', action: 'error', issues: errors, data };
    }

    // Template example row guard (Phase 12A.1)
    const looksLikeTemplateExample =
        data.title === 'Example verified signal' ||
        String(data.evidence_summary).includes('Replace before import') ||
        String(data.confidence_reason).includes('Replace before import');
    if (looksLikeTemplateExample) {
        return {
            status: 'error',
            action: 'error',
            issues: ['模板範例行不可匯入，請替換為真實信號資料'],
            data,
        };
    }

    // Enum validation
    if (!STAGE_ENUM.includes(data.stage)) {
        errors.push(`無效 stage: "${data.stage}" (可用: ${STAGE_ENUM.join(', ')})`);
    }
    if (!STATUS_ENUM.includes(data.status)) {
        errors.push(`無效 status: "${data.status}" (可用: ${STATUS_ENUM.join(', ')})`);
    }
    if (!REGION_OPTIONS.includes(data.region)) {
        errors.push(`無效 region: "${data.region}" (可用: ${REGION_OPTIONS.join(', ')})`);
    }
    if (!IMPACT_ENUM.includes(data.abf_demand_impact)) {
        errors.push(`無效 abf_demand_impact: "${data.abf_demand_impact}" (可用: ${IMPACT_ENUM.join(', ')})`);
    }

    // confidence_score
    const conf = Number(data.confidence_score);
    if (isNaN(conf) || conf < 0 || conf > 100) {
        errors.push(`confidence_score 必須是 0-100 的數字: "${data.confidence_score}"`);
    }
    data.confidence_score = conf;

    // release_quarter
    if (data.release_quarter && !['Q1', 'Q2', 'Q3', 'Q4'].includes(data.release_quarter)) {
        errors.push(`release_quarter 必須是 Q1-Q4: "${data.release_quarter}"`);
    }

    // abf_layers
    if (data.abf_layers !== '') {
        const layers = Number(data.abf_layers);
        if (isNaN(layers) || layers <= 0) {
            errors.push(`abf_layers 必須是正數: "${data.abf_layers}"`);
        }
        data.abf_layers = layers;
    }

    // release_year
    if (data.release_year !== '') {
        const yr = Number(data.release_year);
        if (isNaN(yr)) {
            errors.push(`release_year 必須是數字: "${data.release_year}"`);
        }
        data.release_year = yr;
    }

    // cowos_required — strict (Phase 12A.1)
    if (data.cowos_required !== '') {
        const boolResult = parseBoolStrict(data.cowos_required);
        if (boolResult.ok) {
            data.cowos_required = boolResult.value;
        } else {
            errors.push(`cowos_required 必須是 true/false、yes/no、1/0、是/否: "${data.cowos_required}"`);
        }
    }

    // Array fields: comma-separated
    for (const field of ['tags', 'source_regions', 'impact_scope']) {
        if (data[field] && typeof data[field] === 'string') {
            data[field] = data[field].split(',').map(s => s.trim()).filter(Boolean);
        }
    }

    // sources: try JSON parse
    if (data.sources && typeof data.sources === 'string' && data.sources.startsWith('[')) {
        try {
            data.sources = JSON.parse(data.sources);
        } catch {
            // leave as string, warn below
        }
    }

    if (errors.length > 0) {
        return { status: 'error', action: 'error', issues: errors, data };
    }

    return { status: 'ready', action: '', issues: [], data };
}

function parseBoolStrict(val) {
    if (typeof val === 'boolean') return { ok: true, value: val };
    const s = String(val).toLowerCase().trim();
    if (['true', 'yes', '1', '是'].includes(s)) return { ok: true, value: true };
    if (['false', 'no', '0', '否'].includes(s)) return { ok: true, value: false };
    return { ok: false, value: null };
}

// ===== Classification (Phase 13.2) =====

/**
 * Classify a validated row as create / update / skip / error.
 *
 * Matching priority:
 * 1. exact import_key match
 * 2. legacy: company_id + chip_name + title
 */
export function classifyImportRow(validatedRow, existingSignals) {
    if (validatedRow.status === 'error') {
        return { ...validatedRow, action: 'error' };
    }

    const data = validatedRow.data;
    const importKey = data.import_key || buildImportKey(data);

    // Build lookup maps
    const byImportKey = {};
    const byLegacyKey = {};

    for (const s of existingSignals) {
        if (s.archived || s.status === 'archived') continue;
        if (s.import_key) {
            byImportKey[s.import_key.toLowerCase()] = s;
        }
        const legacyKey = `${s.company_id}|${s.chip_name}|${s.title}`.toLowerCase();
        byLegacyKey[legacyKey] = s;
    }

    // 1. Match by import_key
    const matchByKey = byImportKey[importKey.toLowerCase()];
    if (matchByKey) {
        const changed = getChangedFields(data, matchByKey);
        if (changed.length === 0) {
            return {
                ...validatedRow,
                action: 'skip',
                existingId: matchByKey.id,
                existing: matchByKey,
                changedFields: [],
                issues: ['No changes detected'],
            };
        }
        return {
            ...validatedRow,
            action: 'update',
            existingId: matchByKey.id,
            existing: matchByKey,
            changedFields: changed,
            status: 'warning',
            issues: [`Will update ${changed.length} field(s)`],
        };
    }

    // 2. Match by legacy key
    const legacyKey = `${data.company_id}|${data.chip_name}|${data.title}`.toLowerCase();
    const matchByLegacy = byLegacyKey[legacyKey];
    if (matchByLegacy) {
        const changed = getChangedFields(data, matchByLegacy);
        if (changed.length === 0) {
            return {
                ...validatedRow,
                action: 'skip',
                existingId: matchByLegacy.id,
                existing: matchByLegacy,
                changedFields: [],
                issues: ['No changes detected'],
            };
        }
        return {
            ...validatedRow,
            action: 'update',
            existingId: matchByLegacy.id,
            existing: matchByLegacy,
            changedFields: changed,
            status: 'warning',
            issues: [`Will update ${changed.length} field(s)`],
        };
    }

    // 3. No match → create
    return {
        ...validatedRow,
        action: 'create',
        existingId: '',
        existing: null,
        changedFields: [],
    };
}

/**
 * Compare normalized import data against existing signal.
 * Returns list of field names that differ.
 */
export function getChangedFields(nextData, existingSignal) {
    const changed = [];
    for (const field of MEANINGFUL_FIELDS) {
        const next = normalizeFieldValue(nextData[field]);
        const prev = normalizeFieldValue(existingSignal[field]);
        if (next !== prev) {
            changed.push(field);
        }
    }
    return changed;
}

function normalizeFieldValue(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (Array.isArray(val)) return val.sort().join(',');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val).trim();
}

// ===== Import =====

/**
 * Import validated+classified rows into Firestore.
 * Creates new signals or updates existing ones.
 */
export async function importSignals(rows, actor) {
    const results = { created: 0, updated: 0, skipped: 0, errors: 0 };

    for (const row of rows) {
        if (row.action === 'error') {
            results.errors++;
            continue;
        }
        if (row.action === 'skip') {
            results.skipped++;
            continue;
        }

        try {
            if (row.action === 'create') {
                await createSignal(row.data, actor);
                results.created++;
            } else if (row.action === 'update') {
                await saveSignal(row.existingId, row.data, {
                    actor,
                    previousStatus: row.existing?.status || null,
                    previousConfidence: row.existing?.confidence_score || null,
                });
                results.updated++;
            }
        } catch (err) {
            console.error('Import error for row:', row.data.title, err);
            results.errors++;
        }
    }

    return results;
}

/**
 * Write import batch log to Firestore.
 */
export async function logImportBatch(actor, results) {
    try {
        const { db } = await import('../js/firebase/config.js');
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, 'import_batches'), {
            type: 'signals',
            actor: actor || 'unknown',
            created_count: results.created,
            updated_count: results.updated,
            skipped_count: results.skipped,
            error_count: results.errors,
            total_count: results.created + results.updated + results.skipped + results.errors,
            createdAt: serverTimestamp(),
        });
    } catch (err) {
        console.warn('[Firestore] import_batches write failed:', err);
    }
}
