import { db } from './config.js';
import {
    collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp, where
} from 'firebase/firestore';

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

const STAGE_ENUM = ['rumor', 'announced', 'sampling', 'design_win', 'pilot', 'ramp', 'volume'];
const STATUS_ENUM = ['draft', 'watch', 'verified', 'downgraded', 'invalidated'];
const IMPACT_ENUM = ['low', 'medium', 'high', 'explosive'];
const IMPACT_SORT = { explosive: 4, high: 3, medium: 2, low: 1 };

export function normalizeSignal(raw) {
    if (!raw) return null;
    const stage = STAGE_ENUM.includes(raw.stage) ? raw.stage : 'rumor';
    const status = STATUS_ENUM.includes(raw.status) ? raw.status : 'draft';
    const abf_demand_impact = IMPACT_ENUM.includes(raw.abf_demand_impact) ? raw.abf_demand_impact : 'low';
    let confidence_score = Number(raw.confidence_score) || 0;
    confidence_score = Math.max(0, Math.min(100, confidence_score));

    let abf_layers = null;
    if (raw.abf_layers != null) {
        const n = Number(raw.abf_layers);
        if (!isNaN(n) && n > 0) abf_layers = n;
    }

    let release_quarter = '';
    if (['Q1', 'Q2', 'Q3', 'Q4'].includes(raw.release_quarter)) {
        release_quarter = raw.release_quarter;
    }

    const sources = Array.isArray(raw.sources) ? raw.sources : [];
    const impact_scope = Array.isArray(raw.impact_scope) ? raw.impact_scope : [];
    const tags = Array.isArray(raw.tags) ? raw.tags : [];

    return {
        id: raw.id || '',
        title: raw.title || '',
        company_id: raw.company_id || '',
        company_name: raw.company_name || '',
        chip_name: raw.chip_name || '',
        region: raw.region || '',
        signal_type: raw.signal_type || '',
        stage,
        release_year: raw.release_year || null,
        release_quarter,
        package_type: raw.package_type || '',
        cowos_required: Boolean(raw.cowos_required),
        abf_size: raw.abf_size || '',
        abf_layers,
        hbm: raw.hbm || '',
        expected_volume: raw.expected_volume || '',
        abf_demand_impact,
        impact_scope,
        confidence_score,
        status,
        evidence_summary: raw.evidence_summary || '',
        conflicting_evidence: raw.conflicting_evidence || '',
        last_verified_at: raw.last_verified_at || '',
        tags,
        sources,
        notes: raw.notes || '',
    };
}

export async function loadSignals() {
    try {
        const snap = await getDocs(collection(db, 'signals'));
        const signals = snap.docs.map(d => normalizeSignal({ id: d.id, ...d.data() }));
        // Sort: abf_demand_impact desc → last_verified_at desc → confidence_score desc
        signals.sort((a, b) => {
            const impDiff = (IMPACT_SORT[b.abf_demand_impact] || 0) - (IMPACT_SORT[a.abf_demand_impact] || 0);
            if (impDiff !== 0) return impDiff;
            const dateDiff = new Date(b.last_verified_at || 0) - new Date(a.last_verified_at || 0);
            if (dateDiff !== 0) return dateDiff;
            return b.confidence_score - a.confidence_score;
        });
        return signals;
    } catch (err) {
        console.error('[Firestore] loadSignals error:', err);
        return [];
    }
}

export async function getSignal(id) {
    const snap = await getDoc(doc(db, 'signals', id));
    if (!snap.exists()) return null;
    return normalizeSignal({ id: snap.id, ...snap.data() });
}

export async function createSignal(data) {
    // Required field validation
    const required = ['title', 'company_id', 'company_name', 'chip_name', 'region', 'stage', 'confidence_score', 'abf_demand_impact', 'status'];
    for (const field of required) {
        if (!data[field] && data[field] !== 0) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    const normalized = normalizeSignal(data);
    const ref = await addDoc(collection(db, 'signals'), {
        ...normalized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function saveSignal(id, data) {
    const normalized = normalizeSignal(data);
    await updateDoc(doc(db, 'signals', id), {
        ...normalized,
        updatedAt: serverTimestamp(),
    });
}

export async function deleteSignal(id) {
    await deleteDoc(doc(db, 'signals', id));
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
