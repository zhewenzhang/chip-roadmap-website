/**
 * Tests for normalizeSignal() in signals-schema.js
 *
 * Verifies that critical admin workflow fields are preserved:
 * - last_reviewed_at (used by inbox adopt/promote/reject)
 * - ai_generated (used by source filtering)
 * - source_type (used by source filtering)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

let mod;
try {
    mod = await import('../js/modules/signals-schema.js');
} catch {
    mod = {};
}

const { normalizeSignal } = mod;

const baseRaw = {
    id: 'sig-1',
    title: 'Test signal',
    company_id: 'nvidia',
    company_name: 'NVIDIA',
    chip_name: 'B200',
    region: 'USA',
    stage: 'ramp',
    status: 'draft',
    confidence_score: 50,
    abf_demand_impact: 'high',
};

// ===== last_reviewed_at =====

test('normalizeSignal: preserves last_reviewed_at as ISO string', () => {
    const raw = { ...baseRaw, last_reviewed_at: '2026-05-14T10:30:00.000Z' };
    const result = normalizeSignal(raw);
    assert.equal(result.last_reviewed_at, '2026-05-14T10:30:00.000Z');
});

test('normalizeSignal: preserves last_reviewed_at as null when absent', () => {
    const raw = { ...baseRaw };
    delete raw.last_reviewed_at;
    const result = normalizeSignal(raw);
    assert.equal(result.last_reviewed_at, null);
});

test('normalizeSignal: preserves last_reviewed_at when set to current timestamp', () => {
    const now = new Date().toISOString();
    const raw = { ...baseRaw, last_reviewed_at: now };
    const result = normalizeSignal(raw);
    assert.equal(result.last_reviewed_at, now);
});

// ===== ai_generated =====

test('normalizeSignal: preserves ai_generated = true', () => {
    const raw = { ...baseRaw, ai_generated: true };
    const result = normalizeSignal(raw);
    assert.equal(result.ai_generated, true);
});

test('normalizeSignal: preserves ai_generated = false', () => {
    const raw = { ...baseRaw, ai_generated: false };
    const result = normalizeSignal(raw);
    assert.equal(result.ai_generated, false);
});

test('normalizeSignal: defaults ai_generated to false when absent', () => {
    const raw = { ...baseRaw };
    delete raw.ai_generated;
    const result = normalizeSignal(raw);
    assert.equal(result.ai_generated, false);
});

test('normalizeSignal: converts truthy ai_generated to boolean true', () => {
    const raw = { ...baseRaw, ai_generated: 1 };
    const result = normalizeSignal(raw);
    assert.equal(result.ai_generated, true);
});

// ===== source_type =====

test('normalizeSignal: preserves source_type = ai_extracted', () => {
    const raw = { ...baseRaw, source_type: 'ai_extracted' };
    const result = normalizeSignal(raw);
    assert.equal(result.source_type, 'ai_extracted');
});

test('normalizeSignal: preserves source_type = imported', () => {
    const raw = { ...baseRaw, source_type: 'imported' };
    const result = normalizeSignal(raw);
    assert.equal(result.source_type, 'imported');
});

test('normalizeSignal: preserves source_type = manual', () => {
    const raw = { ...baseRaw, source_type: 'manual' };
    const result = normalizeSignal(raw);
    assert.equal(result.source_type, 'manual');
});

test('normalizeSignal: defaults source_type to empty string when absent', () => {
    const raw = { ...baseRaw };
    delete raw.source_type;
    const result = normalizeSignal(raw);
    assert.equal(result.source_type, '');
});

// ===== Combined: all three together =====

test('normalizeSignal: preserves all three admin workflow fields together', () => {
    const raw = {
        ...baseRaw,
        last_reviewed_at: '2026-05-14T12:00:00.000Z',
        ai_generated: true,
        source_type: 'ai_extracted',
    };
    const result = normalizeSignal(raw);
    assert.equal(result.last_reviewed_at, '2026-05-14T12:00:00.000Z');
    assert.equal(result.ai_generated, true);
    assert.equal(result.source_type, 'ai_extracted');
});
