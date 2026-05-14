import { db } from './config.js';
import {
    collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp, where
} from 'firebase/firestore';
import { normalizeSignal, IMPACT_SORT, HISTORY_ACTIONS } from '../modules/signals-schema.js';
import { normalizeSignalDoc, stripSignalIdForWrite } from './signal-record.js';

function showErrorBanner(message) {
    const existing = document.querySelector('.notification-error');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.setAttribute('role', 'alert');
    banner.className = 'notification notification-error';
    banner.textContent = message;
    document.body.appendChild(banner);
    setTimeout(() => {
        banner.classList.add('notification-hide');
        setTimeout(() => banner.remove(), 300);
    }, 5000);
}

// ===== READ FUNCTIONS =====

export async function loadCompanies() {
    const snap = await getDocs(collection(db, 'companies'));
    const result = {};
    snap.forEach(docSnap => {
        result[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
    });
    return result;
}

export async function loadRoadmaps() {
    const snap = await getDocs(collection(db, 'companies'));
    const result = {};
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (Array.isArray(data.roadmap) && data.roadmap.length > 0) {
            result[docSnap.id] = {
                company: data.name_en || data.name_cn || docSnap.id,
                timeline: data.roadmap
            };
        }
    });
    return result;
}

export async function loadInsights() {
    const snap = await getDocs(collection(db, 'insights'));
    const result = {
        trends: [],
        top_players: [],
        abf_demand_analysis: null,
        key_insights: []
    };
    snap.forEach(docSnap => {
        const data = { id: docSnap.id, ...docSnap.data() };
        switch (data.type) {
            case 'trend':
                result.trends.push(data);
                break;
            case 'top_player':
                result.top_players.push(data);
                break;
            case 'abf_analysis':
                result.abf_demand_analysis = data.abf_data || null;
                break;
            case 'key_insights':
                result.key_insights = Array.isArray(data.items) ? data.items : [];
                break;
        }
    });
    return result;
}

export async function loadMarketStats() {
    const docRef = doc(db, 'market_stats', 'summary');
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return {};
    return docSnap.data();
}

export async function loadAllData() {
    try {
        const [companies, roadmaps, market, insights] = await Promise.all([
            loadCompanies(),
            loadRoadmaps(),
            loadMarketStats(),
            loadInsights()
        ]);
        console.log('[Firestore] Loaded:', {
            companies: Object.keys(companies).length,
            roadmaps: Object.keys(roadmaps).length,
            trends: insights.trends.length,
            top_players: insights.top_players.length
        });
        return { companies, roadmaps, market, insights };
    } catch (err) {
        console.error('[Firestore] Load error:', err);
        showErrorBanner('数据加载失败，请检查网络连接。');
        return {
            companies: {},
            roadmaps: {},
            market: {},
            insights: { trends: [], top_players: [], abf_demand_analysis: null, key_insights: [] }
        };
    }
}

// ===== SIGNALS =====
// normalizeSignal, IMPACT_SORT imported from signals-schema.js at top of file
export { normalizeSignal };

/**
 * loadSignals — returns { ok: true, data: Signal[] } or { ok: false, error: Error }
 * Never collapses a load failure into an empty array.
 *
 * Phase 13.1: excludes archived records by default.
 */
export async function loadSignals(options = {}) {
    const { includeArchived = false } = options;
    try {
        const snap = await getDocs(collection(db, 'signals'));
        let signals = snap.docs.map(d => normalizeSignal({ id: d.id, ...d.data() })).filter(Boolean);
        if (!includeArchived) {
            signals = signals.filter(s => !s.archived && s.status !== 'archived');
        }
        signals.sort((a, b) => {
            const impDiff = (IMPACT_SORT[b.abf_demand_impact] || 0) - (IMPACT_SORT[a.abf_demand_impact] || 0);
            if (impDiff !== 0) return impDiff;
            const dateDiff = new Date(b.last_verified_at || 0) - new Date(a.last_verified_at || 0);
            if (dateDiff !== 0) return dateDiff;
            return b.confidence_score - a.confidence_score;
        });
        return { ok: true, data: signals };
    } catch (err) {
        console.error('[Firestore] loadSignals error:', err);
        return { ok: false, error: err };
    }
}

export async function getSignal(id) {
    const snap = await getDoc(doc(db, 'signals', id));
    if (!snap.exists()) return null;
    return normalizeSignal({ id: snap.id, ...snap.data() });
}

/**
 * writeSignalHistory — fire-and-forget audit event; never blocks the main operation.
 */
async function writeSignalHistory(signalId, action, actor, summary) {
    try {
        await addDoc(collection(db, 'signal_history'), {
            signal_id: signalId,
            action,
            actor: actor || 'unknown',
            summary: summary || '',
            timestamp: serverTimestamp(),
        });
    } catch (err) {
        console.warn('[Firestore] history write failed:', err);
    }
}

