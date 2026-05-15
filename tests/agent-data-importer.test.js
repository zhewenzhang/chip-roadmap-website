import test from 'node:test';
import assert from 'node:assert/strict';

import {
    isValidUrl,
    normalizeAgentCompany,
    normalizeAgentSignal,
    normalizeDeepDiveSignal,
    parseJsonl,
    sanitizeDocId,
    shouldImportCompany,
    stableId,
} from '../scripts/agent-data-importer.js';

test('stableId is deterministic and prefixed', () => {
    assert.equal(stableId('oc', ['run', 'nvidia', 'B200']), stableId('oc', ['run', 'nvidia', 'B200']));
    assert.ok(stableId('oc', ['run']).startsWith('oc-'));
});

test('parseJsonl ignores blank lines', () => {
    const rows = parseJsonl('{"a":1}\n\n{"b":2}\n');
    assert.deepEqual(rows, [{ a: 1 }, { b: 2 }]);
});

test('normalizeAgentSignal maps OpenClaw enums into app enums', () => {
    const signal = normalizeAgentSignal({
        title: 'GB200 ramp',
        company_id: 'nvidia',
        company_name: 'NVIDIA',
        chip_name: 'GB200',
        region: 'US',
        signal_type: 'shipment_ramp',
        stage: 'mass_production',
        status: 'verified',
        release_year: 2026,
        release_quarter: null,
        package_type: 'CoWoS_2.5D',
        cowos_required: true,
        abf_demand_impact: 'HIGH',
        confidence_score: 120,
        sources: ['https://example.com/a'],
    }, { run_id: 'run-1' });

    assert.equal(signal.region, 'USA');
    assert.equal(signal.stage, 'volume');
    assert.equal(signal.package_type, 'CoWoS');
    assert.equal(signal.abf_demand_impact, 'high');
    assert.equal(signal.confidence_score, 100);
    assert.equal(signal.status, 'verified');
    assert.equal(signal.last_verified_by, 'openclaw-auto');
    assert.equal(signal.sources[0].type, 'link');
});

test('normalizeAgentSignal keeps non-verified rows as watch', () => {
    const signal = normalizeAgentSignal({
        title: 'Watch item',
        company_id: 'amd',
        status: 'draft',
        confidence_score: 50,
    });
    assert.equal(signal.status, 'watch');
    assert.equal(signal.requires_human_review, true);
});

test('normalizeDeepDiveSignal skips invalid URLs', () => {
    const signal = normalizeDeepDiveSignal({ url: 'N/A', detail: 'x' }, {
        companyId: 'google_tpu',
        companyName: 'Google TPU',
        runId: 'run-1',
        deepDiveId: 'google_tpu',
    });
    assert.equal(signal, null);
});

test('normalizeDeepDiveSignal creates watch signal for valid URL', () => {
    const signal = normalizeDeepDiveSignal({
        signal_id: 'g1',
        entity: 'Google TPU',
        topic: 'HBM pressure',
        detail: 'HBM demand rises',
        url: 'https://example.com/tpu',
        confidence: 72,
    }, {
        companyId: 'google_tpu',
        companyName: 'Google TPU',
        runId: 'run-1',
        runDate: '2026-05-15',
        deepDiveId: 'google_tpu',
    });

    assert.equal(signal.status, 'watch');
    assert.equal(signal.company_id, 'google_tpu');
    assert.equal(signal.confidence_score, 72);
    assert.equal(signal.source_type, 'ai_extracted');
});

test('normalizeAgentCompany preserves business fields for admin import', () => {
    const company = normalizeAgentCompany({
        company_id: 'shinko-electric',
        name_en: 'Shinko Electric',
        region: 'Japan',
        company_type: 'substrate',
        market_data: { ticker: '6967.T', market_cap: '26B' },
        main_products: [{ name: 'ABF Substrate' }],
        abf_relevance: { level: 'critical' },
        company_analysis: { strengths: ['ABF'] },
        tracking_priority: { level: 'P0' },
        source_quality: { overall: 'medium' },
        import_decision: { decision: 'import_ready' },
        data_quality: { needs_human_review: false },
    });

    assert.equal(company.id, 'shinko-electric');
    assert.equal(company.category, 'substrate');
    assert.equal(company.ticker, '6967.T');
    assert.equal(company.abf, 'critical');
    assert.equal(company.products[0].name, 'ABF Substrate');
    assert.equal(company.needs_human_review, false);
});

test('shouldImportCompany allows reviewed handoff decisions only', () => {
    assert.equal(shouldImportCompany({ import_decision: { decision: 'import_ready' } }), true);
    assert.equal(shouldImportCompany({ review: { decision: 'reviewed' } }), true);
    assert.equal(shouldImportCompany({ import_decision: { decision: 'rejected' } }), false);
});

test('utility validators', () => {
    assert.equal(isValidUrl('https://example.com'), true);
    assert.equal(isValidUrl('N/A'), false);
    assert.equal(sanitizeDocId('Daily 2026/05/15'), 'daily-2026-05-15');
});
