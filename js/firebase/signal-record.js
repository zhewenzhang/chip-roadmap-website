import { normalizeSignal } from '../modules/signals-schema.js';

export function normalizeSignalDoc(docId, data = {}) {
    return normalizeSignal({
        ...data,
        id: docId,
    });
}

export function stripSignalIdForWrite(signal = {}) {
    const { id: _id, ...rest } = signal || {};
    return rest;
}
