/**
 * Phase 14 — AI Extract Helper Tests
 *
 * Tests pure functions from admin/ai-extract.js:
 * - parseModelJson (plain JSON, fenced JSON, missing signals)
 * - normalizeAiCandidates (forces draft/watch, stamps AI metadata)
 * - classifyAiCandidates (validates through validateRow, catches missing fields)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

let mod;
try {
    mod = await import('../admin/ai-extract.js');
} catch {
    mod = {};
}

const { parseModelJson, normalizeAiCandidates, classifyAiCandidates } = mod;

// ===== parseModelJson =====

test('parseModelJson: parses plain JSON', () => {
    const text = JSON.stringify({
        signals: [
            { title: 'Test signal', company_id: 'nvidia', status: 'draft' },
        ],
    });
    const result = parseModelJson(text);
    assert.ok(Array.isArray(result.signals));
    assert.equal(result.signals.length, 1);
    assert.equal(result.signals[0].title, 'Test signal');
});

test('parseModelJson: parses fenced JSON', () => {
    const text = '```json\n{"signals": [{"title": "Fenced signal", "company_id": "amd"}]}\n```';
    const result = parseModelJson(text);
    assert.ok(Array.isArray(result.signals));
    assert.equal(result.signals[0].title, 'Fenced signal');
});

test('parseModelJson: parses fenced JSON without json tag', () => {
    const text = '```\n{"signals": [{"title": "No lang tag"}]}\n```';
    const result = parseModelJson(text);
    assert.equal(result.signals[0].title, 'No lang tag');
});

test('parseModelJson: rejects missing signals array', () => {
    const text = '{"data": []}';
    assert.throws(() => parseModelJson(text), /signals/);
});

test('parseModelJson: rejects empty signals', () => {
    const text = '{"signals": "not an array"}';
    assert.throws(() => parseModelJson(text), /signals/);
});

test('parseModelJson: rejects no JSON object', () => {
    const text = 'This is just plain text with no JSON at all.';
    assert.throws(() => parseModelJson(text), /JSON/);
});

// ===== normalizeAiCandidates =====

const mockSettings = { model: 'deepseek-v4-flash' };

test('normalizeAiCandidates: forces status = draft for verified model output', () => {
    const payload = {
        signals: [
            {
                title: 'Test',
                company_id: 'nvidia',
                company_name: 'NVIDIA',
                chip_name: 'B200',
                region: 'USA',
                stage: 'ramp',
                status: 'verified',
                confidence_score: 80,
                abf_demand_impact: 'high',
            },
        ],
    };
    const result = normalizeAiCandidates(payload, mockSettings);
    assert.equal(result[0].status, 'draft');
    assert.ok(result[0].ai_generated);
    assert.equal(result[0].ai_model, 'deepseek-v4-flash');
    assert.equal(result[0].source_type, 'ai_extracted');
    assert.ok(result[0].ai_extracted_at);
});

test('normalizeAiCandidates: preserves watch but not verified', () => {
    const payload = {
        signals: [
            {
                title: 'Watch signal',
                company_id: 'amd',
                company_name: 'AMD',
                chip_name: 'MI300',
                region: 'USA',
                stage: 'pilot',
                status: 'watch',
                confidence_score: 50,
                abf_demand_impact: 'medium',
                evidence_summary: 'Some evidence here that is long enough for validation',
                confidence_reason: 'Reason for watch status',
            },
        ],
    };
    const result = normalizeAiCandidates(payload, mockSettings);
    assert.equal(result[0].status, 'watch');
});

test('normalizeAiCandidates: defaults to draft for unknown status', () => {
    const payload = {
        signals: [
            {
                title: 'Unknown status',
                company_id: 'intel',
                company_name: 'Intel',
                chip_name: 'Gaudi3',
                region: 'USA',
                stage: 'pilot',
                status: 'something_else',
                confidence_score: 30,
                abf_demand_impact: 'low',
            },
        ],
    };
    const result = normalizeAiCandidates(payload, mockSettings);
    assert.equal(result[0].status, 'draft');
});

test('normalizeAiCandidates: stamps ai_generated, ai_model, source_type', () => {
    const payload = {
        signals: [
            {
                title: 'Stamped',
                company_id: 'google',
                company_name: 'Google',
                chip_name: 'TPU v6',
                region: 'USA',
                stage: 'sampling',
                status: 'draft',
                confidence_score: 40,
                abf_demand_impact: 'medium',
            },
        ],
    };
    const result = normalizeAiCandidates(payload, mockSettings);
    assert.equal(result[0].ai_generated, true);
    assert.equal(result[0].ai_model, 'deepseek-v4-flash');
    assert.equal(result[0].source_type, 'ai_extracted');
    assert.ok(typeof result[0].ai_extracted_at === 'string');
});

test('normalizeAiCandidates: clamps confidence without evidence_summary', () => {
    const payload = {
        signals: [
            {
                title: 'No evidence',
                company_id: 'meta',
                company_name: 'Meta',
                chip_name: 'MTIA',
                region: 'USA',
                stage: 'pilot',
                status: 'draft',
                confidence_score: 90,
                abf_demand_impact: 'medium',
            },
        ],
    };
    const result = normalizeAiCandidates(payload, mockSettings);
    assert.ok(result[0].confidence_score <= 60, 'confidence should be clamped to 60 without evidence');
});

test('normalizeAiCandidates: converts comma-separated tags to arrays', () => {
    const payload = {
        signals: [
            {
                title: 'Array test',
                company_id: 'aws',
                company_name: 'AWS',
                chip_name: 'Trainium2',
                region: 'USA',
                stage: 'ramp',
                status: 'draft',
                confidence_score: 50,
                abf_demand_impact: 'high',
                tags: 'ai-accelerator, cloud, training',
                source_regions: 'USA, Taiwan',
            },
        ],
    };
    const result = normalizeAiCandidates(payload, mockSettings);
    assert.ok(Array.isArray(result[0].tags));
    assert.equal(result[0].tags.length, 3);
    assert.equal(result[0].tags[0], 'ai-accelerator');
});

// ===== classifyAiCandidates =====

test('classifyAiCandidates: missing company_id returns action=error', () => {
    const candidates = normalizeAiCandidates({
        signals: [
            {
                title: 'No company',
                company_id: '',
                company_name: '',
                chip_name: 'TestChip',
                region: 'USA',
                stage: 'ramp',
                status: 'draft',
                confidence_score: 40,
                abf_demand_impact: 'low',
                evidence_summary: 'Some evidence',
                confidence_reason: 'Some reason',
            },
        ],
    }, mockSettings);

    const results = classifyAiCandidates(candidates, []);
    assert.equal(results[0].action, 'error');
    assert.ok(results[0].issues.some(i => i.includes('company_id')), 'should mention missing company_id');
});

test('classifyAiCandidates: missing multiple required fields returns action=error', () => {
    const candidates = normalizeAiCandidates({
        signals: [
            {
                title: '',
                company_id: '',
                company_name: '',
                chip_name: '',
                region: '',
                stage: '',
                status: 'draft',
                confidence_score: 0,
                abf_demand_impact: '',
            },
        ],
    }, mockSettings);

    const results = classifyAiCandidates(candidates, []);
    assert.equal(results[0].action, 'error');
    assert.ok(results[0].issues.length > 0, 'should have error messages');
});

test('classifyAiCandidates: valid candidate still becomes action=create', () => {
    const candidates = normalizeAiCandidates({
        signals: [
            {
                title: 'Valid AI signal',
                company_id: 'nvidia',
                company_name: 'NVIDIA',
                chip_name: 'B200',
                region: 'USA',
                stage: 'ramp',
                status: 'draft',
                confidence_score: 50,
                abf_demand_impact: 'high',
                evidence_summary: 'Evidence summary with enough text',
                confidence_reason: 'Reason for confidence',
            },
        ],
    }, mockSettings);

    const results = classifyAiCandidates(candidates, []);
    assert.equal(results[0].action, 'create');
    assert.equal(results[0].data.company_id, 'nvidia');
    assert.equal(results[0].data.title, 'Valid AI signal');
});

test('classifyAiCandidates: missing region returns action=error', () => {
    const candidates = normalizeAiCandidates({
        signals: [
            {
                title: 'No region',
                company_id: 'amd',
                company_name: 'AMD',
                chip_name: 'MI350',
                region: '',
                stage: 'pilot',
                status: 'draft',
                confidence_score: 40,
                abf_demand_impact: 'medium',
                evidence_summary: 'Some evidence text here',
                confidence_reason: 'Some reason',
            },
        ],
    }, mockSettings);

    const results = classifyAiCandidates(candidates, []);
    assert.equal(results[0].action, 'error');
});

test('classifyAiCandidates: invalid stage enum returns action=error', () => {
    const candidates = normalizeAiCandidates({
        signals: [
            {
                title: 'Bad stage',
                company_id: 'intel',
                company_name: 'Intel',
                chip_name: 'Gaudi4',
                region: 'USA',
                stage: 'unknown_stage',
                status: 'draft',
                confidence_score: 40,
                abf_demand_impact: 'low',
                evidence_summary: 'Some evidence text here',
                confidence_reason: 'Some reason',
            },
        ],
    }, mockSettings);

    const results = classifyAiCandidates(candidates, []);
    assert.equal(results[0].action, 'error');
});
