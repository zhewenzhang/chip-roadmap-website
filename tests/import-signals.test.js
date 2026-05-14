/**
 * Phase 13 — Import Signals Helper Tests
 *
 * Tests pure functions from admin/import-signals.js:
 * - buildImportKey
 * - validateRow (template guard, strict bool)
 * - classifyImportRow (create/update/skip/error)
 * - getChangedFields
 */

import test from 'node:test';
import assert from 'node:assert/strict';

let mod;
try {
    mod = await import('../admin/import-signals.js');
} catch {
    mod = {};
}

const { buildImportKey, validateRow, classifyImportRow, getChangedFields } = mod;

// ===== buildImportKey =====

test('buildImportKey: spaces become hyphens', () => {
    const key = buildImportKey({
        company_id: 'nvidia',
        chip_name: 'Blackwell B200',
        signal_type: 'product_progress',
        release_year: 2024,
        release_quarter: 'Q4',
        stage: 'ramp',
    });
    assert.ok(key.includes('blackwell-b200'), 'spaces should become hyphens');
});

test('buildImportKey: unsafe punctuation removed', () => {
    const key = buildImportKey({
        company_id: 'test!@#company',
        chip_name: 'chip$%^name',
        signal_type: '',
        release_year: '',
        release_quarter: '',
        stage: '',
    });
    assert.ok(!key.includes('!'), 'unsafe chars should be removed');
    assert.ok(!key.includes('@'), 'unsafe chars should be removed');
    assert.ok(!key.includes('#'), 'unsafe chars should be removed');
    assert.ok(!key.includes('$'), 'unsafe chars should be removed');
});

test('buildImportKey: empty parts skipped', () => {
    const key = buildImportKey({
        company_id: 'nvidia',
        chip_name: '',
        signal_type: '',
        release_year: '',
        release_quarter: '',
        stage: '',
    });
    assert.equal(key, 'nvidia', 'only non-empty parts should be included');
});

test('buildImportKey: full key shape', () => {
    const key = buildImportKey({
        company_id: 'nvidia',
        chip_name: 'B200',
        signal_type: 'product',
        release_year: 2024,
        release_quarter: 'Q4',
        stage: 'ramp',
    });
    assert.ok(key.startsWith('nvidia_b200_product_2024_q4_ramp'));
});

// ===== validateRow — template guard =====

test('validateRow: template example title returns error', () => {
    const result = validateRow({
        title: 'Example verified signal',
        company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'B200',
        region: 'USA', stage: 'ramp', status: 'verified', confidence_score: 80,
        abf_demand_impact: 'high',
        evidence_summary: 'Real evidence for testing',
        confidence_reason: 'Real confidence reason for testing',
        last_verified_at: '2026-05-14',
    }, []);
    assert.equal(result.status, 'error');
    assert.ok(result.issues[0].includes('模板範例行'));
});

test('validateRow: evidence_summary with Replace before import returns error', () => {
    const result = validateRow({
        title: 'Real signal',
        company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'B200',
        region: 'USA', stage: 'ramp', status: 'verified', confidence_score: 80,
        abf_demand_impact: 'high',
        evidence_summary: 'Example evidence summary. Replace before import.',
        confidence_reason: 'Real confidence reason that is long enough',
        last_verified_at: '2026-05-14',
    }, []);
    assert.equal(result.status, 'error');
});

test('validateRow: confidence_reason with Replace before import returns error', () => {
    const result = validateRow({
        title: 'Real signal',
        company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'B200',
        region: 'USA', stage: 'ramp', status: 'verified', confidence_score: 80,
        abf_demand_impact: 'high',
        evidence_summary: 'Real evidence for testing purposes',
        confidence_reason: 'Example confidence reason. Replace before import.',
        last_verified_at: '2026-05-14',
    }, []);
    assert.equal(result.status, 'error');
});

// ===== validateRow — strict bool =====

test('validateRow: cowos_required = yes accepted', () => {
    const result = validateRow({
        title: 'Test signal',
        company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'B200',
        region: 'USA', stage: 'ramp', status: 'verified', confidence_score: 80,
        abf_demand_impact: 'high',
        evidence_summary: 'Real evidence for testing purposes only here',
        confidence_reason: 'Real confidence reason that is long enough for validation',
        last_verified_at: '2026-05-14',
        cowos_required: 'yes',
    }, []);
    assert.equal(result.status, 'ready');
    assert.equal(result.data.cowos_required, true);
});

test('validateRow: cowos_required = 是 accepted', () => {
    const result = validateRow({
        title: 'Test signal',
        company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'B200',
        region: 'USA', stage: 'ramp', status: 'verified', confidence_score: 80,
        abf_demand_impact: 'high',
        evidence_summary: 'Real evidence for testing purposes only here',
        confidence_reason: 'Real confidence reason that is long enough for validation',
        last_verified_at: '2026-05-14',
        cowos_required: '是',
    }, []);
    assert.equal(result.status, 'ready');
    assert.equal(result.data.cowos_required, true);
});

