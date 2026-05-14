/**
 * Phase 14.2 — Data Quality Review Tests
 *
 * Tests pure functions from js/modules/data-quality.js:
 * - checkNeedsReview via evaluateSignalQuality
 * - reviewed_at suppression of recent-change issues
 * - conflicting_evidence + review_note suppression
 */

import test from 'node:test';
import assert from 'node:assert/strict';

let mod;
try {
    mod = await import('../js/modules/data-quality.js');
} catch {
    mod = {};
}

const { evaluateSignalQuality, buildQualityQueue, QUEUE_TYPES } = mod;

const baseSignal = {
    id: 'sig-1',
    title: 'Test signal',
    company_id: 'nvidia',
    company_name: 'NVIDIA',
    chip_name: 'B200',
    region: 'USA',
    stage: 'ramp',
    status: 'verified',
    confidence_score: 80,
    abf_demand_impact: 'high',
    evidence_summary: 'Some evidence',
    confidence_reason: 'Some reason',
    last_verified_at: '2026-05-01',
    last_verified_by: 'admin@test.com',
    conflicting_evidence: '',
    reviewed_at: '',
    reviewed_by: '',
    review_note: '',
    last_status_changed_at: '',
    last_confidence_changed_at: '',
};

const now = Date.now();
const daysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

// ===== Recent status change =====

test('checkNeedsReview: recent status change (7 days ago) creates NEEDS_REVIEW', () => {
    const signal = { ...baseSignal, last_status_changed_at: daysAgo(7) };
    const issues = evaluateSignalQuality(signal, {});
    const reviewIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    assert.ok(reviewIssues.length > 0, 'should have NEEDS_REVIEW issue');
    assert.ok(reviewIssues.some(i => i.reason.includes('狀態變更')), 'should mention status change');
});

test('checkNeedsReview: old status change (30 days ago) does NOT create NEEDS_REVIEW', () => {
    const signal = { ...baseSignal, last_status_changed_at: daysAgo(30) };
    const issues = evaluateSignalQuality(signal, {});
    const reviewIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    assert.equal(reviewIssues.length, 0, 'should have no NEEDS_REVIEW issue');
});

test('checkNeedsReview: reviewed_at after last_status_changed_at suppresses the issue', () => {
    const signal = {
        ...baseSignal,
        last_status_changed_at: daysAgo(7),
        reviewed_at: daysAgo(2),
        review_note: 'Reviewed and confirmed',
    };
    const issues = evaluateSignalQuality(signal, {});
    const statusReviewIssues = issues.filter(i =>
        i.queueType === QUEUE_TYPES.NEEDS_REVIEW && i.reason.includes('狀態')
    );
    assert.equal(statusReviewIssues.length, 0, 'recent status change should be suppressed by reviewed_at');
});

// ===== Recent confidence change =====

test('checkNeedsReview: recent confidence change (5 days ago) creates NEEDS_REVIEW', () => {
    const signal = { ...baseSignal, last_confidence_changed_at: daysAgo(5) };
    const issues = evaluateSignalQuality(signal, {});
    const reviewIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    assert.ok(reviewIssues.some(i => i.reason.includes('信度')), 'should mention confidence change');
});

test('checkNeedsReview: reviewed_at after last_confidence_changed_at suppresses the issue', () => {
    const signal = {
        ...baseSignal,
        last_confidence_changed_at: daysAgo(5),
        reviewed_at: daysAgo(1),
        review_note: 'Confidence reviewed',
    };
    const issues = evaluateSignalQuality(signal, {});
    const confReviewIssues = issues.filter(i =>
        i.queueType === QUEUE_TYPES.NEEDS_REVIEW && i.reason.includes('信度')
    );
    assert.equal(confReviewIssues.length, 0, 'recent confidence change should be suppressed by reviewed_at');
});

// ===== Conflicting evidence =====

test('checkNeedsReview: conflicting_evidence creates NEEDS_REVIEW', () => {
    const signal = {
        ...baseSignal,
        conflicting_evidence: 'Some sources say ramp, others say pilot',
    };
    const issues = evaluateSignalQuality(signal, {});
    const reviewIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    assert.ok(reviewIssues.some(i => i.reason.includes('矛盾')), 'should mention conflicting evidence');
});

test('checkNeedsReview: conflicting_evidence without review_note still creates NEEDS_REVIEW', () => {
    const signal = {
        ...baseSignal,
        conflicting_evidence: 'Contradiction here',
        reviewed_at: daysAgo(1),
        review_note: '',
    };
    const issues = evaluateSignalQuality(signal, {});
    const reviewIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    assert.ok(reviewIssues.some(i => i.reason.includes('矛盾')), 'conflicting evidence without review_note should still trigger NEEDS_REVIEW');
});

test('checkNeedsReview: conflicting_evidence with review_note and reviewed_at suppresses the issue', () => {
    const signal = {
        ...baseSignal,
        conflicting_evidence: 'Contradiction here',
        reviewed_at: daysAgo(1),
        review_note: 'Investigated contradiction — resolved by checking latest earnings call',
    };
    const issues = evaluateSignalQuality(signal, {});
    const conflictReviewIssues = issues.filter(i =>
        i.queueType === QUEUE_TYPES.NEEDS_REVIEW && i.reason.includes('矛盾')
    );
    assert.equal(conflictReviewIssues.length, 0, 'conflicting evidence should be suppressed with reviewed_at + review_note');
});

// ===== buildQualityQueue integration =====

