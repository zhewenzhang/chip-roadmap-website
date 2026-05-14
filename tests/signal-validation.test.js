/**
 * Phase 16 — Signal Validation Tests
 *
 * Tests pure functions from admin/signal-validation.js:
 * - resolveCompanyId (exact match, fuzzy match, no match)
 * - validateSignalShape (required fields, enum validation)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

let mod;
try {
    mod = await import('../admin/signal-validation.js');
} catch {
    mod = {};
}

const { resolveCompanyId, validateSignalShape } = mod;

const mockCompanies = [
    { id: 'nvidia', name_en: 'NVIDIA', name_cn: '英伟达', name: 'NVIDIA' },
    { id: 'huawei_ascend', name_en: 'Huawei Ascend', name_cn: '华为昇腾', name: 'Huawei' },
    { id: 'tsmc', name_en: 'TSMC', name_cn: '台积电', name: 'TSMC' },
    { id: 'amd', name_en: 'Advanced Micro Devices', name_cn: '超威半导体', name: 'AMD' },
];

// ===== resolveCompanyId =====

test('resolveCompanyId: exact match on id (case-insensitive)', () => {
    const result = resolveCompanyId('NVIDIA', mockCompanies);
    assert.equal(result.resolved, true);
    assert.equal(result.candidateId, 'nvidia');
    assert.equal(result.confidence, 'high');
});

test('resolveCompanyId: exact match on name_en', () => {
    const result = resolveCompanyId('Advanced Micro Devices', mockCompanies);
    assert.equal(result.resolved, true);
    assert.equal(result.candidateId, 'amd');
    assert.equal(result.confidence, 'high');
});

test('resolveCompanyId: exact match on name_cn', () => {
    const result = resolveCompanyId('华为昇腾', mockCompanies);
    assert.equal(result.resolved, true);
    assert.equal(result.candidateId, 'huawei_ascend');
    assert.equal(result.confidence, 'high');
});

test('resolveCompanyId: fuzzy match (partial name)', () => {
    const result = resolveCompanyId('Huawei', mockCompanies);
    assert.equal(result.resolved, true);
    assert.equal(result.candidateId, 'huawei_ascend');
});

test('resolveCompanyId: no match returns unresolved', () => {
    const result = resolveCompanyId('Unknown Company XYZ', mockCompanies);
    assert.equal(result.resolved, false);
    assert.equal(result.candidateId, '');
});

test('resolveCompanyId: empty input returns unresolved', () => {
    const result = resolveCompanyId('', mockCompanies);
    assert.equal(result.resolved, false);
});

test('resolveCompanyId: null input returns unresolved', () => {
    const result = resolveCompanyId(null, mockCompanies);
    assert.equal(result.resolved, false);
});

test('resolveCompanyId: whitespace-only input returns unresolved', () => {
    const result = resolveCompanyId('   ', mockCompanies);
    assert.equal(result.resolved, false);
});

// ===== CJK / Simplified-Traditional Resolution =====

test('resolveCompanyId: Simplified→Traditional exact match (name_cn)', () => {
    const result = resolveCompanyId('华为昇腾', mockCompanies);
    assert.equal(result.resolved, true);
    assert.equal(result.candidateId, 'huawei_ascend');
    assert.equal(result.confidence, 'high');
});

test('resolveCompanyId: Traditional→Simplified exact match (name_cn)', () => {
    const result = resolveCompanyId('華為昇騰', mockCompanies);
    assert.equal(result.resolved, true);
    assert.equal(result.candidateId, 'huawei_ascend');
    assert.equal(result.confidence, 'high');
});

test('resolveCompanyId: CJK fuzzy — partial company name matches', () => {
    // '华为' is a significant substring of '华为昇腾' — fuzzy should find it
    const result = resolveCompanyId('华为', mockCompanies);
    assert.equal(result.resolved, true);
    assert.equal(result.candidateId, 'huawei_ascend');
    assert.equal(result.confidence, 'low'); // partial match = low confidence
});

test('resolveCompanyId: Mixed-language input resolves via fuzzy', () => {
    // 'Huawei 昇腾' mixes Latin + CJK; fuzzy should match after normalization
    const result = resolveCompanyId('Huawei 昇腾', mockCompanies);
    assert.equal(result.resolved, true);
    assert.equal(result.candidateId, 'huawei_ascend');
    // Mixed-language partial match may be low or high depending on overlap
    assert.ok(result.confidence === 'low' || result.confidence === 'high');
});

test('resolveCompanyId: CJK-only partial match with low confidence', () => {
    // "华为子公司" has some overlap with "華為昇騰" but is not a clean match
    const result = resolveCompanyId('華為子', mockCompanies);
    // Should either resolve with low confidence or not resolve — but MUST NOT crash
    assert.ok(result.resolved === false || result.confidence === 'low');
});

// ===== validateSignalShape =====

test('validateSignalShape: valid data returns ok', () => {
    const result = validateSignalShape({
        title: 'Test signal',
        company_id: 'nvidia',
        company_name: 'NVIDIA',
        chip_name: 'B200',
        region: 'USA',
    });
    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
});

test('validateSignalShape: missing title returns error', () => {
    const result = validateSignalShape({
        title: '',
        company_id: 'nvidia',
        company_name: 'NVIDIA',
        chip_name: 'B200',
        region: 'USA',
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.includes('title')));
});

test('validateSignalShape: missing company_id returns error', () => {
    const result = validateSignalShape({
        title: 'Test',
        company_id: '',
        company_name: 'NVIDIA',
        chip_name: 'B200',
        region: 'USA',
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.includes('company_id')));
});

test('validateSignalShape: missing all required fields returns multiple errors', () => {
    const result = validateSignalShape({});
    assert.equal(result.ok, false);
    assert.ok(result.errors.length >= 5, 'should have at least 5 errors for all missing required fields');
});

test('validateSignalShape: invalid stage returns error', () => {
    const result = validateSignalShape({
        title: 'Test',
        company_id: 'nvidia',
        company_name: 'NVIDIA',
        chip_name: 'B200',
        region: 'USA',
        stage: 'invalid_stage',
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.includes('stage')));
});

test('validateSignalShape: valid stage passes', () => {
    const result = validateSignalShape({
        title: 'Test',
        company_id: 'nvidia',
        company_name: 'NVIDIA',
        chip_name: 'B200',
        region: 'USA',
        stage: 'ramp',
    });
    assert.equal(result.ok, true);
});

test('validateSignalShape: invalid confidence_score returns error', () => {
    const result = validateSignalShape({
        title: 'Test',
        company_id: 'nvidia',
        company_name: 'NVIDIA',
        chip_name: 'B200',
        region: 'USA',
        confidence_score: 150,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.includes('confidence_score')));
});

test('validateSignalShape: trims string fields', () => {
    const result = validateSignalShape({
        title: '  Test  ',
        company_id: '  nvidia  ',
        company_name: 'NVIDIA',
        chip_name: 'B200',
        region: 'USA',
    });
    assert.equal(result.ok, true);
    assert.equal(result.normalized.title, 'Test');
    assert.equal(result.normalized.company_id, 'nvidia');
});