test('validateRow: cowos_required = 否 accepted as false', () => {
    const result = validateRow({
        title: 'Test signal',
        company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'B200',
        region: 'USA', stage: 'ramp', status: 'verified', confidence_score: 80,
        abf_demand_impact: 'high',
        evidence_summary: 'Real evidence for testing purposes only here',
        confidence_reason: 'Real confidence reason that is long enough for validation',
        last_verified_at: '2026-05-14',
        cowos_required: '否',
    }, []);
    assert.equal(result.status, 'ready');
    assert.equal(result.data.cowos_required, false);
});

test('validateRow: cowos_required = maybe returns error', () => {
    const result = validateRow({
        title: 'Test signal',
        company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'B200',
        region: 'USA', stage: 'ramp', status: 'verified', confidence_score: 80,
        abf_demand_impact: 'high',
        evidence_summary: 'Real evidence for testing purposes only here',
        confidence_reason: 'Real confidence reason that is long enough for validation',
        last_verified_at: '2026-05-14',
        cowos_required: 'maybe',
    }, []);
    assert.equal(result.status, 'error');
    assert.ok(result.issues[0].includes('cowos_required'));
});

// ===== classifyImportRow =====

const existingSignals = [
    {
        id: 'sig-1',
        import_key: 'nvidia_b200_product_2024_q4_ramp',
        company_id: 'nvidia',
        company_name: 'NVIDIA',
        chip_name: 'B200',
        title: 'B200 ramp confirmed',
        region: 'USA',
        stage: 'ramp',
        status: 'verified',
        confidence_score: 80,
        abf_demand_impact: 'high',
        evidence_summary: 'Original evidence',
        confidence_reason: 'Original reason',
        last_verified_at: '2026-01-01',
        archived: false,
    },
];

test('classifyImportRow: no match → action create', () => {
    const validated = validateRow({
        title: 'New chip signal',
        company_id: 'amd', company_name: 'AMD', chip_name: 'MI500',
        region: 'USA', stage: 'pilot', status: 'watch', confidence_score: 60,
        abf_demand_impact: 'high',
        evidence_summary: 'New evidence for MI500',
        confidence_reason: 'Supply chain sources confirm',
        last_verified_at: '2026-05-14',
    }, existingSignals);
    const classified = classifyImportRow(validated, existingSignals);
    assert.equal(classified.action, 'create');
});

test('classifyImportRow: matching import_key → action update', () => {
    const validated = validateRow({
        import_key: 'nvidia_b200_product_2024_q4_ramp',
        title: 'B200 ramp confirmed updated',
        company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'B200',
        region: 'USA', stage: 'ramp', status: 'verified', confidence_score: 90,
        abf_demand_impact: 'high',
        evidence_summary: 'Updated evidence for B200',
        confidence_reason: 'Updated reason with more detail',
        last_verified_at: '2026-06-01',
    }, existingSignals);
    const classified = classifyImportRow(validated, existingSignals);
    assert.equal(classified.action, 'update');
    assert.equal(classified.existingId, 'sig-1');
    assert.ok(classified.changedFields.length > 0);
});

test('classifyImportRow: matching import_key, no changes → action skip', () => {
    const validated = validateRow({
        import_key: 'nvidia_b200_product_2024_q4_ramp',
        title: 'B200 ramp confirmed',
        company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'B200',
        region: 'USA', stage: 'ramp', status: 'verified', confidence_score: 80,
        abf_demand_impact: 'high',
        evidence_summary: 'Original evidence',
        confidence_reason: 'Original reason',
        last_verified_at: '2026-01-01',
    }, existingSignals);
    const classified = classifyImportRow(validated, existingSignals);
    assert.equal(classified.action, 'skip');
});

test('classifyImportRow: error row stays error', () => {
    const validated = validateRow({
        title: '', // missing required
        company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'B200',
        region: 'USA', stage: 'ramp', status: 'verified', confidence_score: 80,
        abf_demand_impact: 'high',
        evidence_summary: 'Evidence',
        confidence_reason: 'Reason',
        last_verified_at: '2026-05-14',
    }, existingSignals);
    const classified = classifyImportRow(validated, existingSignals);
    assert.equal(classified.action, 'error');
});

// ===== getChangedFields =====

test('getChangedFields: detects changed confidence_score', () => {
    const next = { confidence_score: 90 };
    const prev = { confidence_score: 80 };
    const changed = getChangedFields(next, prev);
    assert.ok(changed.includes('confidence_score'));
});

test('getChangedFields: no changes returns empty array', () => {
    const next = { confidence_score: 80, title: 'Same' };
    const prev = { confidence_score: 80, title: 'Same' };
    const changed = getChangedFields(next, prev);
    assert.equal(changed.length, 0);
});