test('buildQualityQueue: reviewed signal does not appear in NEEDS_REVIEW queue', () => {
    const signals = [
        {
            ...baseSignal,
            id: 'sig-reviewed',
            last_status_changed_at: daysAgo(3),
            reviewed_at: daysAgo(1),
            review_note: 'All good',
        },
    ];
    const queue = buildQualityQueue(signals, {});
    const reviewItems = queue.filter(q => q.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    assert.equal(reviewItems.length, 0, 'reviewed signal should not be in NEEDS_REVIEW queue');
});

test('buildQualityQueue: unreviewed signal with recent change appears in NEEDS_REVIEW queue', () => {
    const signals = [
        {
            ...baseSignal,
            id: 'sig-unreviewed',
            last_status_changed_at: daysAgo(3),
        },
    ];
    const queue = buildQualityQueue(signals, {});
    const reviewItems = queue.filter(q => q.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    assert.ok(reviewItems.length > 0, 'unreviewed signal should be in NEEDS_REVIEW queue');
});

// ===== Guided Resolution (Phase 14.3) =====

test('mark-reviewed suppresses NEEDS_REVIEW but leaves NEEDS_VERIFICATION if status is draft', () => {
    const signal = {
        ...baseSignal,
        status: 'draft',
        last_status_changed_at: daysAgo(5),
        reviewed_at: daysAgo(1),
        review_note: 'Reviewed',
    };
    const issues = evaluateSignalQuality(signal, {});
    const reviewIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    const verIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_VERIFICATION);
    assert.equal(reviewIssues.length, 0, 'NEEDS_REVIEW should be suppressed');
    assert.ok(verIssues.length > 0, 'NEEDS_VERIFICATION should still exist for draft status');
});

test('mark-reviewed + verified fields removes NEEDS_VERIFICATION', () => {
    const signal = {
        ...baseSignal,
        status: 'verified',
        last_status_changed_at: daysAgo(5),
        reviewed_at: daysAgo(1),
        review_note: 'Reviewed',
        last_verified_at: daysAgo(1),
        last_verified_by: 'admin@test.com',
        confidence_score: 80,
        evidence_summary: 'Evidence',
        confidence_reason: 'Reason',
    };
    const issues = evaluateSignalQuality(signal, {});
    const reviewIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    const verIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_VERIFICATION);
    assert.equal(reviewIssues.length, 0, 'NEEDS_REVIEW should be suppressed');
    assert.equal(verIssues.length, 0, 'NEEDS_VERIFICATION should be suppressed after verification');
});

test('draft/watch signals do not create NEEDS_REVIEW even with recent status change', () => {
    const signal = {
        ...baseSignal,
        status: 'draft',
        last_status_changed_at: daysAgo(1),
    };
    const issues = evaluateSignalQuality(signal, {});
    const reviewIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    const verificationIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_VERIFICATION);
    assert.equal(reviewIssues.length, 0, 'draft signal should not be routed to NEEDS_REVIEW');
    assert.ok(verificationIssues.length > 0, 'draft signal should remain in NEEDS_VERIFICATION');
});

test('buildQualityQueue: draft with recent status change is primarily NEEDS_VERIFICATION', () => {
    const queue = buildQualityQueue([
        {
            ...baseSignal,
            id: 'sig-draft-recent',
            status: 'draft',
            last_status_changed_at: daysAgo(1),
        },
    ], {});
    assert.equal(queue.length, 1);
    assert.equal(queue[0].queueType, QUEUE_TYPES.NEEDS_VERIFICATION);
});

test('checkNeedsReview: watch + recent confidence change does NOT create NEEDS_REVIEW', () => {
    const signal = {
        ...baseSignal,
        status: 'watch',
        last_confidence_changed_at: daysAgo(3),
    };
    const issues = evaluateSignalQuality(signal, {});
    const reviewIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    assert.equal(reviewIssues.length, 0, 'watch signal should not be routed to NEEDS_REVIEW');
});

test('checkNeedsReview: conflicting_evidence on draft does NOT create NEEDS_REVIEW', () => {
    const signal = {
        ...baseSignal,
        status: 'draft',
        conflicting_evidence: 'Some contradictory info',
    };
    const issues = evaluateSignalQuality(signal, {});
    const reviewIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    assert.equal(reviewIssues.length, 0, 'conflicting evidence on draft should not produce NEEDS_REVIEW');
});

test('checkNeedsReview: conflicting_evidence on verified creates NEEDS_REVIEW', () => {
    const signal = {
        ...baseSignal,
        conflicting_evidence: 'Source A says ramp, Source B says pilot',
    };
    const issues = evaluateSignalQuality(signal, {});
    const reviewIssues = issues.filter(i => i.queueType === QUEUE_TYPES.NEEDS_REVIEW);
    assert.ok(reviewIssues.length > 0, 'conflicting evidence on verified should produce NEEDS_REVIEW');
    assert.ok(reviewIssues.some(i => i.reason.includes('矛盾')));
});

test('checkNeedsReview: conflicting_evidence on verified + reviewed_at + review_note resolves', () => {
    const signal = {
        ...baseSignal,
        conflicting_evidence: 'Contradictory sources',
        reviewed_at: daysAgo(1),
        review_note: 'Resolved: latest earnings call confirms ramp status',
    };
    const issues = evaluateSignalQuality(signal, {});
    const conflictReviewIssues = issues.filter(i =>
        i.queueType === QUEUE_TYPES.NEEDS_REVIEW && i.reason.includes('矛盾')
    );
    assert.equal(conflictReviewIssues.length, 0, 'conflicting evidence should be suppressed with review');
});
