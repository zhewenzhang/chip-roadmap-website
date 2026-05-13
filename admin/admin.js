import { auth, db } from '../js/firebase/config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import {
    collection, doc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { loadSignals, createSignal, saveSignal, deleteSignal as deleteSignalDb, normalizeSignal } from '../js/firebase/db.js';

// ===== STATE =====
let companiesData = [];
let insightsData = [];
let signalsData = [];
let currentSaveFn = null;

// ===== HELPERS =====
function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function renderMarkdown(md) {
    if (!md) return '<em style="color:#888">No content</em>';
    let html = md
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
        .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^---$/gm, '<hr>')
        .replace(/^\|(.+)\|$/gm, (m) => {
            const cells = m.split('|').slice(1, -1);
            if (cells.every(c => /^[-: ]+$/.test(c))) return '';
            return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
        })
        .replace(/(<tr>[\s\S]+?<\/tr>)/g, '<table>$1</table>')
        .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>[^\n]+\n?)+/g, m => `<ul>${m}</ul>`)
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/\n\n+/g, '</p><p>')
        .replace(/\n/g, '<br>');
    return `<p>${html}</p>`;
}

// ===== COMPLETENESS =====
const COMPLETENESS_FIELDS = [
    { path: 'description', type: 'string' },
    { path: 'headquarters', type: 'string' },
    { path: 'market_cap', type: 'string' },
    { path: 'founded', type: 'number' },
    { path: 'products', type: 'array' },
    { path: 'roadmap', type: 'array' },
    { path: 'analysis.strengths', type: 'array' },
    { path: 'analysis.weaknesses', type: 'array' },
    { path: 'analysis.opportunities', type: 'array' },
    { path: 'analysis.threats', type: 'array' },
];

function getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
}

function calcCompleteness(company) {
    let filled = 0;
    COMPLETENESS_FIELDS.forEach(({ path, type }) => {
        const val = getNestedValue(company, path);
        if (type === 'array') { if (Array.isArray(val) && val.length > 0) filled++; }
        else if (type === 'number') { if (val !== null && val !== undefined) filled++; }
        else { if (val && val !== '') filled++; }
    });
    return Math.round(filled / COMPLETENESS_FIELDS.length * 100);
}

function getMissingFields(company) {
    return COMPLETENESS_FIELDS
        .filter(({ path, type }) => {
            const val = getNestedValue(company, path);
            if (type === 'array') return !(Array.isArray(val) && val.length > 0);
            if (type === 'number') return val === null || val === undefined;
            return !val || val === '';
        })
        .map(f => f.path);
}

function badgeClass(pct) {
    if (pct < 40) return 'badge-red';
    if (pct < 70) return 'badge-yellow';
    return 'badge-green';
}

// ===== AUTH =====
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        document.getElementById('user-email').textContent = user.email;
        loadAllData();
    } else {
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('app-section').style.display = 'none';
    }
});

document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Logging in...';
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        const badCreds = ['auth/invalid-credential','auth/wrong-password','auth/user-not-found'];
        errorEl.textContent = badCreds.includes(err.code) ? 'Invalid email or password' : 'Login failed: ' + err.message;
        btn.disabled = false;
        btn.textContent = 'Login';
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// ===== TABS =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

// ===== DATA LOADING =====
async function loadAllData() {
    await Promise.all([fetchCompanies(), fetchInsights(), fetchSignals()]);
    renderCompaniesTab();
    renderInsightsTab();
    renderSignalsTab();
    renderArticlesTab();
    renderCompletenessTab();
}

async function fetchCompanies() {
    try {
        const snap = await getDocs(query(collection(db, 'companies'), orderBy('name_en')));
        companiesData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error('Error fetching companies:', err);
        companiesData = [];
    }
}

async function fetchInsights() {
    try {
        const snap = await getDocs(collection(db, 'insights'));
        insightsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error('Error fetching insights:', err);
        insightsData = [];
    }
}

async function fetchSignals() {
    try {
        signalsData = await loadSignals();
    } catch (err) {
        console.error('Error fetching signals:', err);
        signalsData = [];
    }
}

// ===== COMPANIES TAB =====
document.getElementById('tab-companies').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit-company') openEditCompanyModal(id);
    else if (action === 'delete-company') deleteCompanyAction(id);
    else if (action === 'new-company') openNewCompanyModal();
});

