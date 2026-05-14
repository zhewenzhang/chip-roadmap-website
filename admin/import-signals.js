/**
 * Admin Import Signals Module — Phase 12A
 *
 * Excel bulk import workflow for signals.
 * - Template download
 * - Excel upload/parse (dynamic import of xlsx)
 * - Row validation and duplicate detection
 * - Preview-before-write
 * - Confirmed import via createSignal()
 */

import { createSignal } from '../js/firebase/db.js';
import {
    STAGE_ENUM, STATUS_ENUM, IMPACT_ENUM, REGION_OPTIONS,
    STAGE_LABEL, STATUS_LABEL, IMPACT_LABEL, REGION_LABEL,
} from '../js/modules/signals-schema.js';

// ===== Constants =====

const REQUIRED_COLS = [
    'title', 'company_id', 'company_name', 'chip_name',
    'region', 'stage', 'status', 'confidence_score', 'abf_demand_impact',
    'evidence_summary', 'confidence_reason', 'last_verified_at',
];

const OPTIONAL_COLS = [
    'signal_type', 'release_year', 'release_quarter',
    'package_type', 'cowos_required', 'abf_size', 'abf_layers',
    'hbm', 'expected_volume', 'impact_scope', 'conflicting_evidence',
    'last_verified_by', 'tags', 'source_regions', 'sources',
    'notes', 'verification_note',
];

const ALL_COLS = [...REQUIRED_COLS, ...OPTIONAL_COLS];

// ===== Template Generation =====

/**
 * Generate and download an .xlsx template for signals import.
 */
export function downloadTemplate() {
    const templateData = [
        ALL_COLS,
        [
            'Example verified signal',
            'nvidia', 'NVIDIA', 'Blackwell B200',
            'USA', 'ramp', 'verified', 80, 'high',
            'Example evidence summary. Replace before import.',
            'Example confidence reason. Replace before import.',
            '2026-05-14',
            // optional columns
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

    // Dynamic import xlsx only when needed
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

/**
 * Parse an uploaded Excel file into raw row objects.
 */
export async function parseExcelFile(file) {
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return rows;
}

// ===== Validation =====

/**
 * Validate a single parsed row.
 * Returns { status: 'ready'|'warning'|'error'|'duplicate', issues: string[], data: object }
 */
export function validateRow(row, existingSignals) {
    const issues = [];
    const errors = [];
    const data = {};

    // Trim all string values
    for (const key of ALL_COLS) {
        let val = row[key];
        if (val === undefined || val === null) val = '';
        if (typeof val === 'string') val = val.trim();
        data[key] = val;
    }

    // --- Blocking errors ---

    // Required fields
    for (const col of REQUIRED_COLS) {
        if (!data[col] && data[col] !== 0) {
            errors.push(`缺少必填欄位: ${col}`);
        }
    }

    if (errors.length > 0) {
        return { status: 'error', issues: errors, data };
    }

    // Prevent the template example row from being imported as real data.
    const looksLikeTemplateExample =
        data.title === 'Example verified signal' ||
        String(data.evidence_summary).includes('Replace before import') ||
        String(data.confidence_reason).includes('Replace before import');
    if (looksLikeTemplateExample) {
        return {
            status: 'error',
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

    // cowos_required
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
        return { status: 'error', issues: errors, data };
    }

    // --- Duplicate detection ---
    const dupKey = `${data.company_id}|${data.chip_name}|${data.title}`;
    const isDuplicate = existingSignals.some(s =>
        `${s.company_id}|${s.chip_name}|${s.title}`.toLowerCase() === dupKey.toLowerCase()
    );
    if (isDuplicate) {
        return { status: 'duplicate', issues: ['可能重複：相同 company_id + chip_name + title'], data };
    }

    // --- Warnings ---
    const warnings = [];

    if (data.status === 'verified' && !data.last_verified_by) {
        warnings.push('verified 信號但 last_verified_by 為空');
    }
    if (data.status === 'verified' && data.confidence_reason && data.confidence_reason.length < 10) {
        warnings.push('verified 信號但 confidence_reason 太短');
    }
    if (data.cowos_required === true && !data.abf_size && !data.abf_layers) {
        warnings.push('CoWoS required 但 abf_size 和 abf_layers 皆為空');
    }
    if (data.sources && typeof data.sources === 'string') {
        warnings.push('sources 無法解析為 JSON');
    }
    if (data.status === 'draft') {
        warnings.push('draft 信號不會出現在公開頁面');
    }

    return { status: warnings.length > 0 ? 'warning' : 'ready', issues: warnings, data };
}

function parseBoolStrict(val) {
    if (typeof val === 'boolean') return { ok: true, value: val };
    const s = String(val).toLowerCase().trim();
    if (['true', 'yes', '1', '是'].includes(s)) return { ok: true, value: true };
    if (['false', 'no', '0', '否'].includes(s)) return { ok: true, value: false };
    return { ok: false, value: null };
}

// ===== Import =====

/**
 * Import validated rows into Firestore via createSignal().
 * Only imports rows with status 'ready' or 'warning'.
 */
export async function importSignals(rows, actor) {
    const results = { imported: 0, skipped: 0, errors: 0 };

    for (const row of rows) {
        if (row.status === 'error' || row.status === 'duplicate') {
            results.skipped++;
            continue;
        }

        try {
            await createSignal(row.data, actor);
            results.imported++;
        } catch (err) {
            console.error('Import error for row:', row.data.title, err);
            results.errors++;
        }
    }

    return results;
}
