import { db } from './config.js';
import {
    collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp
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
