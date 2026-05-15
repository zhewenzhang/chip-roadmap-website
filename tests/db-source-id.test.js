/**
 * Regression tests for Firestore signal id handling.
 *
 * Firestore document id must be the source of truth. Older admin writes may
 * have persisted an empty `id` field inside the document data; if that field
 * overrides the document id during load, admin action buttons render with
 * data-id="" and saveSignal('', ...) crashes with an invalid document reference.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dbSource = readFileSync(new URL('../js/firebase/db.js', import.meta.url), 'utf8');

test('loadSignals normalizes Firestore data with document id taking precedence', () => {
    assert.match(
        dbSource,
        /normalizeSignal\(\{\s*\.\.\.d\.data\(\),\s*id:\s*d\.id\s*\}\)/,
        'loadSignals should spread document data first, then force id to d.id'
    );
});

test('getSignal normalizes Firestore data with document id taking precedence', () => {
    assert.match(
        dbSource,
        /normalizeSignal\(\{\s*\.\.\.snap\.data\(\),\s*id:\s*snap\.id\s*\}\)/,
        'getSignal should spread document data first, then force id to snap.id'
    );
});

test('saveSignal does not persist normalized id back into Firestore', () => {
    assert.match(
        dbSource,
        /delete normalized\.id;/,
        'write paths should delete normalized.id before writing signal data'
    );
});
