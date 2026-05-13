/**
 * signals-labels.js — Re-exports from signals-schema.js for backward compatibility.
 * Prefer importing directly from signals-schema.js in new code.
 */
export {
    STAGE_LABEL,
    STATUS_LABEL,
    IMPACT_LABEL,
    REGION_LABEL,
    labelize,
    STAGE_ENUM,
    STATUS_ENUM,
    IMPACT_ENUM,
    REGION_OPTIONS,
    IMPACT_SORT,
    HISTORY_ACTIONS,
    normalizeSignal,
} from './signals-schema.js';