function renderCompaniesTab() {
    const sorted = [...companiesData].sort((a, b) => calcCompleteness(a) - calcCompleteness(b));
    const rows = sorted.map(c => {
        const pct = calcCompleteness(c);
        return `<tr>
            <td>${esc(c.id)}</td>
            <td>${esc(c.name_en)}</td>
            <td>${esc(c.region)}</td>
            <td>${esc(c.category)}</td>
            <td>${esc(c.abf_demand)}</td>
            <td><span class="badge ${badgeClass(pct)}">${pct}%</span></td>
            <td class="td-actions">
                <button class="btn-sm" data-action="edit-company" data-id="${esc(c.id)}">Edit</button>
                <button class="btn-sm btn-danger" data-action="delete-company" data-id="${esc(c.id)}">Del</button>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('companies-content').innerHTML = `
        <div class="toolbar">
            <h2>Companies (${companiesData.length})</h2>
            <button class="btn-primary" data-action="new-company" style="width:auto;padding:8px 16px">+ Add Company</button>
        </div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>ID</th><th>Name EN</th><th>Region</th><th>Category</th><th>ABF</th><th>Complete</th><th>Actions</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="7" style="color:#888;text-align:center">No companies (run migration first)</td></tr>'}</tbody>
            </table>
        </div>`;
}

function buildCompanyForm(company = {}) {
    const r = company;
    const arrToText = arr => Array.isArray(arr) ? arr.join('\n') : '';
    const regions = ['USA','China','Taiwan','Korea','Europe','Japan','Israel','Canada','Other'];
    const abfOpts = ['高','中','低'];
    return `
        <div class="form-group"><label>Company ID ${r.id ? '<small>(read-only)</small>' : ''}</label>
            <input id="f-id" value="${esc(r.id || '')}" ${r.id ? 'readonly style="opacity:0.5"' : ''} placeholder="e.g. nvidia">
        </div>
        <div class="form-group"><label>Name (EN)</label><input id="f-name_en" value="${esc(r.name_en || '')}"></div>
        <div class="form-group"><label>Name (CN)</label><input id="f-name_cn" value="${esc(r.name_cn || '')}"></div>
        <div class="form-group"><label>Country</label><input id="f-country" value="${esc(r.country || '')}"></div>
        <div class="form-group"><label>Region</label>
            <select id="f-region">${regions.map(v => `<option ${r.region === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Category</label><input id="f-category" value="${esc(r.category || '')}" placeholder="e.g. AI加速器/GPU"></div>
        <div class="form-group"><label>ABF Demand</label>
            <select id="f-abf_demand">${abfOpts.map(v => `<option ${r.abf_demand === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Market Position</label><input id="f-market_position" value="${esc(r.market_position || '')}"></div>
        <div class="form-group"><label>Headquarters</label><input id="f-headquarters" value="${esc(r.headquarters || '')}"></div>
        <div class="form-group"><label>Founded (year)</label><input id="f-founded" type="number" value="${r.founded ?? ''}"></div>
        <div class="form-group"><label>Market Cap</label><input id="f-market_cap" value="${esc(r.market_cap || '')}"></div>
        <div class="form-group"><label>Description</label><textarea id="f-description" rows="4">${esc(r.description || '')}</textarea></div>
        <div class="form-group"><label>Products (one per line)</label><textarea id="f-products" rows="3">${esc(arrToText(r.products))}</textarea></div>
        <div class="form-section-title">Roadmap (JSON array) — 支持欄位: product, year, quarter, process, specs, purpose, cowos(boolean), abf_size, abf_layers(number)</div>
        <div class="form-group"><textarea id="f-roadmap" rows="5" style="font-family:monospace;font-size:12px">${esc(JSON.stringify(r.roadmap || [], null, 2))}</textarea></div>
        <div class="form-section-title">SWOT Analysis</div>
        <div class="form-group"><label>Strengths (one per line)</label><textarea id="f-strengths" rows="3">${esc(arrToText(r.analysis?.strengths))}</textarea></div>
        <div class="form-group"><label>Weaknesses (one per line)</label><textarea id="f-weaknesses" rows="3">${esc(arrToText(r.analysis?.weaknesses))}</textarea></div>
        <div class="form-group"><label>Opportunities (one per line)</label><textarea id="f-opportunities" rows="3">${esc(arrToText(r.analysis?.opportunities))}</textarea></div>
        <div class="form-group"><label>Threats (one per line)</label><textarea id="f-threats" rows="3">${esc(arrToText(r.analysis?.threats))}</textarea></div>`;
}

function collectCompanyForm(existingId = null) {
    const lines = id => document.getElementById(id).value.split('\n').map(s => s.trim()).filter(Boolean);
    let roadmap = [];
    try { roadmap = JSON.parse(document.getElementById('f-roadmap').value || '[]'); } catch { roadmap = []; }
    const foundedRaw = document.getElementById('f-founded').value.trim();
    return {
        id: existingId || document.getElementById('f-id').value.trim(),
        name_en: document.getElementById('f-name_en').value.trim(),
        name_cn: document.getElementById('f-name_cn').value.trim(),
        country: document.getElementById('f-country').value.trim(),
        region: document.getElementById('f-region').value,
        category: document.getElementById('f-category').value.trim(),
        abf_demand: document.getElementById('f-abf_demand').value,
        market_position: document.getElementById('f-market_position').value.trim(),
        headquarters: document.getElementById('f-headquarters').value.trim(),
        founded: foundedRaw ? parseInt(foundedRaw) : null,
        market_cap: document.getElementById('f-market_cap').value.trim(),
        description: document.getElementById('f-description').value.trim(),
        products: lines('f-products'),
        roadmap,
        analysis: {
            strengths: lines('f-strengths'),
            weaknesses: lines('f-weaknesses'),
            opportunities: lines('f-opportunities'),
            threats: lines('f-threats'),
        }
    };
}

function openEditCompanyModal(companyId) {
    const company = companiesData.find(c => c.id === companyId);
    if (!company) return;
    openModal('Edit: ' + companyId, buildCompanyForm(company), async () => {
        const data = collectCompanyForm(companyId);
        const { id: _id, ...fields } = data;
        await setDoc(doc(db, 'companies', companyId), { ...fields, updatedAt: serverTimestamp() }, { merge: true });
        showToast('Saved ✓');
        await fetchCompanies();
        renderCompaniesTab();
        renderCompletenessTab();
    });
}

function openNewCompanyModal() {
    openModal('New Company', buildCompanyForm({}), async () => {
        const data = collectCompanyForm();
        if (!data.id) { showToast('Company ID is required', 'error'); throw new Error('ID required'); }
        if (companiesData.find(c => c.id === data.id)) { showToast('ID already exists', 'error'); throw new Error('Duplicate ID'); }
        const { id, ...fields } = data;
        await setDoc(doc(db, 'companies', id), { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        showToast('Created ✓');
        await fetchCompanies();
        renderCompaniesTab();
        renderCompletenessTab();
    });
}

async function deleteCompanyAction(companyId) {
    if (!confirm(`Delete "${companyId}"? Cannot be undone.`)) return;
    await deleteDoc(doc(db, 'companies', companyId));
    showToast('Deleted');
    await fetchCompanies();
    renderCompaniesTab();
    renderCompletenessTab();
}

// ===== INSIGHTS TAB =====
document.getElementById('tab-insights').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit-trend') openEditTrendModal(id);
    else if (action === 'edit-top-player') openEditTopPlayerModal(id);
    else if (action === 'delete-insight') deleteInsightAction(id);
    else if (action === 'new-trend') openNewTrendModal();
    else if (action === 'new-top-player') openNewTopPlayerModal();
});

function renderInsightsTab() {
    const trends = insightsData.filter(i => i.type === 'trend');
    const players = insightsData.filter(i => i.type === 'top_player');

    const trendRows = trends.map(t => `<tr>
        <td>${esc(t.title)}</td>
        <td><span class="badge badge-gray">${esc(t.impact)}</span></td>
        <td class="td-actions">
            <button class="btn-sm" data-action="edit-trend" data-id="${esc(t.id)}">Edit</button>
            <button class="btn-sm btn-danger" data-action="delete-insight" data-id="${esc(t.id)}">Del</button>
        </td>
    </tr>`).join('');

    const playerRows = players.map(p => `<tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.market_share)}</td>
        <td class="td-actions">
            <button class="btn-sm" data-action="edit-top-player" data-id="${esc(p.id)}">Edit</button>
            <button class="btn-sm btn-danger" data-action="delete-insight" data-id="${esc(p.id)}">Del</button>
        </td>
    </tr>`).join('');

    document.getElementById('insights-content').innerHTML = `
        <div class="toolbar" style="margin-bottom:8px">
            <h2>Trends (${trends.length})</h2>
            <button class="btn-primary" data-action="new-trend" style="width:auto;padding:8px 16px">+ Add Trend</button>
        </div>
        <div class="table-wrap" style="margin-bottom:32px">
            <table><thead><tr><th>Title</th><th>Impact</th><th>Actions</th></tr></thead>
            <tbody>${trendRows || '<tr><td colspan="3" style="color:#888;text-align:center">No trends</td></tr>'}</tbody></table>
        </div>
        <div class="toolbar" style="margin-bottom:8px">
            <h2>Top Players (${players.length})</h2>
            <button class="btn-primary" data-action="new-top-player" style="width:auto;padding:8px 16px">+ Add Player</button>
        </div>
        <div class="table-wrap">
            <table><thead><tr><th>Name</th><th>Market Share</th><th>Actions</th></tr></thead>
            <tbody>${playerRows || '<tr><td colspan="3" style="color:#888;text-align:center">No players</td></tr>'}</tbody></table>
        </div>`;
}

function buildTrendForm(t = {}) {
    const impacts = ['高','中','低'];
    return `
        <div class="form-group"><label>Title</label><input id="ft-title" value="${esc(t.title || '')}"></div>
        <div class="form-group"><label>Description</label><textarea id="ft-desc" rows="4">${esc(t.description || '')}</textarea></div>
        <div class="form-group"><label>Impact</label>
            <select id="ft-impact">${impacts.map(v => `<option ${t.impact === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Companies (comma-separated)</label>
            <input id="ft-companies" value="${esc((t.companies || []).join(', '))}">
        </div>`;
}

function collectTrendForm() {
    return {
        type: 'trend',
        title: document.getElementById('ft-title').value.trim(),
        description: document.getElementById('ft-desc').value.trim(),
        impact: document.getElementById('ft-impact').value,
        companies: document.getElementById('ft-companies').value.split(',').map(s => s.trim()).filter(Boolean)
    };
}

function openEditTrendModal(id) {
    const trend = insightsData.find(i => i.id === id);
    if (!trend) return;
    openModal('Edit Trend', buildTrendForm(trend), async () => {
        await updateDoc(doc(db, 'insights', id), { ...collectTrendForm(), updatedAt: serverTimestamp() });
        showToast('Saved ✓');
        await fetchInsights();
        renderInsightsTab();
    });
}

function openNewTrendModal() {
    openModal('New Trend', buildTrendForm({}), async () => {
        await addDoc(collection(db, 'insights'), {
            ...collectTrendForm(), tags: ['trend'],
            publishedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        showToast('Created ✓');
        await fetchInsights();
        renderInsightsTab();
    });
}

function buildTopPlayerForm(p = {}) {
    return `
        <div class="form-group"><label>Name</label><input id="fp-name" value="${esc(p.name || '')}"></div>
        <div class="form-group"><label>Market Share</label><input id="fp-share" value="${esc(p.market_share || '')}"></div>
        <div class="form-group"><label>Strength</label><textarea id="fp-strength" rows="3">${esc(p.strength || '')}</textarea></div>
        <div class="form-group"><label>Weakness</label><textarea id="fp-weakness" rows="3">${esc(p.weakness || '')}</textarea></div>
        <div class="form-group"><label>Outlook</label><textarea id="fp-outlook" rows="3">${esc(p.outlook || '')}</textarea></div>`;
}

function collectTopPlayerForm() {
    return {
        type: 'top_player',
        name: document.getElementById('fp-name').value.trim(),
        market_share: document.getElementById('fp-share').value.trim(),
        strength: document.getElementById('fp-strength').value.trim(),
        weakness: document.getElementById('fp-weakness').value.trim(),
        outlook: document.getElementById('fp-outlook').value.trim()
    };
}

function openEditTopPlayerModal(id) {
    const player = insightsData.find(i => i.id === id);
    if (!player) return;
    openModal('Edit Player', buildTopPlayerForm(player), async () => {
        await updateDoc(doc(db, 'insights', id), { ...collectTopPlayerForm(), updatedAt: serverTimestamp() });
        showToast('Saved ✓');
        await fetchInsights();
        renderInsightsTab();
    });
}

function openNewTopPlayerModal() {
    openModal('New Top Player', buildTopPlayerForm({}), async () => {
        await addDoc(collection(db, 'insights'), {
            ...collectTopPlayerForm(), tags: ['market'],
            publishedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        showToast('Created ✓');
        await fetchInsights();
        renderInsightsTab();
    });
}

async function deleteInsightAction(id) {
    if (!confirm('Delete this item? Cannot be undone.')) return;
    await deleteDoc(doc(db, 'insights', id));
    showToast('Deleted');
    await fetchInsights();
    renderInsightsTab();
    renderArticlesTab();
}

// ===== SIGNALS TAB =====
const STAGE_OPTIONS = ['rumor','announced','sampling','design_win','pilot','ramp','volume'];
const STATUS_OPTIONS = ['draft','watch','verified','downgraded','invalidated'];
const IMPACT_OPTIONS = ['low','medium','high','explosive'];
const REGION_OPTIONS = ['China','Taiwan','USA','Korea','Japan','Europe','Israel','Canada','Other','Global'];

document.getElementById('tab-signals').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit-signal') openEditSignalModal(id);
    else if (action === 'delete-signal') deleteSignalAction(id);
    else if (action === 'new-signal') openNewSignalModal();
    else if (action === 'filter-signals') applySignalFilters();
    else if (action === 'reset-signal-filters') resetSignalFilters();
});

function stageLabel(v) { return v.charAt(0).toUpperCase() + v.slice(1); }
function impactLabel(v) { return v.charAt(0).toUpperCase() + v.slice(1); }
function statusLabel(v) { return v.charAt(0).toUpperCase() + v.slice(1); }

function statusChipClass(s) {
    switch (s) {
        case 'verified': return 'badge-green';
        case 'watch': return 'badge-yellow';
        case 'downgraded': return 'badge-yellow';
        case 'invalidated': return 'badge-red';
        default: return 'badge-gray';
    }
}

function renderSignalsTab(filterState = {}) {
    let filtered = [...signalsData];
    if (filterState.company) filtered = filtered.filter(s => s.company_name === filterState.company);
    if (filterState.stage) filtered = filtered.filter(s => s.stage === filterState.stage);
    if (filterState.status) filtered = filtered.filter(s => s.status === filterState.status);

    const companies = [...new Set(signalsData.map(s => s.company_name).filter(Boolean))].sort();

    const rows = filtered.map(s => {
        const verified = s.last_verified_at ? new Date(s.last_verified_at).toISOString().slice(0, 10) : '—';
        return `<tr>
            <td>${esc(s.company_name)}</td>
            <td>${esc(s.chip_name)}</td>
            <td>${esc(s.title)}</td>
            <td><span class="badge badge-gray">${stageLabel(s.stage)}</span></td>
            <td><span class="badge ${statusChipClass(s.status)}">${statusLabel(s.status)}</span></td>
            <td>${s.confidence_score}</td>
            <td>${verified}</td>
            <td class="td-actions">
                <button class="btn-sm" data-action="edit-signal" data-id="${esc(s.id)}">Edit</button>
                <button class="btn-sm btn-danger" data-action="delete-signal" data-id="${esc(s.id)}">Del</button>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('signals-content').innerHTML = `
        <div class="toolbar">
            <h2>Signals (${signalsData.length})</h2>
            <button class="btn-primary" data-action="new-signal" style="width:auto;padding:8px 16px">+ Add Signal</button>
        </div>
        <div class="toolbar" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <select id="sig-filter-company" style="width:auto;padding:4px 8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:12px">
                <option value="">All companies</option>
                ${companies.map(c => `<option ${filterState.company === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
            <select id="sig-filter-stage" style="width:auto;padding:4px 8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:12px">
                <option value="">All stages</option>
                ${STAGE_OPTIONS.map(v => `<option value="${v}" ${filterState.stage === v ? 'selected' : ''}>${stageLabel(v)}</option>`).join('')}
            </select>
            <select id="sig-filter-status" style="width:auto;padding:4px 8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:12px">
                <option value="">All statuses</option>
                ${STATUS_OPTIONS.map(v => `<option value="${v}" ${filterState.status === v ? 'selected' : ''}>${statusLabel(v)}</option>`).join('')}
            </select>
            <button class="btn-sm" data-action="filter-signals">Apply</button>
            <button class="btn-sm btn-secondary" data-action="reset-signal-filters">Reset</button>
        </div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>Company</th><th>Chip</th><th>Title</th><th>Stage</th><th>Status</th><th>Confidence</th><th>Verified</th><th>Actions</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="8" style="color:#888;text-align:center">No signals yet</td></tr>'}</tbody>
            </table>
        </div>`;
}

function applySignalFilters() {
    const company = document.getElementById('sig-filter-company')?.value || '';
    const stage = document.getElementById('sig-filter-stage')?.value || '';
    const status = document.getElementById('sig-filter-status')?.value || '';
    renderSignalsTab({ company, stage, status });
}

function resetSignalFilters() {
    renderSignalsTab({});
}

function buildSignalForm(s = {}) {
    return `
        <div class="form-group"><label>Title *</label><input id="fs-title" value="${esc(s.title || '')}" required></div>
        <div class="form-group"><label>Company ID *</label><input id="fs-company_id" value="${esc(s.company_id || '')}" ${s.id ? 'readonly style="opacity:0.5"' : ''} required></div>
        <div class="form-group"><label>Company Name *</label><input id="fs-company_name" value="${esc(s.company_name || '')}" required></div>
        <div class="form-group"><label>Chip Name *</label><input id="fs-chip_name" value="${esc(s.chip_name || '')}" required></div>
        <div class="form-group"><label>Region *</label>
            <select id="fs-region">${REGION_OPTIONS.map(v => `<option ${s.region === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Stage *</label>
            <select id="fs-stage">${STAGE_OPTIONS.map(v => `<option ${s.stage === v ? 'selected' : ''}>${stageLabel(v)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Status *</label>
            <select id="fs-status">${STATUS_OPTIONS.map(v => `<option ${s.status === v ? 'selected' : ''}>${statusLabel(v)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>ABF Demand Impact *</label>
            <select id="fs-abf_demand_impact">${IMPACT_OPTIONS.map(v => `<option ${s.abf_demand_impact === v ? 'selected' : ''}>${impactLabel(v)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Confidence Score (0-100) *</label><input id="fs-confidence_score" type="number" min="0" max="100" value="${s.confidence_score ?? 50}"></div>
        <div class="form-group"><label>Signal Type</label><input id="fs-signal_type" value="${esc(s.signal_type || '')}" placeholder="e.g. product_progress"></div>
        <div class="form-group"><label>Release Year</label><input id="fs-release_year" type="number" value="${s.release_year ?? ''}" placeholder="e.g. 2026"></div>
        <div class="form-group"><label>Release Quarter</label>
            <select id="fs-release_quarter">
                <option value="" ${!s.release_quarter ? 'selected' : ''}>—</option>
                <option value="Q1" ${s.release_quarter === 'Q1' ? 'selected' : ''}>Q1</option>
                <option value="Q2" ${s.release_quarter === 'Q2' ? 'selected' : ''}>Q2</option>
                <option value="Q3" ${s.release_quarter === 'Q3' ? 'selected' : ''}>Q3</option>
                <option value="Q4" ${s.release_quarter === 'Q4' ? 'selected' : ''}>Q4</option>
            </select>
        </div>
        <div class="form-group"><label>Package Type</label><input id="fs-package_type" value="${esc(s.package_type || '')}" placeholder="e.g. 2.5D"></div>
        <div class="form-group"><label>CoWoS Required</label>
            <select id="fs-cowos_required">
                <option value="false" ${!s.cowos_required ? 'selected' : ''}>No</option>
                <option value="true" ${s.cowos_required ? 'selected' : ''}>Yes</option>
            </select>
        </div>
        <div class="form-group"><label>ABF Size</label><input id="fs-abf_size" value="${esc(s.abf_size || '')}" placeholder="e.g. 77mm x 77mm"></div>
        <div class="form-group"><label>ABF Layers</label><input id="fs-abf_layers" type="number" value="${s.abf_layers ?? ''}" placeholder="e.g. 16"></div>
        <div class="form-group"><label>HBM</label><input id="fs-hbm" value="${esc(s.hbm || '')}" placeholder="e.g. HBM3"></div>
        <div class="form-group"><label>Expected Volume</label><input id="fs-expected_volume" value="${esc(s.expected_volume || '')}" placeholder="e.g. medium"></div>
        <div class="form-group"><label>Impact Scope (comma-separated)</label><input id="fs-impact_scope" value="${esc((s.impact_scope || []).join(', '))}"></div>
        <div class="form-group"><label>Tags (comma-separated)</label><input id="fs-tags" value="${esc((s.tags || []).join(', '))}"></div>
        <div class="form-section-title">Evidence</div>
        <div class="form-group"><label>Evidence Summary</label><textarea id="fs-evidence_summary" rows="3">${esc(s.evidence_summary || '')}</textarea></div>
        <div class="form-group"><label>Conflicting Evidence</label><textarea id="fs-conflicting_evidence" rows="3">${esc(s.conflicting_evidence || '')}</textarea></div>
        <div class="form-group"><label>Notes</label><textarea id="fs-notes" rows="3">${esc(s.notes || '')}</textarea></div>
        <div class="form-group"><label>Last Verified At</label><input id="fs-last_verified_at" type="date" value="${s.last_verified_at ? new Date(s.last_verified_at).toISOString().slice(0,10) : ''}"></div>
        <div class="form-group"><label>Sources (JSON array)</label><textarea id="fs-sources" rows="4" style="font-family:monospace;font-size:12px">${esc(JSON.stringify(s.sources || [], null, 2))}</textarea></div>`;
}

function collectSignalForm() {
    const confidenceRaw = document.getElementById('fs-confidence_score').value.trim();
    const confidence = Number(confidenceRaw);
    if (isNaN(confidence) || confidence < 0 || confidence > 100) {
        showToast('Confidence score must be between 0 and 100', 'error');
        return null;
    }

    const stage = document.getElementById('fs-stage').value;
    if (!STAGE_OPTIONS.includes(stage)) {
        showToast('Invalid stage value', 'error');
        return null;
    }

    const status = document.getElementById('fs-status').value;
    if (!STATUS_OPTIONS.includes(status)) {
        showToast('Invalid status value', 'error');
        return null;
    }

    const abf_layers_raw = document.getElementById('fs-abf_layers').value.trim();
    let abf_layers = null;
    if (abf_layers_raw) {
        abf_layers = Number(abf_layers_raw);
        if (isNaN(abf_layers)) {
            showToast('ABF Layers must be a number', 'error');
            return null;
        }
    }

    let sources = [];
    try {
        sources = JSON.parse(document.getElementById('fs-sources').value || '[]');
        if (!Array.isArray(sources)) sources = [];
    } catch {
        showToast('Sources must be valid JSON array', 'error');
        return null;
    }

    return {
        title: document.getElementById('fs-title').value.trim(),
        company_id: document.getElementById('fs-company_id').value.trim(),
        company_name: document.getElementById('fs-company_name').value.trim(),
        chip_name: document.getElementById('fs-chip_name').value.trim(),
        region: document.getElementById('fs-region').value,
        stage,
        status,
        abf_demand_impact: document.getElementById('fs-abf_demand_impact').value,
        confidence_score: confidence,
        signal_type: document.getElementById('fs-signal_type').value.trim(),
        release_year: document.getElementById('fs-release_year').value ? parseInt(document.getElementById('fs-release_year').value) : null,
        release_quarter: document.getElementById('fs-release_quarter').value,
        package_type: document.getElementById('fs-package_type').value.trim(),
        cowos_required: document.getElementById('fs-cowos_required').value === 'true',
        abf_size: document.getElementById('fs-abf_size').value.trim(),
        abf_layers,
        hbm: document.getElementById('fs-hbm').value.trim(),
        expected_volume: document.getElementById('fs-expected_volume').value.trim(),
        impact_scope: document.getElementById('fs-impact_scope').value.split(',').map(s => s.trim()).filter(Boolean),
        tags: document.getElementById('fs-tags').value.split(',').map(s => s.trim()).filter(Boolean),
        evidence_summary: document.getElementById('fs-evidence_summary').value.trim(),
        conflicting_evidence: document.getElementById('fs-conflicting_evidence').value.trim(),
        notes: document.getElementById('fs-notes').value.trim(),
        last_verified_at: document.getElementById('fs-last_verified_at').value ? new Date(document.getElementById('fs-last_verified_at').value).toISOString() : '',
        sources,
    };
}

function openNewSignalModal() {
    openModal('New Signal', buildSignalForm({}), async () => {
        const data = collectSignalForm();
        if (!data) throw new Error('Validation failed');
        if (!data.title || !data.company_id || !data.company_name || !data.chip_name || !data.region) {
            showToast('Required fields missing', 'error');
            throw new Error('Required fields missing');
        }
        await createSignal(data);
        showToast('Created ✓');
        await fetchSignals();
        renderSignalsTab();
    });
}

function openEditSignalModal(id) {
    const signal = signalsData.find(s => s.id === id);
    if (!signal) return;
    openModal('Edit: ' + signal.title, buildSignalForm(signal), async () => {
        const data = collectSignalForm();
        if (!data) throw new Error('Validation failed');
        await saveSignal(id, data);
        showToast('Saved ✓');
        await fetchSignals();
        renderSignalsTab();
    });
}

async function deleteSignalAction(id) {
    const signal = signalsData.find(s => s.id === id);
    if (!confirm(`Delete "${signal?.title}"? Cannot be undone.`)) return;
    await deleteSignalDb(id);
    showToast('Deleted');
    await fetchSignals();
    renderSignalsTab();
}

// ===== ARTICLES TAB =====
document.getElementById('tab-articles').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit-article') openEditArticleModal(id);
    else if (action === 'delete-article') deleteInsightAction(id);
    else if (action === 'new-article') openNewArticleModal();
});

function renderArticlesTab() {
    const articles = insightsData.filter(i => i.type === 'article' || i.type === 'market_brief');
    const rows = articles.map(a => `<tr>
        <td>${esc(a.title)}</td>
        <td><span class="badge badge-gray">${esc(a.type)}</span></td>
        <td>${esc((a.tags || []).join(', '))}</td>
        <td class="td-actions">
            <button class="btn-sm" data-action="edit-article" data-id="${esc(a.id)}">Edit</button>
            <button class="btn-sm btn-danger" data-action="delete-article" data-id="${esc(a.id)}">Del</button>
        </td>
    </tr>`).join('');

    document.getElementById('articles-content').innerHTML = `
        <div class="toolbar">
            <h2>Articles (${articles.length})</h2>
            <button class="btn-primary" data-action="new-article" style="width:auto;padding:8px 16px">+ New Article</button>
        </div>
        <div class="table-wrap">
            <table><thead><tr><th>Title</th><th>Type</th><th>Tags</th><th>Actions</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" style="color:#888;text-align:center">No articles yet</td></tr>'}</tbody></table>
        </div>
        <p style="color:#888;font-size:12px;margin-top:12px">Articles support Markdown with image links and tables.</p>`;
}

function buildArticleForm(a = {}) {
    const types = ['article','market_brief'];
    return `
        <div class="form-group"><label>Title</label><input id="fa-title" value="${esc(a.title || '')}"></div>
        <div class="form-group"><label>Type</label>
            <select id="fa-type">${types.map(v => `<option ${a.type === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Tags (comma-separated)</label><input id="fa-tags" value="${esc((a.tags || []).join(', '))}"></div>
        <div class="form-group"><label>Summary</label><textarea id="fa-summary" rows="2">${esc(a.summary || '')}</textarea></div>
        <div class="form-group"><label>Related Companies (comma-separated)</label>
            <input id="fa-companies" value="${esc((a.relatedCompanies || []).join(', '))}">
        </div>
        <div class="form-section-title">Content (Markdown)</div>
        <div class="md-editor-wrap">
            <div class="form-group">
                <div class="md-label">Write</div>
                <textarea id="fa-content" rows="20">${esc(a.content || '')}</textarea>
            </div>
            <div>
                <div class="md-label">Preview</div>
                <div class="md-preview-panel" id="fa-preview">${renderMarkdown(a.content)}</div>
            </div>
        </div>`;
}

function initArticlePreview() {
    const textarea = document.getElementById('fa-content');
    const preview = document.getElementById('fa-preview');
    if (!textarea || !preview) return;
    textarea.addEventListener('input', () => { preview.innerHTML = renderMarkdown(textarea.value); });
}

function collectArticleForm() {
    return {
        title: document.getElementById('fa-title').value.trim(),
        type: document.getElementById('fa-type').value,
        tags: document.getElementById('fa-tags').value.split(',').map(s => s.trim()).filter(Boolean),
        summary: document.getElementById('fa-summary').value.trim(),
        relatedCompanies: document.getElementById('fa-companies').value.split(',').map(s => s.trim()).filter(Boolean),
        content: document.getElementById('fa-content').value
    };
}

function openEditArticleModal(id) {
    const article = insightsData.find(i => i.id === id);
    if (!article) return;
    openModal('Edit Article', buildArticleForm(article), async () => {
        await updateDoc(doc(db, 'insights', id), { ...collectArticleForm(), updatedAt: serverTimestamp() });
        showToast('Saved ✓');
        await fetchInsights();
        renderArticlesTab();
    }, true);
    initArticlePreview();
}

function openNewArticleModal() {
    openModal('New Article', buildArticleForm({}), async () => {
        await addDoc(collection(db, 'insights'), {
            ...collectArticleForm(),
            publishedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        showToast('Created ✓');
        await fetchInsights();
        renderArticlesTab();
    }, true);
    initArticlePreview();
}

// ===== COMPLETENESS TAB =====
function renderCompletenessTab() {
    const sorted = [...companiesData].sort((a, b) => calcCompleteness(a) - calcCompleteness(b));
    const cards = sorted.map(c => {
        const pct = calcCompleteness(c);
        const missing = getMissingFields(c);
        return `<div class="completeness-card">
            <div class="completeness-card-header">
                <h3>${esc(c.name_en || c.id)}</h3>
                <span class="badge ${badgeClass(pct)}">${pct}%</span>
            </div>
            <ul class="missing-fields ${missing.length === 0 ? 'complete' : ''}">
                ${missing.length === 0
                    ? '<li class="ok">All fields complete</li>'
                    : missing.map(f => `<li>${f}</li>`).join('')}
            </ul>
        </div>`;
    }).join('');

    const complete = companiesData.filter(c => calcCompleteness(c) === 100).length;
    const partial = companiesData.filter(c => { const p = calcCompleteness(c); return p >= 40 && p < 100; }).length;
    const incomplete = companiesData.filter(c => calcCompleteness(c) < 40).length;

    document.getElementById('completeness-content').innerHTML = `
        <div class="toolbar">
            <h2>Completeness Report</h2>
            <span style="font-size:13px">
                <span class="badge badge-green">${complete} complete</span>&nbsp;
                <span class="badge badge-yellow">${partial} partial</span>&nbsp;
                <span class="badge badge-red">${incomplete} incomplete</span>
            </span>
        </div>
        <p style="color:#888;font-size:12px;margin-bottom:16px">Sorted by completeness (least complete first). Run migration first to see data.</p>
        <div class="completeness-grid">${cards || '<p style="color:#888">No companies loaded. Run migration first.</p>'}</div>`;
}

// ===== MODAL SYSTEM =====
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalSave = document.getElementById('modal-save');
const modalCancel = document.getElementById('modal-cancel');
const modalClose = document.getElementById('modal-close');

function openModal(title, bodyHtml, onSave, wide = false) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modal.style.display = 'flex';
    modal.querySelector('.modal-box').style.maxWidth = wide ? '900px' : '680px';
    currentSaveFn = onSave;
    setTimeout(() => {
        const first = modalBody.querySelector('input, textarea, select');
        if (first) first.focus();
    }, 50);
}

function closeModal() {
    modal.style.display = 'none';
    modalBody.innerHTML = '';
    currentSaveFn = null;
}

modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.style.display !== 'none') closeModal(); });

modalSave.addEventListener('click', async () => {
    if (!currentSaveFn) return;
    modalSave.disabled = true;
    modalSave.textContent = 'Saving...';
    try {
        await currentSaveFn();
        closeModal();
    } catch (err) {
        if (err.message !== 'ID required' && err.message !== 'Duplicate ID') {
            showToast('Error: ' + err.message, 'error');
        }
    } finally {
        modalSave.disabled = false;
        modalSave.textContent = 'Save';
    }
});
