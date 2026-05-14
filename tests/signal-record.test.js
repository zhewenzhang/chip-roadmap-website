import test from 'node:test';
import assert from 'node:assert/strict';

let signalRecord;
try {
    signalRecord = await import('../js/firebase/signal-record.js');
} catch {
    signalRecord = {};
}

test('normalizeSignalDoc preserves Firestore doc id over empty stored id', () => {
    assert.equal(typeof signalRecord.normalizeSignalDoc, 'function', 'normalizeSignalDoc should exist');

    const signal = signalRecord.normalizeSignalDoc('doc-123', {
        id: '',
        title: 'Test signal',
        company_id: 'amd',
        company_name: 'AMD',
        chip_name: 'MI400',
        region: 'USA',
        stage: 'pilot',
        confidence_score: 70,
        abf_demand_impact: 'high',
        status: 'verified',
    });

    assert.equal(signal.id, 'doc-123');
});

test('stripSignalIdForWrite removes persisted id field from signal payload', () => {
    assert.equal(typeof signalRecord.stripSignalIdForWrite, 'function', 'stripSignalIdForWrite should exist');

    const payload = signalRecord.stripSignalIdForWrite({
        id: '',
        title: 'Test signal',
        status: 'verified',
    });

    assert.equal('id' in payload, false);
    assert.equal(payload.title, 'Test signal');
});