export async function loadSignalHistory(signalId, limit = 5) {
    try {
        const q = query(
            collection(db, 'signal_history'),
            where('signal_id', '==', signalId),
            orderBy('timestamp', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.slice(0, limit).map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn('[Firestore] loadSignalHistory error:', err);
        return [];
    }
}

export async function createSignal(data, actor = '') {
    // Trim string fields before normalization to catch whitespace-only values
    const cleaned = { ...data };
    for (const key of Object.keys(cleaned)) {
        if (typeof cleaned[key] === 'string') {
            cleaned[key] = cleaned[key].trim();
        }
    }

    const normalized = normalizeSignal(cleaned);

    // Validate fields that have NO defaults in normalizeSignal
    // (stage/status/abf_demand_impact/confidence_score get defaults)
    const required = ['title', 'company_id', 'company_name', 'chip_name', 'region'];
    for (const field of required) {
        if (!normalized[field] && normalized[field] !== 0) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    const ref = await addDoc(collection(db, 'signals'), {
        ...normalized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    await writeSignalHistory(ref.id, HISTORY_ACTIONS.CREATED, actor,
        `Signal created: ${normalized.title}`);
    return ref.id;
}

export async function saveSignal(id, data, opts = {}) {
    const { actor = '', previousStatus = null, previousConfidence = null } = opts;

    // Trim string fields before normalization
    const cleaned = { ...data };
    for (const key of Object.keys(cleaned)) {
        if (typeof cleaned[key] === 'string') {
            cleaned[key] = cleaned[key].trim();
        }
    }

    const normalized = normalizeSignal(cleaned);

    // Auto-stamp last_status_changed_at when status changes
    if (previousStatus !== null && previousStatus !== normalized.status) {
        normalized.last_status_changed_at = new Date().toISOString();
    }
    // Auto-stamp last_confidence_changed_at when confidence changes (Phase 2)
    if (previousConfidence !== null && previousConfidence !== normalized.confidence_score) {
        normalized.last_confidence_changed_at = new Date().toISOString();
    }

    // Don't overwrite createdAt on save
    delete normalized.createdAt;

    await updateDoc(doc(db, 'signals', id), {
        ...normalized,
        updatedAt: serverTimestamp(),
    });

    // Determine history action
    let action = HISTORY_ACTIONS.UPDATED;
    let summary = `Signal updated: ${normalized.title}`;
    if (previousStatus !== null && previousStatus !== normalized.status) {
        action = HISTORY_ACTIONS.STATUS_CHANGED;
        summary = `Status changed from ${previousStatus} to ${normalized.status}`;
    } else if (previousConfidence !== null && previousConfidence !== normalized.confidence_score) {
        action = HISTORY_ACTIONS.CONFIDENCE_CHANGED;
        summary = `Confidence changed from ${previousConfidence} to ${normalized.confidence_score}`;
    }
    await writeSignalHistory(id, action, actor, summary);
}

/**
 * archiveSignal — Phase 13.1: soft delete.
 * Sets archived=true, status='archived', records metadata and history.
 */
export async function archiveSignal(id, opts = {}) {
    const { actor = '', reason = '' } = opts;
    await updateDoc(doc(db, 'signals', id), {
        archived: true,
        archived_at: new Date().toISOString(),
        archived_by: actor || '',
        archive_reason: reason || '',
        status: 'archived',
        updatedAt: serverTimestamp(),
    });
    await writeSignalHistory(id, HISTORY_ACTIONS.ARCHIVED, actor, reason || 'Signal archived');
}

/**
 * deleteSignal — Phase 13.1: aliased to archiveSignal for safety.
 * Hard delete (deleteDoc) is no longer the default admin action.
 */
export async function deleteSignal(id, opts = {}) {
    return archiveSignal(id, opts);
}

// ===== WRITE FUNCTIONS (admin only) =====

export async function saveCompany(companyId, data) {
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...fields } = data;
    await setDoc(doc(db, 'companies', companyId), {
        ...fields,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

export async function createCompany(companyId, data) {
    const { id: _id, ...fields } = data;
    await setDoc(doc(db, 'companies', companyId), {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}

export async function deleteCompany(companyId) {
    await deleteDoc(doc(db, 'companies', companyId));
}

export async function saveInsight(insightId, data) {
    const { id: _id, createdAt: _ca, ...fields } = data;
    if (insightId) {
        await updateDoc(doc(db, 'insights', insightId), {
            ...fields,
            updatedAt: serverTimestamp()
        });
        return insightId;
    } else {
        const ref = await addDoc(collection(db, 'insights'), {
            ...fields,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            publishedAt: serverTimestamp()
        });
        return ref.id;
    }
}

export async function deleteInsight(insightId) {
    await deleteDoc(doc(db, 'insights', insightId));
}
