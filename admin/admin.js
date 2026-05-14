import { auth, db } from '../js/firebase/config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import {
    collection, doc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
    query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { loadSignals, createSignal, saveSignal, deleteSignal as deleteSignalDb, archiveSignal, normalizeSignal, loadSignalHistory } from '../js/firebase/db.js';
import {
    STAGE_LABEL, STATUS_LABEL, IMPACT_LABEL, REGION_LABEL, labelize,
    STAGE_ENUM, STATUS_ENUM, IMPACT_ENUM, REGION_OPTIONS,
    HISTORY_ACTION_LABELS,
} from '../js/modules/signals-schema.js';
import {
    buildQualityQueue, getQualitySummary, sortQualityQueue,
    evaluateSignalQuality, QUEUE_TYPES,
} from '../js/modules/data-quality.js';
import {
    downloadTemplate, parseExcelFile, validateRow, classifyImportRow,
    importSignals, logImportBatch,
} from './import-signals.js';
import {
    AI_SETTINGS_KEYS, DEFAULT_EXTRACTION_PROMPT,
    loadAiSettings, saveAiSettings,
    loadExtractionPrompt, saveExtractionPrompt, resetExtractionPrompt,
    testDeepSeekConnection, extractSignalsWithDeepSeek,
    parseModelJson, normalizeAiCandidates, classifyAiCandidates,
} from './ai-extract.js';

// ===== STATE =====
let companiesData = [];
let signalsData = [];
let qualityQueue = [];
let currentSaveFn = null;
let showArchivedSignals = false;

// ===== HELPERS =====
function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Normalize chip name: trim whitespace, collapse internal spaces,
 * normalize common variants (e.g., extra spaces, inconsistent casing for known prefixes).
 */
function normalizeChipName(raw) {
    let name = String(raw || '').trim();
    // Collapse multiple spaces
    name = name.replace(/\s+/g, ' ');
    // Normalize known prefix variants
    const prefixes = ['Ascend', 'Blackwell', 'Rubin', 'MI', 'TPU', 'Trainium', 'Inferentia'];
    for (const prefix of prefixes) {
        const regex = new RegExp(`^${prefix.toLowerCase()}\\b`, 'i');
        if (regex.test(name)) {
            name = prefix + name.slice(prefix.length);
            break;
        }
    }
    return name;
}

function showToast(msg, type = 'success', duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, duration);
}

/**
 * Describe where a signal goes after an action.
 * Returns { statusLabel, queueType, publicVisible, message, blockers }.
 */
function describeSignalPlacement(signal, queueItems) {
    const status = signal.status;
    const stage = signal.stage;
    const archived = signal.archived || status === 'archived';

    // Determine queue type
    let queueType = '無';
    if (!archived && status !== 'draft') {
        const item = queueItems?.find(q => q.signalId === signal.id);
        if (item) queueType = item.queueType;
    }

    // Public visibility rules
    const publicVisible = !archived
        && status !== 'draft'
        && status !== 'invalidated';

    // Roadmap visibility
    const roadmapVisible = status === 'verified'
        && ['pilot', 'ramp', 'volume'].includes(stage);

    // Blockers
    const blockers = [];
    if (archived) blockers.push('已封存');
    if (status === 'draft') blockers.push('狀態為草稿');
    if (status === 'invalidated') blockers.push('已失效');
    if (!signal.evidence_summary) blockers.push('缺少證據摘要');
    if (!signal.confidence_reason) blockers.push('缺少信度依據');

    let message = '';
    if (archived) {
        message = `已封存，不再顯示於任何隊列`;
    } else if (status === 'invalidated') {
        message = `狀態為 invalidated，不再公開可見`;
    } else if (status === 'verified') {
        message = `已驗證，公開可見`;
        if (roadmapVisible) message += '，同時顯示於路線圖';
    } else if (status === 'watch') {
        message = `觀察中，進入「待驗證」隊列`;
    } else if (status === 'downgraded') {
        message = `已降級，公開可見但標注為降級`;
    } else {
        message = `草稿狀態，進入「新信號」隊列`;
    }

    if (queueType !== '無') {
        message += `，仍有數據品質問題：${queueType}`;
    }

    return { statusLabel: statusLabel(status), queueType, publicVisible, roadmapVisible, message, blockers };
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
    await Promise.all([fetchCompanies(), fetchSignals()]);
    buildQualityQueueFromData();
    renderDashboardTab();
    renderInboxTab();
    renderReviewTab();
    renderAddDataTab();
    renderCompaniesTab();
    renderSignalsTab();
    renderDataQualityTab();
    // Legacy tabs (hidden, kept for backward compatibility)
    renderImportTab();
    renderAiExtractTab();
    renderCompletenessTab();
}

function buildQualityQueueFromData() {
    const allChipNames = new Set(signalsData.map(s => s.chip_name).filter(Boolean));
    qualityQueue = buildQualityQueue(signalsData, { companies: companiesData, allChipNames });
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

async function fetchSignals() {
    const result = await loadSignals({ includeArchived: showArchivedSignals });
    if (result.ok) {
        signalsData = result.data;
        buildQualityQueueFromData();
    } else {
        console.error('Error fetching signals:', result.error);
        signalsData = [];
        showToast('信號載入失敗，請重整頁面', 'error');
    }
    // Refresh all tabs that depend on signals data
    renderDashboardTab();
    renderInboxTab();
    renderReviewTab();
}

// ===== COMPANIES TAB =====
document.getElementById('tab-companies').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit-company') openEditCompanyModal(id);
    else if (action === 'delete-company') deleteCompanyAction(id);
    else if (action === 'new-company') openNewCompanyModal();
    else if (action === 'bulk-add-companies') openBulkAddCompaniesModal();
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
            <div style="display:flex;gap:8px">
                <button class="btn-primary" data-action="bulk-add-companies" style="width:auto;padding:8px 16px">批量新增</button>
                <button class="btn-primary" data-action="new-company" style="width:auto;padding:8px 16px">+ Add Company</button>
            </div>
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

function openBulkAddCompaniesModal() {
    const formHtml = `
        <div style="margin-bottom:12px">
            <p style="color:var(--text);font-size:13px;line-height:1.6">
                每行輸入一個公司名稱，或使用格式：<code style="background:var(--surface2);padding:2px 4px;border-radius:3px">company_id | name_en | name_cn | region</code>
            </p>
            <p style="color:var(--text-muted);font-size:12px;margin-top:4px">
                例如：<code>NVIDIA</code> 或 <code>nvidia | NVIDIA | 輝達 | USA</code>
            </p>
        </div>
        <textarea id="bulk-company-input" class="bulk-add-textarea" placeholder="NVIDIA&#10;AMD&#10;Huawei&#10;tsmc | TSMC | 台積電 | Taiwan"></textarea>
        <div id="bulk-company-preview" style="display:none"></div>
        <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn-sm" id="bulk-company-preview-btn">預覽</button>
            <button class="btn-primary" id="bulk-company-import-btn" style="width:auto" disabled>確認匯入</button>
        </div>
        <div style="margin-top:16px;padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:4px;font-size:12px;color:var(--text-muted)">
            AI 公司資料補全將在後續階段加入。當前版本只支持批量建立公司目錄，不自動生成未驗證公司資料。
        </div>
    `;

    let bulkPreviewData = [];

    openModal('批量新增公司', formHtml, async () => {
        // Import confirmed companies
        const actor = auth.currentUser?.email || '';
        let created = 0;
        let skipped = 0;
        for (const item of bulkPreviewData) {
            if (item.status === 'duplicate') { skipped++; continue; }
            if (item.status === 'error') { skipped++; continue; }
            try {
                await setDoc(doc(db, 'companies', item.id), {
                    name_en: item.name_en,
                    name_cn: item.name_cn || '',
                    region: item.region || 'Other',
                    country: item.country || '',
                    category: '',
                    abf_demand: '',
                    market_position: '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                created++;
            } catch (err) {
                console.error('Failed to create company:', item.id, err);
                skipped++;
            }
        }
        showToast(`匯入完成：${created} 建立 / ${skipped} 跳過`, 'success', 4000);
        await fetchCompanies();
        renderCompaniesTab();
        renderCompletenessTab();
    }, true);

    // Preview button handler
    document.getElementById('bulk-company-preview-btn')?.addEventListener('click', () => {
        const raw = document.getElementById('bulk-company-input').value.trim();
        if (!raw) {
            showToast('請輸入公司資料', 'error');
            return;
        }

        const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        bulkPreviewData = [];

        for (const line of lines) {
            const parts = line.split('|').map(p => p.trim());
            let id, name_en, name_cn, region;

            if (parts.length >= 4) {
                id = parts[0].toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
                name_en = parts[1];
                name_cn = parts[2];
                region = parts[3];
            } else if (parts.length === 1 && parts[0]) {
                name_en = parts[0];
                id = name_en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
                name_cn = '';
                region = 'Other';
            } else {
                bulkPreviewData.push({ id: line, name_en: line, status: 'error', message: '格式錯誤' });
                continue;
            }

            // Check duplicate
            const existing = companiesData.find(c => c.id === id || c.name_en === name_en);
            if (existing) {
                bulkPreviewData.push({ id, name_en, name_cn, region, status: 'duplicate', message: `已存在: ${existing.id}` });
            } else {
                bulkPreviewData.push({ id, name_en, name_cn, region, status: 'new', message: '建立' });
            }
        }

        renderBulkCompanyPreview();
    });

    function renderBulkCompanyPreview() {
        const previewDiv = document.getElementById('bulk-company-preview');
        const importBtn = document.getElementById('bulk-company-import-btn');
        if (!previewDiv) return;

        const newCount = bulkPreviewData.filter(i => i.status === 'new').length;
        importBtn.disabled = newCount === 0;

        const statusLabels = { new: '建立', duplicate: '跳過', error: '錯誤' };
        const statusClasses = { new: 'row-new', duplicate: 'row-duplicate', error: 'row-error' };

        const rows = bulkPreviewData.map(item => `
            <tr class="${statusClasses[item.status]}">
                <td>${esc(item.id)}</td>
                <td>${esc(item.name_en)}</td>
                <td>${esc(item.name_cn || '')}</td>
                <td>${esc(item.region || '')}</td>
                <td><span class="badge ${item.status === 'new' ? 'badge-green' : item.status === 'duplicate' ? 'badge-yellow' : 'badge-red'}">${statusLabels[item.status]}</span></td>
                <td>${esc(item.message || '')}</td>
            </tr>
        `).join('');

        previewDiv.style.display = 'block';
        previewDiv.innerHTML = `<div class="bulk-add-preview">
            <table><thead><tr><th>ID</th><th>Name EN</th><th>Name CN</th><th>Region</th><th>動作</th><th>備註</th></tr></thead>
            <tbody>${rows}</tbody></table>
        </div>`;
    }
}

async function deleteCompanyAction(companyId) {
    if (!confirm(`Delete "${companyId}"? Cannot be undone.`)) return;
    await deleteDoc(doc(db, 'companies', companyId));
    showToast('Deleted');
    await fetchCompanies();
    renderCompaniesTab();
    renderCompletenessTab();
}

// ===== SIGNALS TAB =====
// Enum arrays imported from signals-schema.js (STAGE_ENUM, STATUS_ENUM, IMPACT_ENUM, REGION_OPTIONS)
const STAGE_OPTIONS = STAGE_ENUM;
const STATUS_OPTIONS = STATUS_ENUM;
const IMPACT_OPTIONS = IMPACT_ENUM;

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

function stageLabel(v) { return labelize(STAGE_LABEL, v); }
function impactLabel(v) { return labelize(IMPACT_LABEL, v); }
function statusLabel(v) { return labelize(STATUS_LABEL, v); }
function regionLabel(v) { return labelize(REGION_LABEL, v); }

function statusChipClass(s) {
    switch (s) {
        case 'verified': return 'badge-green';
        case 'watch': return 'badge-yellow';
        case 'downgraded': return 'badge-yellow';
        case 'invalidated': return 'badge-red';
        case 'archived': return 'badge-gray';
        default: return 'badge-gray';
    }
}

function renderSignalsTab(filterState = {}) {
    let filtered = [...signalsData];
    if (filterState.company) filtered = filtered.filter(s => s.company_name === filterState.company);
    if (filterState.stage) filtered = filtered.filter(s => s.stage === filterState.stage);
    if (filterState.status) filtered = filtered.filter(s => s.status === filterState.status);
    if (filterState.source) {
        if (filterState.source === 'manual') {
            filtered = filtered.filter(s => !s.ai_generated && s.source_type !== 'imported');
        } else if (filterState.source === 'ai') {
            filtered = filtered.filter(s => s.ai_generated === true);
        } else if (filterState.source === 'imported') {
            filtered = filtered.filter(s => s.source_type === 'imported');
        }
    }

    const companies = [...new Set(signalsData.map(s => s.company_name).filter(Boolean))].sort();

    const rows = filtered.map(s => {
        const isArchived = s.archived || s.status === 'archived';
        const verified = s.last_verified_at ? new Date(s.last_verified_at).toISOString().slice(0, 10) : '—';
        const updated = s.updatedAt ? new Date(s.updatedAt).toISOString().slice(0, 16).replace('T', ' ') : '—';
        const rowClass = isArchived ? 'style="opacity:0.5"' : '';
        const archivedBadge = isArchived ? '<span class="badge badge-gray" style="margin-left:4px;font-size:10px">封存</span>' : '';
        const aiBadge = s.ai_generated ? '<span class="badge badge-gray" style="margin-left:4px;font-size:10px">AI</span>' : '';
        return `<tr ${rowClass}>
            <td>${esc(s.company_name)}</td>
            <td>${esc(s.chip_name)}</td>
            <td>${esc(s.title)}${archivedBadge}${aiBadge}</td>
            <td><span class="badge badge-gray">${stageLabel(s.stage)}</span></td>
            <td><span class="badge ${statusChipClass(s.status)}">${statusLabel(s.status)}</span></td>
            <td>${s.confidence_score}</td>
            <td>${verified}<br><small style="color:#888">${updated}</small></td>
            <td class="td-actions">
                <button class="btn-sm" data-action="edit-signal" data-id="${esc(s.id)}">編輯</button>
                <button class="btn-sm btn-danger" data-action="delete-signal" data-id="${esc(s.id)}">${isArchived ? '已封存' : '封存'}</button>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('signals-content').innerHTML = `
        <div class="toolbar">
            <h2>信號 (${signalsData.length})</h2>
            <button class="btn-primary" data-action="new-signal" style="width:auto;padding:8px 16px">+ 新增信號</button>
        </div>
        <div class="toolbar" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <select id="sig-filter-company" style="width:auto;padding:4px 8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:12px">
                <option value="">全部公司</option>
                ${companies.map(c => `<option ${filterState.company === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
            <select id="sig-filter-stage" style="width:auto;padding:4px 8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:12px">
                <option value="">全部階段</option>
                ${STAGE_OPTIONS.map(v => `<option value="${v}" ${filterState.stage === v ? 'selected' : ''}>${stageLabel(v)}</option>`).join('')}
            </select>
            <select id="sig-filter-status" style="width:auto;padding:4px 8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:12px">
                <option value="">全部狀態</option>
                ${STATUS_OPTIONS.map(v => `<option value="${v}" ${filterState.status === v ? 'selected' : ''}>${statusLabel(v)}</option>`).join('')}
            </select>
            <select id="sig-filter-source" style="width:auto;padding:4px 8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:12px">
                <option value="">全部來源</option>
                <option value="manual" ${filterState.source === 'manual' ? 'selected' : ''}>人工</option>
                <option value="ai" ${filterState.source === 'ai' ? 'selected' : ''}>AI</option>
                <option value="imported" ${filterState.source === 'imported' ? 'selected' : ''}>匯入</option>
            </select>
            <button class="btn-sm" data-action="filter-signals">套用</button>
            <button class="btn-sm btn-secondary" data-action="reset-signal-filters">重置</button>
            <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-muted);margin-left:auto;cursor:pointer">
                <input type="checkbox" id="sig-show-archived" ${showArchivedSignals ? 'checked' : ''} style="cursor:pointer">
                顯示已封存
            </label>
        </div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>公司</th><th>芯片</th><th>標題</th><th>階段</th><th>狀態</th><th>信度</th><th>最後驗證</th><th>操作</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="8" style="color:#888;text-align:center">尚無信號</td></tr>'}</tbody>
            </table>
        </div>`;

    // Bind archived toggle
    const archivedCheckbox = document.getElementById('sig-show-archived');
    if (archivedCheckbox) {
        archivedCheckbox.addEventListener('change', async () => {
            showArchivedSignals = archivedCheckbox.checked;
            await fetchSignals();
            renderSignalsTab(filterState);
        });
    }
}

function applySignalFilters() {
    const company = document.getElementById('sig-filter-company')?.value || '';
    const stage = document.getElementById('sig-filter-stage')?.value || '';
    const status = document.getElementById('sig-filter-status')?.value || '';
    const source = document.getElementById('sig-filter-source')?.value || '';
    renderSignalsTab({ company, stage, status, source });
}

function resetSignalFilters() {
    renderSignalsTab({});
}

function buildSignalForm(s = {}) {
    const chipNames = [...new Set(signalsData.map(sig => sig.chip_name).filter(Boolean))].sort();
    const companyOptions = companiesData.map(c =>
        `<option value="${esc(c.id)}" ${s.company_id === c.id ? 'selected' : ''}>${esc(c.name_en)} (${esc(c.id)})</option>`
    ).join('');

    return `
        <div class="signal-edit-workspace">
            <!-- Core Identity -->
            <div class="edit-section">
                <div class="edit-section-title">核心資訊</div>
                <div class="form-group"><label>標題 *</label><input id="fs-title" value="${esc(s.title || '')}" required></div>
                <div class="form-group"><label>公司 *</label>
                    <select id="fs-company_id" required>
                        <option value="">選擇公司...</option>
                        ${companyOptions}
                    </select>
                </div>
                <div class="form-group"><label>公司名稱 <small>(自動同步)</small></label><input id="fs-company_name" value="${esc(s.company_name || '')}" readonly style="opacity:0.6"></div>
                <div class="form-group"><label>芯片名稱 *</label>
                    <input id="fs-chip_name" value="${esc(s.chip_name || '')}" list="chip-name-datalist" required>
                    <datalist id="chip-name-datalist">
                        ${chipNames.map(name => `<option value="${esc(name)}">`).join('')}
                    </datalist>
                </div>
                <div class="form-group"><label>地區 *</label>
                    <select id="fs-region">${REGION_OPTIONS.map(v => `<option value="${v}" ${s.region === v ? 'selected' : ''}>${regionLabel(v)}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>信號類型</label>
                    <input id="fs-signal_type" value="${esc(s.signal_type || '')}" list="signal-type-options" placeholder="例如：product_progress">
                    <datalist id="signal-type-options">
                        <option value="product_progress"><option value="supply_chain"><option value="capacity"><option value="customer_win"><option value="roadmap_change">
                    </datalist>
                </div>
            </div>

            <!-- Verification / Status -->
            <div class="edit-section">
                <div class="edit-section-title">驗證與狀態</div>
                <div class="form-group"><label>階段 *</label>
                    <select id="fs-stage">${STAGE_OPTIONS.map(v => `<option value="${v}" ${s.stage === v ? 'selected' : ''}>${stageLabel(v)}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>狀態 *</label>
                    <select id="fs-status">${STATUS_OPTIONS.map(v => `<option value="${v}" ${s.status === v ? 'selected' : ''}>${statusLabel(v)}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>ABF 需求影響 *</label>
                    <select id="fs-abf_demand_impact">${IMPACT_OPTIONS.map(v => `<option value="${v}" ${s.abf_demand_impact === v ? 'selected' : ''}>${impactLabel(v)}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>信度 (0-100) *</label><input id="fs-confidence_score" type="number" min="0" max="100" value="${s.confidence_score ?? 50}"></div>
                <div class="form-group"><label>量產年份</label><input id="fs-release_year" type="number" value="${s.release_year ?? ''}" placeholder="2026"></div>
                <div class="form-group"><label>量產季度</label>
                    <select id="fs-release_quarter">
                        <option value="" ${!s.release_quarter ? 'selected' : ''}>—</option>
                        <option value="Q1" ${s.release_quarter === 'Q1' ? 'selected' : ''}>Q1</option>
                        <option value="Q2" ${s.release_quarter === 'Q2' ? 'selected' : ''}>Q2</option>
                        <option value="Q3" ${s.release_quarter === 'Q3' ? 'selected' : ''}>Q3</option>
                        <option value="Q4" ${s.release_quarter === 'Q4' ? 'selected' : ''}>Q4</option>
                    </select>
                </div>
            </div>

            <!-- Evidence -->
            <div class="edit-section">
                <div class="edit-section-title">證據</div>
                <div class="form-group"><label>證據摘要</label><textarea id="fs-evidence_summary" rows="3">${esc(s.evidence_summary || '')}</textarea></div>
                <div class="form-group"><label>矛盾證據</label><textarea id="fs-conflicting_evidence" rows="3">${esc(s.conflicting_evidence || '')}</textarea></div>
                <div class="form-group"><label>信度依據</label><textarea id="fs-confidence_reason" rows="2" placeholder="為何信度是這個分數？">${esc(s.confidence_reason || '')}</textarea></div>
                <div class="form-group"><label>驗證備註</label><textarea id="fs-verification_note" rows="2" placeholder="本次驗證說明">${esc(s.verification_note || '')}</textarea></div>
                <div class="form-group"><label>驗證人（email）</label><input id="fs-last_verified_by" value="${esc(s.last_verified_by || '')}" placeholder="留空自動填入"></div>
                <div class="form-group"><label>最後驗證日期</label>
                    <div style="display:flex;gap:8px;align-items:center">
                        <input id="fs-last_verified_at" type="date" value="${s.last_verified_at ? new Date(s.last_verified_at).toISOString().slice(0,10) : ''}" style="flex:1">
                        <button type="button" class="btn-secondary" style="padding:6px 12px;font-size:12px" onclick="document.getElementById('fs-last_verified_at').value=new Date().toISOString().slice(0,10)">今天</button>
                    </div>
                </div>
            </div>

            <!-- Packaging / ABF -->
            <div class="edit-section">
                <div class="edit-section-title">封裝與 ABF</div>
                <div class="form-group"><label>封裝類型</label>
                    <input id="fs-package_type" value="${esc(s.package_type || '')}" list="package-type-options" placeholder="CoWoS-L">
                    <datalist id="package-type-options"><option value="CoWoS-L"><option value="CoWoS-S"><option value="EMIB"><option value="2.5D"><option value="3D"><option value="flip-chip"></datalist>
                </div>
                <div class="form-group"><label>CoWoS 需求</label>
                    <select id="fs-cowos_required">
                        <option value="false" ${!s.cowos_required ? 'selected' : ''}>否</option>
                        <option value="true" ${s.cowos_required ? 'selected' : ''}>是</option>
                    </select>
                </div>
                <div class="form-group"><label>ABF 尺寸</label><input id="fs-abf_size" value="${esc(s.abf_size || '')}" placeholder="77mm x 77mm"></div>
                <div class="form-group"><label>ABF 層數</label><input id="fs-abf_layers" type="number" value="${s.abf_layers ?? ''}" placeholder="16"></div>
                <div class="form-group"><label>HBM</label>
                    <input id="fs-hbm" value="${esc(s.hbm || '')}" list="hbm-options" placeholder="HBM3">
                    <datalist id="hbm-options"><option value="HBM3"><option value="HBM3E"><option value="HBM4"></datalist>
                </div>
                <div class="form-group"><label>預期出貨量</label>
                    <select id="fs-expected_volume">
                        <option value="" ${!s.expected_volume ? 'selected' : ''}>—</option>
                        <option value="low" ${s.expected_volume === 'low' ? 'selected' : ''}>低</option>
                        <option value="medium" ${s.expected_volume === 'medium' ? 'selected' : ''}>中</option>
                        <option value="high" ${s.expected_volume === 'high' ? 'selected' : ''}>高</option>
                    </select>
                </div>
            </div>

            <!-- Metadata Full Width -->
            <div class="edit-section edit-section-full">
                <div class="edit-section-title">元數據與來源</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div class="form-group"><label>影響範圍</label><input id="fs-impact_scope" value="${esc((s.impact_scope || []).join(', '))}"></div>
                    <div class="form-group"><label>標籤</label><input id="fs-tags" value="${esc((s.tags || []).join(', '))}"></div>
                </div>
                <div class="form-group"><label>備註</label><textarea id="fs-notes" rows="2">${esc(s.notes || '')}</textarea></div>
                <div class="form-group"><label>來源 URL（每行一個）</label>
                    <textarea id="fs-sources" rows="2" placeholder="https://..." style="font-family:monospace;font-size:12px">${esc((s.sources || []).map(src => src.url || '').filter(Boolean).join('\n'))}</textarea>
                </div>
            </div>
        </div>`;
}

function collectSignalForm() {
    const confidenceRaw = document.getElementById('fs-confidence_score').value.trim();
    const confidence = Number(confidenceRaw);
    if (isNaN(confidence) || confidence < 0 || confidence > 100) {
        showToast('信度必須介於 0 到 100', 'error');
        return null;
    }

    const stage = document.getElementById('fs-stage').value;
    if (!STAGE_OPTIONS.includes(stage)) {
        showToast('階段值無效', 'error');
        return null;
    }

    const status = document.getElementById('fs-status').value;
    if (!STATUS_OPTIONS.includes(status)) {
        showToast('狀態值無效', 'error');
        return null;
    }

    const abf_layers_raw = document.getElementById('fs-abf_layers').value.trim();
    let abf_layers = null;
    if (abf_layers_raw) {
        abf_layers = Number(abf_layers_raw);
        if (isNaN(abf_layers)) {
            showToast('ABF 層數必須為數字', 'error');
            return null;
        }
    }

    const sourcesRaw = document.getElementById('fs-sources').value.trim();
    const sources = sourcesRaw
        ? sourcesRaw.split('\n').map(line => line.trim()).filter(Boolean).map(url => ({ type: 'link', label: '', url }))
        : [];

    return {
        title: document.getElementById('fs-title').value.trim(),
        company_id: document.getElementById('fs-company_id').value.trim(),
        company_name: document.getElementById('fs-company_name').value.trim(),
        chip_name: normalizeChipName(document.getElementById('fs-chip_name').value),
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
        // Lifecycle metadata
        confidence_reason: document.getElementById('fs-confidence_reason').value.trim(),
        verification_note: document.getElementById('fs-verification_note').value.trim(),
        last_verified_by: document.getElementById('fs-last_verified_by').value.trim(),
    };
}

function initSignalFormEvents() {
    const idSelect = document.getElementById('fs-company_id');
    const nameInput = document.getElementById('fs-company_name');
    if (!idSelect || !nameInput) return;
    
    idSelect.addEventListener('change', () => {
        const company = companiesData.find(c => c.id === idSelect.value);
        if (company) {
            nameInput.value = company.name_cn || company.name_en;
        } else {
            nameInput.value = '';
        }
    });
}

function openNewSignalModal() {
    openModal('新增信號', buildSignalForm({}), async () => {
        const data = collectSignalForm();
        if (!data) throw new Error('__SILENT__');
        if (!data.title || !data.company_id || !data.company_name || !data.chip_name || !data.region) {
            showToast('必填欄位未填寫（標題 / 公司 ID / 公司名稱 / 芯片名稱 / 地區）', 'error');
            return;
        }
        // Default last_verified_by to current user
        if (!data.last_verified_by) data.last_verified_by = auth.currentUser?.email || '';
        const actor = auth.currentUser?.email || '';
        await createSignal(data, actor);
        await fetchSignals();
        const refreshed = signalsData.find(s => s.title === data.title && s.company_id === data.company_id);
        const placement = refreshed ? describeSignalPlacement(refreshed, qualityQueue) : null;
        if (placement) {
            showToast(`已建立，${placement.message}`, 'success', 4000);
        } else {
            showToast('已建立 ✓');
        }
        renderSignalsTab();
    });
    initSignalFormEvents();
}

function openEditSignalModal(id) {
    const signal = signalsData.find(s => s.id === id);
    if (!signal) return;
    openModal('編輯：' + signal.title, buildSignalForm(signal), async () => {
        const data = collectSignalForm();
        if (!data) throw new Error('__SILENT__');
        // Default last_verified_by to current user if blank
        if (!data.last_verified_by) data.last_verified_by = auth.currentUser?.email || '';
        const actor = auth.currentUser?.email || '';
        await saveSignal(id, data, {
            actor,
            previousStatus: signal.status,
            previousConfidence: signal.confidence_score,
        });
        await fetchSignals();
        const refreshed = signalsData.find(s => s.id === id);
        const placement = refreshed ? describeSignalPlacement(refreshed, qualityQueue) : null;
        if (placement) {
            showToast(`已儲存，${placement.message}`, 'success', 4000);
        } else {
            showToast('已儲存 ✓');
        }
        renderSignalsTab();
    }, 'signal-edit');
    initSignalFormEvents();

    // Phase 4: Append lightweight history context (read-only)
    renderAdminSignalHistory(id);
}

async function renderAdminSignalHistory(signalId) {
    const history = await loadSignalHistory(signalId, 10);
    if (!history || history.length === 0) return;

    // Append a read-only history summary to the modal body
    const modalBody = document.querySelector('.modal-body');
    if (!modalBody) return;

    const historyHtml = `
        <div class="admin-history-section">
            <h4 class="admin-history-title">最近變更記錄（最近 ${history.length} 筆）</h4>
            <div class="admin-history-list">
                ${history.map(h => {
                    const ts = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp || 0);
                    const dateStr = ts.toISOString().slice(0, 10);
                    const timeStr = ts.toISOString().slice(11, 16);
                    const actionLabel = HISTORY_ACTION_LABELS[h.action] || h.action || '更新';
                    const actorStr = h.actor ? esc(h.actor) : '—';
                    const summaryStr = h.summary ? esc(h.summary) : '';
                    return `<div class="admin-history-item">
                        <span class="admin-history-badge">${esc(actionLabel)}</span>
                        <span class="admin-history-time">${esc(dateStr)} ${esc(timeStr)}</span>
                        ${summaryStr ? `<span class="admin-history-summary">${summaryStr}</span>` : ''}
                        <span class="admin-history-actor">${actorStr}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;

    modalBody.insertAdjacentHTML('beforeend', historyHtml);
}

async function deleteSignalAction(id) {
    const signal = signalsData.find(s => s.id === id);
    if (!signal) return;
    const isArchived = signal.archived || signal.status === 'archived';
    if (isArchived) {
        showToast('此信號已封存', 'error');
        return;
    }
    openModal('封存信號：' + signal.title, `
        <div class="dq-review-form">
            <div class="dq-review-signal">
                <strong>${esc(signal.title)}</strong>
                <div style="margin-top:4px">${esc(signal.company_name)} / ${esc(signal.chip_name)}</div>
            </div>
            <div class="dq-field">
                <label>封存原因（可選）</label>
                <textarea id="archive-reason" rows="3" placeholder="說明封存此信號的原因..."></textarea>
            </div>
        </div>
        <style>
            .dq-review-form .dq-field { margin-bottom: 10px; }
            .dq-review-form label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px; color: var(--text-muted); }
            .dq-review-form textarea {
                width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px;
                font-size: 13px; font-family: inherit; background: var(--bg); color: var(--text);
            }
            .dq-review-signal { margin-bottom: 12px; padding: 8px; background: #f5f5f5; border-radius: 4px; }
        </style>
    `, async () => {
        const reason = document.getElementById('archive-reason').value.trim();
        await archiveSignal(id, {
            actor: auth.currentUser?.email || 'admin',
            reason: reason || '',
        });
        showToast('已封存');
        await fetchSignals();
        renderSignalsTab();
    }, false);
}

// ===== DASHBOARD TAB (今日待辦) =====

function renderDashboardTab() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 新信號: draft AND (ai_generated OR createdAt within 7 days)
    const newSignals = signalsData.filter(s => {
        if (s.status !== 'draft') return false;
        if (s.ai_generated) return true;
        if (s.createdAt) {
            const created = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
            return created >= sevenDaysAgo;
        }
        return false;
    });

    // 待驗證: watch AND evidence_summary non-empty AND confidence_score >= 50
    const pendingVerify = signalsData.filter(s =>
        s.status === 'watch' && s.evidence_summary && s.confidence_score >= 50
    );

    // 資料修補: reuse qualityQueue.length
    const dqCount = qualityQueue.length;

    // 陳舊草稿: draft older than 30 days with no status change
    const staleDrafts = signalsData.filter(s => {
        if (s.status !== 'draft') return false;
        const changedAt = s.last_status_changed_at ? new Date(s.last_status_changed_at) : null;
        const createdAt = s.createdAt ? (s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt)) : null;
        const refDate = changedAt || createdAt;
        return refDate && refDate < thirtyDaysAgo;
    });

    document.getElementById('dashboard-content').innerHTML = `
        <div class="toolbar">
            <h2>今日待辦</h2>
        </div>
        <div class="dashboard-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:16px">
            <div class="dashboard-card" data-action="dash-nav" data-target="inbox" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:24px;cursor:pointer;text-align:center;transition:box-shadow 0.2s" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
                <div style="font-size:36px;font-weight:700;color:var(--primary)">${newSignals.length}</div>
                <div style="font-size:14px;color:var(--text-muted);margin-top:4px">新信號</div>
                <div style="font-size:11px;color:#888;margin-top:8px">草稿 AI 或 7 天內建立</div>
            </div>
            <div class="dashboard-card" data-action="dash-nav" data-target="review" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:24px;cursor:pointer;text-align:center;transition:box-shadow 0.2s" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
                <div style="font-size:36px;font-weight:700;color:var(--warning)">${pendingVerify.length}</div>
                <div style="font-size:14px;color:var(--text-muted);margin-top:4px">待驗證</div>
                <div style="font-size:11px;color:#888;margin-top:8px">觀察中 信度≥50 有證據</div>
            </div>
            <div class="dashboard-card" data-action="dash-nav" data-target="data-quality" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:24px;cursor:pointer;text-align:center;transition:box-shadow 0.2s" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
                <div style="font-size:36px;font-weight:700;color:var(--danger)">${dqCount}</div>
                <div style="font-size:14px;color:var(--text-muted);margin-top:4px">資料修補</div>
                <div style="font-size:11px;color:#888;margin-top:8px">數據品質問題項</div>
            </div>
            <div class="dashboard-card" data-action="dash-nav" data-target="signals" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:24px;cursor:pointer;text-align:center;transition:box-shadow 0.2s" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
                <div style="font-size:36px;font-weight:700;color:#888">${staleDrafts.length}</div>
                <div style="font-size:14px;color:var(--text-muted);margin-top:4px">陳舊草稿</div>
                <div style="font-size:11px;color:#888;margin-top:8px">草稿超過 30 天未變更</div>
            </div>
        </div>`;
}

// ===== INBOX TAB (新信號) =====

function renderInboxTab() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const inboxItems = signalsData.filter(s => {
        if (s.status !== 'draft') return false;
        // Include if never reviewed (last_reviewed_at is null) OR last reviewed > 30 days ago
        const lastReviewed = s.last_reviewed_at ? new Date(s.last_reviewed_at) : null;
        if (!lastReviewed) return true; // truly fresh, never reviewed
        return lastReviewed < thirtyDaysAgo; // re-review queue
    });

    const rows = inboxItems.map(s => {
        const source = s.ai_generated ? '<span class="badge badge-gray">AI</span>' : (s.source_type === 'imported' ? '<span class="badge badge-gray">匯入</span>' : '<span class="badge badge-gray">人工</span>');
        const created = s.createdAt ? new Date(s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt)).toISOString().slice(0, 10) : '—';
        return `<tr>
            <td>${esc(s.company_name)}</td>
            <td>${esc(s.chip_name)}</td>
            <td>${esc(s.title)}${source}</td>
            <td>${s.confidence_score}</td>
            <td>${created}</td>
            <td class="td-actions">
                <button class="btn-sm btn-primary" data-action="inbox-adopt" data-id="${esc(s.id)}">採用為草稿</button>
                <button class="btn-sm" data-action="inbox-promote" data-id="${esc(s.id)}">升級為觀察中</button>
                <button class="btn-sm btn-danger" data-action="inbox-reject" data-id="${esc(s.id)}">拒絕</button>
                <button class="btn-sm btn-secondary" data-action="inbox-edit" data-id="${esc(s.id)}">編輯詳情</button>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('inbox-content').innerHTML = `
        <div class="toolbar">
            <h2>新信號 (${inboxItems.length})</h2>
        </div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>公司</th><th>芯片</th><th>標題</th><th>信度</th><th>建立日期</th><th>操作</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="6" style="color:#888;text-align:center">尚無新信號</td></tr>'}</tbody>
            </table>
        </div>`;
}

// ===== REVIEW TAB (待驗證) =====

function renderReviewTab() {
    const reviewItems = signalsData.filter(s =>
        s.status === 'watch' && s.evidence_summary && s.confidence_score >= 50
    );

    const rows = reviewItems.map(s => {
        const verified = s.last_verified_at ? new Date(s.last_verified_at).toISOString().slice(0, 10) : '—';
        const updated = s.updatedAt ? new Date(s.updatedAt).toISOString().slice(0, 16).replace('T', ' ') : '—';
        return `<tr>
            <td>${esc(s.company_name)}</td>
            <td>${esc(s.chip_name)}</td>
            <td>${esc(s.title)}</td>
            <td><span class="badge badge-yellow">${statusLabel(s.status)}</span></td>
            <td>${s.confidence_score}</td>
            <td>${esc(s.evidence_summary.slice(0, 50))}${s.evidence_summary.length > 50 ? '...' : ''}</td>
            <td>${verified}<br><small style="color:#888">${updated}</small></td>
            <td class="td-actions">
                <button class="btn-sm btn-primary" data-action="review-verify" data-id="${esc(s.id)}">驗證</button>
                <button class="btn-sm btn-danger" data-action="review-downgrade" data-id="${esc(s.id)}">降級</button>
                <button class="btn-sm btn-secondary" data-action="review-edit" data-id="${esc(s.id)}">編輯詳情</button>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('review-content').innerHTML = `
        <div class="toolbar">
            <h2>待驗證 (${reviewItems.length})</h2>
        </div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>公司</th><th>芯片</th><th>標題</th><th>狀態</th><th>信度</th><th>證據摘要</th><th>最後驗證</th><th>操作</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="8" style="color:#888;text-align:center">尚無待驗證信號</td></tr>'}</tbody>
            </table>
        </div>`;
}

// ===== ADD DATA TAB (資料輸入) =====

let addDataSubMode = 'manual'; // 'manual' | 'excel' | 'ai'

function renderAddDataTab() {
    document.getElementById('add-data-content').innerHTML = `
        <div class="toolbar">
            <h2>資料輸入</h2>
        </div>
        <div class="segmented-control" style="display:flex;gap:4px;margin:16px 0;background:var(--border);border-radius:6px;padding:4px;width:fit-content">
            <button class="segment-btn ${addDataSubMode === 'manual' ? 'active' : ''}" data-action="add-data-mode" data-mode="manual" style="padding:8px 20px;border:none;border-radius:4px;cursor:pointer;font-size:13px;background:${addDataSubMode === 'manual' ? 'var(--bg)' : 'transparent'};color:${addDataSubMode === 'manual' ? 'var(--text)' : 'var(--text-muted)'}">手動新增</button>
            <button class="segment-btn ${addDataSubMode === 'excel' ? 'active' : ''}" data-action="add-data-mode" data-mode="excel" style="padding:8px 20px;border:none;border-radius:4px;cursor:pointer;font-size:13px;background:${addDataSubMode === 'excel' ? 'var(--bg)' : 'transparent'};color:${addDataSubMode === 'excel' ? 'var(--text)' : 'var(--text-muted)'}">Excel 匯入</button>
            <button class="segment-btn ${addDataSubMode === 'ai' ? 'active' : ''}" data-action="add-data-mode" data-mode="ai" style="padding:8px 20px;border:none;border-radius:4px;cursor:pointer;font-size:13px;background:${addDataSubMode === 'ai' ? 'var(--bg)' : 'transparent'};color:${addDataSubMode === 'ai' ? 'var(--text)' : 'var(--text-muted)'}">AI 抽取</button>
        </div>
        <div id="add-data-sub-content"></div>`;

    renderAddDataSubContent();
}

function renderAddDataSubContent() {
    const container = document.getElementById('add-data-sub-content');
    if (!container) return;

    if (addDataSubMode === 'manual') {
        container.innerHTML = `
            <div style="padding:16px">
                <button class="btn-primary" data-action="add-data-new-signal" style="width:auto;padding:8px 16px">+ 新增信號</button>
                <p style="color:var(--text-muted);font-size:13px;margin-top:12px">點擊上方按鈕手動新增一筆信號記錄</p>
            </div>`;
    } else if (addDataSubMode === 'excel') {
        // Reuse existing import tab content by rendering into a temp div
        renderImportTab();
        // The import content goes into import-content, we need to copy it
        const importContent = document.getElementById('import-content');
        if (importContent) {
            container.innerHTML = importContent.innerHTML;
            // Re-bind import events
            document.getElementById('import-download-template')?.addEventListener('click', () => {
                downloadTemplate();
            });
            document.getElementById('import-file-input')?.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                await handleImportFile(file);
            });
            document.getElementById('import-confirm-btn')?.addEventListener('click', async () => {
                await handleConfirmImport();
            });
        }
    } else if (addDataSubMode === 'ai') {
        // Reuse existing AI extract content
        renderAiExtractTab();
        const aiContent = document.getElementById('ai-extract-content');
        if (aiContent) {
            container.innerHTML = aiContent.innerHTML;
            // Re-bind AI extract events
            bindAiExtractEvents();
        }
    }
}

function bindAiExtractEvents() {
    document.getElementById('ai-save-settings')?.addEventListener('click', () => {
        aiExtractSettings = {
            apiKey: document.getElementById('ai-api-key').value.trim(),
            baseUrl: document.getElementById('ai-base-url').value.trim(),
            model: document.getElementById('ai-model').value.trim(),
        };
        saveAiSettings(aiExtractSettings);
        showToast('設定已儲存');
    });

    document.getElementById('ai-test-connection')?.addEventListener('click', async () => {
        const statusEl = document.getElementById('ai-connection-status');
        statusEl.textContent = '測試中...';
        statusEl.style.color = 'var(--text-muted)';
        try {
            const settings = {
                apiKey: document.getElementById('ai-api-key').value.trim(),
                baseUrl: document.getElementById('ai-base-url').value.trim(),
                model: document.getElementById('ai-model').value.trim(),
            };
            const result = await testDeepSeekConnection(settings);
            statusEl.textContent = `✓ 連線成功 (${result.model})`;
            statusEl.style.color = 'var(--success)';
        } catch (err) {
            statusEl.textContent = `✗ ${err.message}`;
            statusEl.style.color = 'var(--danger)';
        }
    });

    document.getElementById('ai-save-prompt')?.addEventListener('click', () => {
        saveExtractionPrompt(document.getElementById('ai-prompt').value);
        showToast('提示詞已儲存');
    });

    document.getElementById('ai-reset-prompt')?.addEventListener('click', () => {
        document.getElementById('ai-prompt').value = resetExtractionPrompt();
        showToast('提示詞已恢復預設');
    });

    document.getElementById('ai-extract-btn')?.addEventListener('click', async () => {
        await handleAiExtract();
    });

    document.getElementById('ai-confirm-import')?.addEventListener('click', async () => {
        await handleAiConfirmImport();
    });

    document.getElementById('ai-clear-candidates')?.addEventListener('click', () => {
        aiExtractCandidates = [];
        document.getElementById('ai-candidates-section').style.display = 'none';
        document.getElementById('ai-result-section').style.display = 'none';
    });

    document.getElementById('ai-candidates-table')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-action="edit-ai-candidate"]');
        if (!btn) return;
        const rowNum = Number(btn.dataset.row);
        openEditAiCandidateModal(rowNum);
    });
}

// ===== IMPORT TAB =====
function renderImportTab() {
    document.getElementById('import-content').innerHTML = `
        <div class="import-workflow">
            <h2>Signals Excel Import (Upsert)</h2>
            <div class="import-step">
                <h3>1. 下載模板</h3>
                <button class="btn-sm" id="import-download-template">下載 Signals Excel 模板</button>
            </div>
            <div class="import-step">
                <h3>2. 上傳 Excel</h3>
                <input type="file" id="import-file-input" accept=".xlsx,.xls" style="margin-top:8px">
            </div>
            <div id="import-preview" style="display:none">
                <h3>3. 預覽</h3>
                <div id="import-summary" class="import-summary"></div>
                <div id="import-table-wrap" class="import-table-wrap"></div>
                <button class="btn-primary" id="import-confirm-btn" disabled style="margin-top:16px">確認匯入</button>
            </div>
            <div id="import-result" style="display:none">
                <h3>匯入結果</h3>
                <div id="import-result-summary"></div>
            </div>
        </div>
    `;

    document.getElementById('import-download-template').addEventListener('click', () => {
        downloadTemplate();
    });

    document.getElementById('import-file-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await handleImportFile(file);
    });

    document.getElementById('import-confirm-btn').addEventListener('click', async () => {
        await handleConfirmImport();
    });
}

let importParsedRows = [];

async function handleImportFile(file) {
    try {
        const rawRows = await parseExcelFile(file);
        importParsedRows = rawRows.map((row, idx) => {
            const validated = validateRow(row, signalsData);
            const classified = classifyImportRow(validated, signalsData);
            return { rowNumber: idx + 1, ...classified };
        });
        renderImportPreview();
    } catch (err) {
        console.error('Import parse error:', err);
        alert('檔案解析失敗：' + err.message);
    }
}

function renderImportPreview() {
    const preview = document.getElementById('import-preview');
    const summary = document.getElementById('import-summary');
    const tableWrap = document.getElementById('import-table-wrap');
    const confirmBtn = document.getElementById('import-confirm-btn');

    preview.style.display = 'block';
    document.getElementById('import-result').style.display = 'none';

    const counts = { create: 0, update: 0, skip: 0, error: 0 };
    for (const r of importParsedRows) {
        if (r.action === 'error') counts.error++;
        else if (r.action === 'skip') counts.skip++;
        else if (r.action === 'update') counts.update++;
        else counts.create++;
    }

    summary.innerHTML = `
        <span class="badge badge-green">${counts.create} create</span>&nbsp;
        <span class="badge badge-blue">${counts.update} update</span>&nbsp;
        <span class="badge badge-gray">${counts.skip} skip</span>&nbsp;
        <span class="badge badge-red">${counts.error} error</span>&nbsp;
        <span style="margin-left:8px">共 ${importParsedRows.length} 筆</span>
    `;

    const actionable = importParsedRows.filter(r => r.action === 'create' || r.action === 'update');
    confirmBtn.disabled = actionable.length === 0;

    const actionLabels = { create: '建立', update: '更新', skip: '跳過', error: '錯誤' };
    const actionClasses = { create: 'badge-green', update: 'badge-blue', skip: 'badge-gray', error: 'badge-red' };

    const rows = importParsedRows.map(r => {
        const d = r.data;
        const changedInfo = r.changedFields && r.changedFields.length > 0
            ? `${r.changedFields.length} 欄位` : '';
        return `<tr class="import-row-${r.action}">
            <td>${r.rowNumber}</td>
            <td><span class="badge ${actionClasses[r.action]}">${actionLabels[r.action]}</span></td>
            <td class="td-truncate" title="${esc(d.title)}">${esc(d.title?.slice(0, 30) || '')}</td>
            <td>${esc(d.company_name)}</td>
            <td>${esc(d.chip_name)}</td>
            <td>${esc(STAGE_LABEL[d.stage] || d.stage)}</td>
            <td>${esc(STATUS_LABEL[d.status] || d.status)}</td>
            <td>${esc(IMPACT_LABEL[d.abf_demand_impact] || d.abf_demand_impact)}</td>
            <td class="td-truncate">${esc(changedInfo || r.issues.slice(0, 1).join('; ') || '')}</td>
        </tr>`;
    }).join('');

    tableWrap.innerHTML = `
        <table class="import-table">
            <thead>
                <tr>
                    <th>#</th><th>動作</th><th>標題</th><th>公司</th><th>芯片</th>
                    <th>階段</th><th>信號狀態</th><th>ABF 影響</th><th>變更</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

async function handleConfirmImport() {
    const actionable = importParsedRows.filter(r => r.action === 'create' || r.action === 'update');
    if (actionable.length === 0) return;

    const actor = auth.currentUser?.email || 'bulk-import';
    const results = await importSignals(importParsedRows, actor);
    await logImportBatch(actor, results);

    const resultDiv = document.getElementById('import-result');
    const resultSummary = document.getElementById('import-result-summary');
    resultDiv.style.display = 'block';
    resultSummary.innerHTML = `
        <p>匯入完成：${results.created} 建立 / ${results.updated} 更新 / ${results.skipped} 跳過 / ${results.errors} 錯誤</p>
    `;

    await fetchSignals();
    buildQualityQueueFromData();
    renderDataQualityTab();
    renderSignalsTab();
    importParsedRows = [];
    document.getElementById('import-confirm-btn').disabled = true;

    showToast(`匯入完成：${results.created} 建立 / ${results.updated} 更新`);
}

// ===== AI EXTRACT TAB =====
let aiExtractSettings = loadAiSettings();
let aiExtractCandidates = [];

function renderAiExtractTab() {
    aiExtractSettings = loadAiSettings();
    const prompt = loadExtractionPrompt();
    const hasApiKey = !!aiExtractSettings.apiKey;

    document.getElementById('ai-extract-content').innerHTML = `
        <div class="ai-extract-workflow">
            <h2>AI 情報抽取</h2>

            <!-- Workflow Steps -->
            <div class="ai-workflow-steps">
                <div class="ai-workflow-step ${hasApiKey ? 'done' : 'active'}">1. 設定</div>
                <div class="ai-workflow-step">2. 提示詞</div>
                <div class="ai-workflow-step active">3. 情報來源</div>
                <div class="ai-workflow-step">4. 候選預覽</div>
                <div class="ai-workflow-step">5. 匯入</div>
            </div>

            <!-- Settings (collapsible) -->
            <div class="ai-section-collapsible">
                <button class="ai-collapsible-header ${hasApiKey ? 'collapsed' : ''}" data-ai-collapse="settings">
                    <span>${hasApiKey ? '✓ DeepSeek 設定已配置' : 'DeepSeek 設定'}</span>
                    <span class="collapse-icon">▼</span>
                </button>
                <div class="ai-collapsible-body ${hasApiKey ? 'hidden' : ''}" data-ai-collapse-body="settings">
                    <div class="ai-form-row">
                        <div class="ai-field">
                            <label>API Key</label>
                            <input type="password" id="ai-api-key" value="${esc(aiExtractSettings.apiKey)}" placeholder="sk-...">
                        </div>
                        <div class="ai-field">
                            <label>Base URL</label>
                            <input type="text" id="ai-base-url" value="${esc(aiExtractSettings.baseUrl)}" placeholder="https://api.deepseek.com">
                        </div>
                        <div class="ai-field">
                            <label>Model</label>
                            <input type="text" id="ai-model" value="${esc(aiExtractSettings.model)}" placeholder="deepseek-v4-flash">
                        </div>
                    </div>
                    <div class="ai-actions">
                        <button class="btn-sm" id="ai-save-settings">儲存設定</button>
                        <button class="btn-sm btn-secondary" id="ai-test-connection">測試連線</button>
                        <span id="ai-connection-status" style="margin-left:8px;font-size:12px"></span>
                    </div>
                    <div class="ai-warning">API key 僅儲存在此瀏覽器的 localStorage 中。</div>
                </div>
            </div>

            <!-- Prompt (collapsible) -->
            <div class="ai-section-collapsible">
                <button class="ai-collapsible-header collapsed" data-ai-collapse="prompt">
                    <span>抽取提示詞</span>
                    <span class="collapse-icon">▼</span>
                </button>
                <div class="ai-collapsible-body hidden" data-ai-collapse-body="prompt">
                    <textarea id="ai-prompt" rows="10" style="font-family:monospace;font-size:12px;width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:10px">${esc(prompt)}</textarea>
                    <div class="ai-actions" style="margin-top:8px">
                        <button class="btn-sm" id="ai-save-prompt">儲存提示詞</button>
                        <button class="btn-sm btn-secondary" id="ai-reset-prompt">恢復預設</button>
                    </div>
                </div>
            </div>

            <!-- Source Input (primary) -->
            <div class="ai-source-primary">
                <h3 style="font-size:14px;margin-bottom:12px">情報來源輸入</h3>
                <textarea id="ai-source-text" rows="8" placeholder="貼上原始情報文字，或拖放文件到下方區域..." style="width:100%"></textarea>
                
                <!-- Drag & Drop Zone -->
                <div class="ai-drop-zone" id="ai-drop-zone">
                    <div class="drop-label">
                        <strong>拖放文件至此</strong> 或點擊上傳<br>
                        <small style="color:#888">支持 .png .jpg .jpeg .webp .txt .md</small>
                    </div>
                    <input type="file" id="ai-file-input" accept=".png,.jpg,.jpeg,.webp,.txt,.md" style="display:none">
                    <div id="ai-file-preview" class="file-preview" style="display:none"></div>
                </div>

                <div class="ai-actions" style="margin-top:12px">
                    <button class="btn-primary" id="ai-extract-btn" style="width:auto;padding:10px 24px">抽取信號</button>
                </div>
                <div id="ai-extract-status" style="margin-top:8px"></div>
            </div>

            <!-- Candidates -->
            <div id="ai-candidates-section" style="display:none">
                <div class="ai-section" style="margin-top:16px">
                    <h3>候選信號</h3>
                    <div id="ai-candidates-summary" class="import-summary"></div>
                    <div id="ai-candidates-table" class="import-table-wrap"></div>
                    <div class="ai-actions" style="margin-top:12px">
                        <button class="btn-primary" id="ai-confirm-import" disabled style="width:auto">確認匯入</button>
                        <button class="btn-sm btn-secondary" id="ai-clear-candidates">清除候選</button>
                    </div>
                </div>
            </div>

            <!-- Result -->
            <div id="ai-result-section" style="display:none">
                <div class="ai-section" style="margin-top:16px">
                    <h3>匯入結果</h3>
                    <div id="ai-result-summary"></div>
                </div>
            </div>
        </div>
    `;

    // Bind collapsible headers
    document.querySelectorAll('[data-ai-collapse]').forEach(header => {
        header.addEventListener('click', () => {
            const key = header.dataset.aiCollapse;
            const body = document.querySelector(`[data-ai-collapse-body="${key}"]`);
            header.classList.toggle('collapsed');
            body.classList.toggle('hidden');
        });
    });

    // Bind drop zone
    setupAiDropZone();

    // Bind all existing AI buttons (settings, prompt, extract, import, clear)
    document.getElementById('ai-save-settings')?.addEventListener('click', () => {
        aiExtractSettings = {
            apiKey: document.getElementById('ai-api-key').value.trim(),
            baseUrl: document.getElementById('ai-base-url').value.trim(),
            model: document.getElementById('ai-model').value.trim(),
        };
        saveAiSettings(aiExtractSettings);
        showToast('設定已儲存');
        renderAiExtractTab();
    });

    document.getElementById('ai-test-connection')?.addEventListener('click', async () => {
        const statusEl = document.getElementById('ai-connection-status');
        statusEl.textContent = '測試中...';
        statusEl.style.color = 'var(--text-muted)';
        try {
            const settings = {
                apiKey: document.getElementById('ai-api-key').value.trim(),
                baseUrl: document.getElementById('ai-base-url').value.trim(),
                model: document.getElementById('ai-model').value.trim(),
            };
            const result = await testDeepSeekConnection(settings);
            statusEl.textContent = `✓ 連線成功 (${result.model})`;
            statusEl.style.color = 'var(--success)';
        } catch (err) {
            statusEl.textContent = `✗ ${err.message}`;
            statusEl.style.color = 'var(--danger)';
        }
    });

    document.getElementById('ai-save-prompt')?.addEventListener('click', () => {
        saveExtractionPrompt(document.getElementById('ai-prompt').value);
        showToast('提示詞已儲存');
    });

    document.getElementById('ai-reset-prompt')?.addEventListener('click', () => {
        document.getElementById('ai-prompt').value = resetExtractionPrompt();
        showToast('提示詞已恢復預設');
    });

    document.getElementById('ai-extract-btn')?.addEventListener('click', async () => {
        await handleAiExtract();
    });

    document.getElementById('ai-confirm-import')?.addEventListener('click', async () => {
        await handleAiConfirmImport();
    });

    document.getElementById('ai-clear-candidates')?.addEventListener('click', () => {
        aiExtractCandidates = [];
        document.getElementById('ai-candidates-section').style.display = 'none';
        document.getElementById('ai-result-section').style.display = 'none';
    });

    document.getElementById('ai-candidates-table')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-action="edit-ai-candidate"]');
        if (!btn) return;
        const rowNum = Number(btn.dataset.row);
        openEditAiCandidateModal(rowNum);
    });
}

let aiImageFile = null;

function setupAiDropZone() {
    const dropZone = document.getElementById('ai-drop-zone');
    const fileInput = document.getElementById('ai-file-input');
    const filePreview = document.getElementById('ai-file-preview');
    if (!dropZone || !fileInput) return;

    // Click to open file picker
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag events
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleAiFile(files[0]);
    });

    // File input change
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) handleAiFile(fileInput.files[0]);
    });
}

function handleAiFile(file) {
    const filePreview = document.getElementById('ai-file-preview');
    const sourceText = document.getElementById('ai-source-text');
    if (!filePreview) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const imageExts = ['png', 'jpg', 'jpeg', 'webp'];
    const textExts = ['txt', 'md'];

    if (imageExts.includes(ext)) {
        aiImageFile = file;
        filePreview.style.display = 'block';
        filePreview.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB) — 圖片將在抽取時發送`;
    } else if (textExts.includes(ext)) {
        const reader = new FileReader();
        reader.onload = () => {
            if (sourceText) {
                sourceText.value = (sourceText.value ? sourceText.value + '\n\n' : '') + reader.result;
            }
            filePreview.style.display = 'block';
            filePreview.textContent = `📎 ${file.name} — 文字已插入來源區域`;
        };
        reader.readAsText(file);
    } else {
        filePreview.style.display = 'block';
        filePreview.textContent = `⚠ 不支持的文件類型: .${ext}`;
        filePreview.style.color = 'var(--danger)';
    }
}

async function handleAiExtract() {
    const sourceText = document.getElementById('ai-source-text').value.trim();

    // Read image if set via drop zone
    let imageDataUrl = null;
    if (aiImageFile) {
        imageDataUrl = await readFileAsDataURL(aiImageFile);
    }

    if (!sourceText && !imageDataUrl) {
        showToast('請輸入文字或上傳圖片', 'error');
        return;
    }

    const btn = document.getElementById('ai-extract-btn');
    btn.disabled = true;
    btn.textContent = '抽取中...';

    try {
        const prompt = document.getElementById('ai-prompt').value;
        const rawText = await extractSignalsWithDeepSeek({
            settings: aiExtractSettings,
            prompt,
            sourceText,
            imageDataUrl,
        });

        // Parse JSON
        const payload = parseModelJson(rawText);

        // Normalize candidates
        const candidates = normalizeAiCandidates(payload, aiExtractSettings);

        if (candidates.length === 0) {
            showToast('模型未回傳任何信號', 'error');
            return;
        }

        // Classify using Phase 13 helpers
        aiExtractCandidates = classifyAiCandidates(candidates, signalsData, companiesData);

        renderAiCandidates();
    } catch (err) {
        console.error('AI extract error:', err);
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '抽取信號';
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function renderAiCandidates() {
    const section = document.getElementById('ai-candidates-section');
    const summary = document.getElementById('ai-candidates-summary');
    const tableWrap = document.getElementById('ai-candidates-table');
    const confirmBtn = document.getElementById('ai-confirm-import');

    section.style.display = 'block';
    document.getElementById('ai-result-section').style.display = 'none';

    const counts = { create: 0, update: 0, skip: 0, error: 0 };
    for (const r of aiExtractCandidates) {
        if (r.action === 'error') counts.error++;
        else if (r.action === 'skip') counts.skip++;
        else if (r.action === 'update') counts.update++;
        else counts.create++;
    }

    summary.innerHTML = `
        <span class="badge badge-green">${counts.create} create</span>&nbsp;
        <span class="badge badge-blue">${counts.update} update</span>&nbsp;
        <span class="badge badge-gray">${counts.skip} skip</span>&nbsp;
        <span class="badge badge-red">${counts.error} error</span>&nbsp;
        <span style="margin-left:8px">共 ${aiExtractCandidates.length} 筆</span>
    `;

    const actionable = aiExtractCandidates.filter(r => r.action === 'create' || r.action === 'update');
    confirmBtn.disabled = actionable.length === 0;

    const actionLabels = { create: '建立', update: '更新', skip: '跳過', error: '錯誤' };
    const actionClasses = { create: 'badge-green', update: 'badge-blue', skip: 'badge-gray', error: 'badge-red' };

    const rows = aiExtractCandidates.map(r => {
        const d = r.data;
        const aiBadge = d.ai_generated ? '<span class="badge badge-gray" style="margin-left:4px;font-size:10px">AI</span>' : '';
        const changedInfo = r.changedFields && r.changedFields.length > 0 ? `${r.changedFields.length} 欄位` : '';
        const issuesText = r.issues.length > 0 ? r.issues.join('; ') : (changedInfo || '—');

        // Low-confidence company match warning
        let companyCell = esc(d.company_name);
        if (d._needsCompanyConfirmation) {
            companyCell = `<span title="低信度公司匹配: &quot;${esc(d._originalCompanyName)}&quot; → &quot;${esc(d._matchedCompanyName)}&quot;。請確認後再匯入。" style="color:var(--warning)">⚠ ${esc(d.company_name)}</span>`;
        }
        return `<tr class="import-row-${r.action}">
            <td>${r.rowNumber}</td>
            <td><span class="badge ${actionClasses[r.action]}">${actionLabels[r.action]}</span></td>
            <td class="td-truncate" title="${esc(d.title)}">${esc(d.title?.slice(0, 25) || '')}${aiBadge}</td>
            <td>${companyCell}</td>
            <td>${esc(d.chip_name)}</td>
            <td>${esc(STAGE_LABEL[d.stage] || d.stage)}</td>
            <td><span class="badge ${statusChipClass(d.status)}">${statusLabel(d.status)}</span></td>
            <td>${d.confidence_score}</td>
            <td>${esc(IMPACT_LABEL[d.abf_demand_impact] || d.abf_demand_impact)}</td>
            <td class="td-truncate" title="${esc(issuesText)}">${esc(issuesText.slice(0, 30))}</td>
            <td><button class="btn-sm btn-secondary" data-action="edit-ai-candidate" data-row="${r.rowNumber}">編輯</button></td>
        </tr>`;
    }).join('');

    tableWrap.innerHTML = `
        <table class="import-table">
            <thead>
                <tr>
                    <th>#</th><th>動作</th><th>標題</th><th>公司</th><th>芯片</th>
                    <th>階段</th><th>狀態</th><th>信度</th><th>ABF</th><th>問題</th><th>操作</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

async function handleAiConfirmImport() {
    const actionable = aiExtractCandidates.filter(r => r.action === 'create' || r.action === 'update');
    if (actionable.length === 0) return;

    const actor = auth.currentUser?.email || 'ai-extract';
    const results = await importSignals(aiExtractCandidates, actor);
    await logImportBatch(actor, results);

    const resultSection = document.getElementById('ai-result-section');
    const resultSummary = document.getElementById('ai-result-summary');
    resultSection.style.display = 'block';
    resultSummary.innerHTML = `
        <p>匯入完成：${results.created} 建立 / ${results.updated} 更新 / ${results.skipped} 跳過 / ${results.errors} 錯誤</p>
    `;

    await fetchSignals();
    buildQualityQueueFromData();
    renderDataQualityTab();
    renderSignalsTab();
    aiExtractCandidates = [];
    document.getElementById('ai-confirm-import').disabled = true;

    showToast(`AI 匯入完成：${results.created} 建立 / ${results.updated} 更新`);
}

// ===== AI CANDIDATE INLINE EDIT =====

function openEditAiCandidateModal(rowNumber) {
    const idx = aiExtractCandidates.findIndex(r => r.rowNumber === rowNumber);
    if (idx === -1) return;
    const candidate = aiExtractCandidates[idx];
    const d = candidate.data;

    // Build company options
    const companyOptions = companiesData.map(c => {
        const selected = c.id === d.company_id ? ' selected' : '';
        return `<option value="${esc(c.id)}"${selected}>${esc(c.name)} (${esc(c.id)})</option>`;
    }).join('');

    const regionOptions = REGION_OPTIONS.map(r => {
        const selected = d.region === r ? ' selected' : '';
        return `<option value="${r}"${selected}>${REGION_LABEL[r]}</option>`;
    }).join('');

    const stageOptions = STAGE_ENUM.map(s => {
        const selected = d.stage === s ? ' selected' : '';
        return `<option value="${s}"${selected}>${STAGE_LABEL[s]}</option>`;
    }).join('');

    // AI candidates: only draft/watch
    const aiStatusOptions = ['draft', 'watch'].map(s => {
        const selected = d.status === s ? ' selected' : '';
        return `<option value="${s}"${selected}>${STATUS_LABEL[s]}</option>`;
    }).join('');

    const impactOptions = IMPACT_ENUM.map(i => {
        const selected = d.abf_demand_impact === i ? ' selected' : '';
        return `<option value="${i}"${selected}>${IMPACT_LABEL[i]}</option>`;
    }).join('');

    const formHtml = `
        <div class="ai-edit-form">
            <div class="form-row">
                <label>標題</label>
                <input id="edit-ai-title" value="${esc(d.title || '')}" />
            </div>
            <div class="form-row">
                <label>公司 ID</label>
                <select id="edit-ai-company-id">
                    <option value="">— 選擇公司 —</option>
                    ${companyOptions}
                </select>
            </div>
            <div class="form-row">
                <label>公司名稱</label>
                <input id="edit-ai-company-name" value="${esc(d.company_name || '')}" readonly style="opacity:0.7" />
            </div>
            <div class="form-row">
                <label>芯片名稱</label>
                <input id="edit-ai-chip-name" value="${esc(d.chip_name || '')}" />
            </div>
            <div class="form-row">
                <label>地區</label>
                <select id="edit-ai-region">${regionOptions}</select>
            </div>
            <div class="form-row">
                <label>階段</label>
                <select id="edit-ai-stage">${stageOptions}</select>
            </div>
            <div class="form-row">
                <label>狀態</label>
                <select id="edit-ai-status">${aiStatusOptions}</select>
            </div>
            <div class="form-row">
                <label>信度 (0-100)</label>
                <input id="edit-ai-confidence" type="number" min="0" max="100" value="${d.confidence_score ?? 0}" />
            </div>
            <div class="form-row">
                <label>ABF 需求影響</label>
                <select id="edit-ai-impact">${impactOptions}</select>
            </div>
            <div class="form-row">
                <label>證據摘要</label>
                <textarea id="edit-ai-evidence" rows="3">${esc(d.evidence_summary || '')}</textarea>
            </div>
            <div class="form-row">
                <label>信度原因</label>
                <textarea id="edit-ai-confidence-reason" rows="2">${esc(d.confidence_reason || '')}</textarea>
            </div>
            <div class="form-row">
                <label>最後驗證時間</label>
                <input id="edit-ai-verified-at" type="date" value="${esc(d.last_verified_at || '')}" />
            </div>
        </div>
        <style>
            .ai-edit-form .form-row { margin-bottom: 10px; }
            .ai-edit-form label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px; color: var(--text-muted); }
            .ai-edit-form input, .ai-edit-form select, .ai-edit-form textarea {
                width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px;
                font-size: 13px; font-family: inherit; background: var(--bg); color: var(--text);
            }
        </style>
    `;

    openModal('編輯 AI 候選信號', formHtml, async () => {
        const title = document.getElementById('edit-ai-title').value.trim();
        const companyId = document.getElementById('edit-ai-company-id').value.trim();
        const companyName = document.getElementById('edit-ai-company-name').value.trim();
        const chipName = document.getElementById('edit-ai-chip-name').value.trim();
        const region = document.getElementById('edit-ai-region').value;
        const stage = document.getElementById('edit-ai-stage').value;
        const status = document.getElementById('edit-ai-status').value;
        const confidenceScore = Number(document.getElementById('edit-ai-confidence').value);
        const abfDemandImpact = document.getElementById('edit-ai-impact').value;
        const evidenceSummary = document.getElementById('edit-ai-evidence').value.trim();
        const confidenceReason = document.getElementById('edit-ai-confidence-reason').value.trim();
        const lastVerifiedAt = document.getElementById('edit-ai-verified-at').value;

        // Rebuild candidate data, preserving AI metadata and optional fields
        const updatedData = {
            ...d,
            title, company_id: companyId, company_name: companyName, chip_name: chipName,
            region, stage, status, confidence_score: confidenceScore,
            abf_demand_impact: abfDemandImpact,
            evidence_summary: evidenceSummary,
            confidence_reason: confidenceReason,
            last_verified_at: lastVerifiedAt,
            ai_generated: true,
            source_type: 'ai_extracted',
        };

        // Re-validate and re-classify
        const validated = validateRow(updatedData, signalsData);
        const reclassified = classifyImportRow(validated, signalsData);

        // Update the candidate in-place, preserving rowNumber
        aiExtractCandidates[idx] = {
            rowNumber,
            ...reclassified,
        };

        renderAiCandidates();
        showToast(`候選信號已重新分類: ${reclassified.action}`);
    }, false);

    // Auto-fill company_name when company_id changes
    document.getElementById('edit-ai-company-id').addEventListener('change', e => {
        const selectedCompany = companiesData.find(c => c.id === e.target.value);
        if (selectedCompany) {
            document.getElementById('edit-ai-company-name').value = selectedCompany.name;
        } else {
            document.getElementById('edit-ai-company-name').value = '';
        }
    });
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

// ===== DATA QUALITY TAB (Phase 5) =====

let dqFilterState = { queueType: '', priority: '', status: '', company: '', highImpact: false, search: '' };
let dqSortMode = 'priority';

function renderDataQualityTab() {
    const summary = getQualitySummary(qualityQueue);
    const total = qualityQueue.length;

    // Build company list for filter
    const companies = [...new Set(signalsData.map(s => s.company_name).filter(Boolean))].sort();

    let html = `
        <div class="toolbar">
            <h2>數據品質 (${total} 項)</h2>
            <button class="btn-sm btn-secondary" data-action="refresh-quality">重新評估</button>
        </div>

        <!-- Summary Strip -->
        <div class="dq-summary-strip">
            ${Object.entries(summary).map(([type, count]) => `
                <div class="dq-summary-block ${dqFilterState.queueType === type ? 'active' : ''}" data-queue="${esc(type)}">
                    <span class="dq-summary-count">${count}</span>
                    <span class="dq-summary-label">${esc(type)}</span>
                </div>
            `).join('')}
            <div class="dq-summary-block ${dqFilterState.queueType === '' ? 'active' : ''}" data-queue="">
                <span class="dq-summary-count">${total}</span>
                <span class="dq-summary-label">全部</span>
            </div>
        </div>

        <!-- Queue Filter Bar -->
        <div class="dq-filter-bar">
            <select id="dq-priority" style="width:auto">
                <option value="">全部優先級</option>
                <option value="高" ${dqFilterState.priority === '高' ? 'selected' : ''}>高</option>
                <option value="中" ${dqFilterState.priority === '中' ? 'selected' : ''}>中</option>
                <option value="低" ${dqFilterState.priority === '低' ? 'selected' : ''}>低</option>
            </select>
            <select id="dq-status" style="width:auto">
                <option value="">全部狀態</option>
                ${STATUS_ENUM.map(v => `<option value="${v}" ${dqFilterState.status === v ? 'selected' : ''}>${statusLabel(v)}</option>`).join('')}
            </select>
            <select id="dq-company" style="width:auto">
                <option value="">全部公司</option>
                ${companies.map(c => `<option ${dqFilterState.company === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
            <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">
                <input type="checkbox" id="dq-high-impact" ${dqFilterState.highImpact ? 'checked' : ''}>
                高影響 only
            </label>
            <input type="text" id="dq-search" placeholder="搜尋..." value="${esc(dqFilterState.search)}" style="width:120px;font-size:12px">
            <select id="dq-sort" style="width:auto">
                <option value="priority" ${dqSortMode === 'priority' ? 'selected' : ''}>Priority</option>
                <option value="recent" ${dqSortMode === 'recent' ? 'selected' : ''}>最近更新</option>
                <option value="oldest" ${dqSortMode === 'oldest' ? 'selected' : ''}>最久未處理</option>
            </select>
            <button class="btn-sm" data-action="dq-apply-filter">套用</button>
            <button class="btn-sm btn-secondary" data-action="dq-reset-filter">重置</button>
        </div>

        <!-- Queue Table -->
        <div class="table-wrap">
            <table>
                <thead><tr>
                    <th>問題類型</th>
                    <th>優先級</th>
                    <th>信號</th>
                    <th>公司 / 芯片</th>
                    <th>問題摘要</th>
                    <th>狀態</th>
                    <th>最後驗證</th>
                    <th>操作</th>
                </tr></thead>
                <tbody id="dq-table-body">
                </tbody>
            </table>
        </div>`;

    document.getElementById('data-quality-content').innerHTML = html;

    // Summary block click
    document.querySelectorAll('.dq-summary-block').forEach(block => {
        block.addEventListener('click', () => {
            dqFilterState.queueType = block.dataset.queue;
            dqFilterState.priority = '';
            dqFilterState.status = '';
            dqFilterState.company = '';
            dqFilterState.highImpact = false;
            dqFilterState.search = '';
            renderDataQualityTab();
        });
    });

    renderDQTable();
}

// DQ filter/action event delegation — bound ONCE outside renderDataQualityTab
// to prevent listener accumulation on repeated renders.
document.getElementById('data-quality-content').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'refresh-quality') {
        buildQualityQueueFromData();
        renderDataQualityTab();
        return;
    }
    if (action === 'dq-apply-filter') applyDQFilters();
    if (action === 'dq-reset-filter') {
        dqFilterState = { queueType: '', priority: '', status: '', company: '', highImpact: false, search: '' };
        dqSortMode = 'priority';
        renderDataQualityTab();
        return;
    }
    if (action === 'dq-quick-fix') openQuickFixModal(btn.dataset.id);
    if (action === 'dq-full-edit') openEditSignalModal(btn.dataset.id);
    if (action === 'dq-mark-reviewed') openMarkReviewedModal(btn.dataset.id);
    if (action === 'dq-complete-verification') openCompleteVerificationModal(btn.dataset.id);
});

// ===== NEW TAB EVENT DELEGATION =====

// Dashboard nav click → switch to target tab
document.getElementById('dashboard-content').addEventListener('click', e => {
    const card = e.target.closest('[data-action="dash-nav"]');
    if (!card) return;
    const targetTab = card.dataset.target;
    const btn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
    if (btn) btn.click();
});

// Inbox actions
document.getElementById('inbox-content').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'inbox-adopt') handleInboxAdopt(id);
    else if (action === 'inbox-promote') handleInboxPromote(id);
    else if (action === 'inbox-reject') handleInboxReject(id);
    else if (action === 'inbox-edit') openEditSignalModal(id);
});

// Review actions
document.getElementById('review-content').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'review-verify') handleReviewVerify(id);
    else if (action === 'review-downgrade') handleReviewDowngrade(id);
    else if (action === 'review-edit') openEditSignalModal(id);
});

// Add Data tab: segmented control + new signal
document.getElementById('add-data-content').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, mode } = btn.dataset;
    if (action === 'add-data-mode') {
        addDataSubMode = mode;
        renderAddDataTab();
    } else if (action === 'add-data-new-signal') {
        openNewSignalModal();
    }
});

// ===== INBOX HANDLERS =====

async function handleInboxAdopt(id) {
    const signal = signalsData.find(s => s.id === id);
    if (!signal) return;
    const actor = auth.currentUser?.email || '';
    await saveSignal(id, {
        ...signal,
        status: 'draft',
        last_reviewed_at: new Date().toISOString(),
    }, {
        actor,
        previousStatus: signal.status,
    });

    // Fetch fresh data and check if item left inbox
    await fetchSignals();
    const refreshed = signalsData.find(s => s.id === id);
    const stillInInbox = refreshed && refreshed.status === 'draft' && !refreshed.last_reviewed_at;

    if (stillInInbox) {
        // Should not happen normally; show placement info
        const placement = refreshed ? describeSignalPlacement(refreshed, qualityQueue) : null;
        showToast(`已採用為草稿，${placement?.message || '已記錄操作'}`, 'success', 4000);
    } else {
        const placement = refreshed ? describeSignalPlacement(refreshed, qualityQueue) : null;
        if (placement && placement.queueType !== '無') {
            showToast(`已採用為草稿，已從新信號待辦移除；仍有數據品質問題：${placement.queueType}`, 'success', 4000);
        } else {
            showToast('已採用為草稿，已從新信號待辦移除；仍可在全部信號中查看', 'success', 4000);
        }
    }
    renderInboxTab();
}

async function handleInboxPromote(id) {
    const signal = signalsData.find(s => s.id === id);
    if (!signal) return;
    const actor = auth.currentUser?.email || '';
    await saveSignal(id, { ...signal, status: 'watch', last_reviewed_at: new Date().toISOString() }, {
        actor,
        previousStatus: signal.status,
    });

    // Fetch fresh data and show placement
    await fetchSignals();
    const refreshed = signalsData.find(s => s.id === id);
    const placement = refreshed ? describeSignalPlacement(refreshed, qualityQueue) : null;
    if (placement && placement.queueType !== '無') {
        showToast(`已升級為觀察中，${placement.message}`, 'success', 4000);
    } else {
        showToast('已升級為觀察中，現在進入「待驗證」', 'success', 4000);
    }
    renderInboxTab();
    renderReviewTab();
}

async function handleInboxReject(id) {
    const signal = signalsData.find(s => s.id === id);
    if (!signal) return;
    openModal('拒絕信號：' + signal.title, `
        <div class="dq-review-form">
            <div class="dq-review-signal">
                <strong>${esc(signal.title)}</strong>
                <div style="margin-top:4px">${esc(signal.company_name)} / ${esc(signal.chip_name)}</div>
            </div>
            <div class="dq-field">
                <label>拒絕原因 <span style="color:var(--danger)">*</span></label>
                <textarea id="inbox-reject-reason" rows="3" placeholder="說明拒絕此信號的原因..."></textarea>
            </div>
        </div>
        <style>
            .dq-review-form .dq-field { margin-bottom: 10px; }
            .dq-review-form label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px; color: var(--text-muted); }
            .dq-review-form textarea {
                width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px;
                font-size: 13px; font-family: inherit; background: var(--bg); color: var(--text);
            }
            .dq-review-signal { margin-bottom: 12px; padding: 8px; background: #f5f5f5; border-radius: 4px; }
        </style>
    `, async () => {
        const reason = document.getElementById('inbox-reject-reason').value.trim();
        if (!reason) throw new Error('請填寫拒絕原因');
        const actor = auth.currentUser?.email || '';
        await saveSignal(id, {
            ...signal,
            status: 'invalidated',
            verification_note: '拒絕原因：' + reason,
            last_reviewed_at: new Date().toISOString(),
        }, {
            actor,
            previousStatus: signal.status,
        });

        // Show transition result
        await fetchSignals();
        const refreshed = signalsData.find(s => s.id === id);
        const placement = refreshed ? describeSignalPlacement(refreshed, qualityQueue) : null;
        showToast(`已拒絕，${placement?.message || '狀態為 invalidated'}`, 'success', 4000);
        renderInboxTab();
    }, false);
}

// ===== REVIEW HANDLERS =====

async function handleReviewVerify(id) {
    const signal = signalsData.find(s => s.id === id);
    if (!signal) return;
    openModal('驗證信號：' + signal.title, `
        <div class="review-explanation">
            <h3>待驗證說明</h3>
            <p>此信號目前為 <code>watch</code> 狀態，信度 ≥ 50，且包含證據摘要。請確認信號是否正確，並決定是否升級為 <code>verified</code>。</p>
            <p>驗證後，信號將在公共網站上可見（若階段為 pilot/ramp/volume 則同時顯示於路線圖）。</p>
        </div>
        <div class="dq-review-form">
            <div class="dq-review-signal">
                <strong>${esc(signal.title)}</strong>
                <div style="margin-top:4px">
                    ${esc(signal.company_name)} / ${esc(signal.chip_name)} ·
                    ${esc(stageLabel(signal.stage))} · 信度 ${signal.confidence_score}
                </div>
            </div>
            <div class="dq-field">
                <label>驗證人 email <span style="color:var(--danger)">*</span></label>
                <input id="review-verifier" type="email" value="${esc(auth.currentUser?.email || '')}" />
            </div>
            <div class="dq-field">
                <label>驗證備註 <span style="color:var(--danger)">*</span></label>
                <textarea id="review-note" rows="3" placeholder="記錄驗證依據..."></textarea>
            </div>
            <div class="dq-field">
                <label style="cursor:pointer">
                    <input type="checkbox" id="review-boost-confidence">
                    同時將信度提升到 95
                </label>
            </div>
        </div>
        <style>
            .dq-review-form .dq-field { margin-bottom: 10px; }
            .dq-review-form label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px; color: var(--text-muted); }
            .dq-review-form input[type="email"],
            .dq-review-form textarea {
                width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px;
                font-size: 13px; font-family: inherit; background: var(--bg); color: var(--text);
            }
            .dq-review-signal { margin-bottom: 12px; padding: 8px; background: var(--surface2); border-radius: 4px; }
        </style>
    `, async () => {
        const verifier = document.getElementById('review-verifier').value.trim();
        const note = document.getElementById('review-note').value.trim();
        const boostConfidence = document.getElementById('review-boost-confidence')?.checked || false;
        if (!verifier) throw new Error('請填寫驗證人');
        if (!note) throw new Error('請填寫驗證備註');
        const actor = auth.currentUser?.email || '';
        const updatedData = {
            ...signal,
            status: 'verified',
            last_verified_at: new Date().toISOString(),
            last_verified_by: verifier,
            verification_note: note,
            last_reviewed_at: new Date().toISOString(),
        };
        if (boostConfidence) {
            updatedData.confidence_score = 95;
        }
        await saveSignal(id, updatedData, {
            actor,
            previousStatus: signal.status,
            previousConfidence: signal.confidence_score,
        });
        // Show transition result — use refreshed signal, not stale closure
        await fetchSignals();
        const refreshed = signalsData.find(s => s.id === id);
        const placement = refreshed ? describeSignalPlacement(refreshed, qualityQueue) : null;
        showToast(`已驗證，${placement?.message || '狀態已更新為 verified'}`, 'success', 4000);
        renderReviewTab();
    }, false);
}

async function handleReviewDowngrade(id) {
    const signal = signalsData.find(s => s.id === id);
    if (!signal) return;
    openModal('降級信號：' + signal.title, `
        <div class="dq-review-form">
            <div class="dq-review-signal">
                <strong>${esc(signal.title)}</strong>
                <div style="margin-top:4px">${esc(signal.company_name)} / ${esc(signal.chip_name)}</div>
            </div>
            <div class="dq-field">
                <label>降級原因 <span style="color:var(--danger)">*</span></label>
                <textarea id="review-downgrade-reason" rows="3" placeholder="說明降級原因..."></textarea>
            </div>
        </div>
        <style>
            .dq-review-form .dq-field { margin-bottom: 10px; }
            .dq-review-form label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px; color: var(--text-muted); }
            .dq-review-form textarea {
                width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px;
                font-size: 13px; font-family: inherit; background: var(--bg); color: var(--text);
            }
            .dq-review-signal { margin-bottom: 12px; padding: 8px; background: #f5f5f5; border-radius: 4px; }
        </style>
    `, async () => {
        const reason = document.getElementById('review-downgrade-reason').value.trim();
        if (!reason) throw new Error('請填寫降級原因');
        const actor = auth.currentUser?.email || '';
        await saveSignal(id, {
            ...signal,
            status: 'downgraded',
            verification_note: '降級原因：' + reason,
            last_reviewed_at: new Date().toISOString(),
        }, {
            actor,
            previousStatus: signal.status,
        });
        await fetchSignals();
        const refreshed = signalsData.find(s => s.id === id);
        const placement = refreshed ? describeSignalPlacement(refreshed, qualityQueue) : null;
        showToast(`已降級，${placement?.message || '狀態已更新為 downgraded'}`, 'success', 4000);
        renderReviewTab();
    }, false);
}

function applyDQFilters() {
    dqFilterState.priority = document.getElementById('dq-priority')?.value || '';
    dqFilterState.status = document.getElementById('dq-status')?.value || '';
    dqFilterState.company = document.getElementById('dq-company')?.value || '';
    dqFilterState.highImpact = document.getElementById('dq-high-impact')?.checked || false;
    dqFilterState.search = document.getElementById('dq-search')?.value.trim() || '';
    dqSortMode = document.getElementById('dq-sort')?.value || 'priority';
    renderDQTable();
}

function renderDQTable() {
    const tbody = document.getElementById('dq-table-body');
    if (!tbody) return;

    // Sort
    sortQualityQueue(qualityQueue, dqSortMode);

    // Filter
    let filtered = [...qualityQueue];
    if (dqFilterState.queueType) {
        filtered = filtered.filter(item => item.queueType === dqFilterState.queueType);
    }
    if (dqFilterState.priority) {
        filtered = filtered.filter(item => item.priorityLabel === dqFilterState.priority);
    }
    if (dqFilterState.status) {
        filtered = filtered.filter(item => item.signal.status === dqFilterState.status);
    }
    if (dqFilterState.company) {
        filtered = filtered.filter(item => item.signal.company_name === dqFilterState.company);
    }
    if (dqFilterState.highImpact) {
        filtered = filtered.filter(item =>
            item.signal.abf_demand_impact === 'high' || item.signal.abf_demand_impact === 'explosive'
        );
    }
    if (dqFilterState.search) {
        const q = dqFilterState.search.toLowerCase();
        filtered = filtered.filter(item =>
            (item.signal.company_name || '').toLowerCase().includes(q) ||
            (item.signal.chip_name || '').toLowerCase().includes(q) ||
            (item.signal.title || '').toLowerCase().includes(q) ||
            item.summary.toLowerCase().includes(q)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="color:#888;text-align:center">無符合條件的數據品質問題</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const s = item.signal;
        const verified = s.last_verified_at ? new Date(s.last_verified_at).toISOString().slice(0, 10) : '—';
        const priorityBadgeClass = item.priorityLabel === '高' ? 'badge-red' : item.priorityLabel === '中' ? 'badge-yellow' : 'badge-gray';

        return `<tr>
            <td><span class="badge badge-gray">${esc(item.queueType)}</span></td>
            <td><span class="badge ${priorityBadgeClass}">${item.priorityLabel} (${item.priorityScore})</span></td>
            <td>${esc(s.title)}</td>
            <td>${esc(s.company_name)} / ${esc(s.chip_name)}</td>
            <td class="dq-issue-summary">${esc(item.summary)}</td>
            <td><span class="badge ${statusChipClass(s.status)}">${statusLabel(s.status)}</span></td>
            <td>${verified}</td>
            <td class="td-actions">
                ${item.quickFixEligible ? `<button class="btn-sm" data-action="dq-quick-fix" data-id="${esc(s.id)}">快速修正</button>` : ''}
                ${item.queueType === QUEUE_TYPES.NEEDS_VERIFICATION ? `<button class="btn-sm" data-action="dq-complete-verification" data-id="${esc(s.id)}">完成驗證</button>` : ''}
                ${item.queueType === QUEUE_TYPES.NEEDS_REVIEW ? `<button class="btn-sm" data-action="dq-mark-reviewed" data-id="${esc(s.id)}">標記已複核</button>` : ''}
                <button class="btn-sm" data-action="dq-full-edit" data-id="${esc(s.id)}">完整編輯</button>
            </td>
        </tr>`;
    }).join('');
}

// ===== QUICK-FIX MODAL (Phase 5) =====

function openQuickFixModal(signalId) {
    const signal = signalsData.find(s => s.id === signalId);
    if (!signal) return;

    const item = qualityQueue.find(q => q.signalId === signalId);
    if (!item) return;

    const fixableFields = item.fixableFields;
    if (fixableFields.length === 0) {
        // No quick-fix available, fall back to full edit
        openEditSignalModal(signalId);
        return;
    }

    const title = `快速修正：${esc(signal.title)}`;
    let formHtml = `<div class="quick-fix-header">
        <div class="quick-fix-signal-info">
            <span>${esc(signal.company_name)}</span> / <span>${esc(signal.chip_name)}</span>
        </div>
        <div class="quick-fix-issues">${esc(item.summary)}</div>
    </div>`;

    formHtml += '<div class="quick-fix-fields">';

    for (const field of fixableFields) {
        switch (field) {
            case 'evidence_summary':
                formHtml += `<div class="dq-field">
                    <label>證據摘要</label>
                    <textarea id="qf-evidence_summary" rows="3">${esc(signal.evidence_summary || '')}</textarea>
                </div>`;
                break;
            case 'confidence_reason':
                formHtml += `<div class="dq-field">
                    <label>信度依據</label>
                    <textarea id="qf-confidence_reason" rows="2">${esc(signal.confidence_reason || '')}</textarea>
                </div>`;
                break;
            case 'package_type':
                formHtml += `<div class="dq-field">
                    <label>封裝類型</label>
                    <input id="qf-package_type" value="${esc(signal.package_type || '')}" list="qf-package-list" placeholder="例如：CoWoS-L">
                    <datalist id="qf-package-list">
                        <option value="CoWoS-L"><option value="CoWoS-S"><option value="EMIB"><option value="2.5D"><option value="3D"><option value="flip-chip">
                    </datalist>
                </div>`;
                break;
            case 'abf_size':
                formHtml += `<div class="dq-field">
                    <label>ABF 尺寸</label>
                    <input id="qf-abf_size" value="${esc(signal.abf_size || '')}" placeholder="例如：77mm x 77mm">
                </div>`;
                break;
            case 'abf_layers':
                formHtml += `<div class="dq-field">
                    <label>ABF 層數</label>
                    <input id="qf-abf_layers" type="number" value="${signal.abf_layers ?? ''}" placeholder="例如：16">
                </div>`;
                break;
            case 'last_verified_by':
                formHtml += `<div class="dq-field">
                    <label>驗證人</label>
                    <input id="qf-last_verified_by" value="${esc(signal.last_verified_by || auth.currentUser?.email || '')}" placeholder="email">
                </div>`;
                break;
            case 'chip_name':
                formHtml += `<div class="dq-field">
                    <label>芯片名稱</label>
                    <input id="qf-chip_name" value="${esc(signal.chip_name || '')}">
                </div>`;
                break;
            case 'company_id':
                formHtml += `<div class="dq-field">
                    <label>公司</label>
                    <select id="qf-company_id">
                        <option value="">選擇公司...</option>
                        ${companiesData.map(c => `<option value="${esc(c.id)}" ${signal.company_id === c.id ? 'selected' : ''}>${esc(c.name_en)} (${esc(c.id)})</option>`).join('')}
                    </select>
                </div>`;
                break;
            case 'company_name':
                // Auto-fill from selected company
                const currentCompany = companiesData.find(c => c.id === signal.company_id);
                const suggestedName = currentCompany ? (currentCompany.name_cn || currentCompany.name_en) : signal.company_name;
                formHtml += `<div class="dq-field">
                    <label>公司名稱（建議：${esc(suggestedName)}）</label>
                    <input id="qf-company_name" value="${esc(suggestedName)}">
                </div>`;
                break;
            case 'status':
                formHtml += `<div class="dq-field">
                    <label>狀態</label>
                    <select id="qf-status">
                        ${STATUS_ENUM.map(v => `<option value="${v}" ${signal.status === v ? 'selected' : ''}>${statusLabel(v)}</option>`).join('')}
                    </select>
                </div>`;
                break;
            case 'confidence_score':
                formHtml += `<div class="dq-field">
                    <label>信度 (0-100)</label>
                    <input id="qf-confidence_score" type="number" min="0" max="100" value="${signal.confidence_score ?? 50}">
                </div>`;
                break;
            case 'last_verified_at':
                formHtml += `<div class="dq-field">
                    <label>驗證日期</label>
                    <input id="qf-last_verified_at" type="date" value="${signal.last_verified_at ? new Date(signal.last_verified_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}">
                </div>`;
                break;
            case 'verification_note':
                formHtml += `<div class="dq-field">
                    <label>驗證備註</label>
                    <textarea id="qf-verification_note" rows="2">${esc(signal.verification_note || '')}</textarea>
                </div>`;
                break;
        }
    }

    formHtml += '</div>'; // close quick-fix-fields
    formHtml += `<div class="quick-fix-footer">
        <div class="quick-fix-hint">請使用下方「Save」按鈕儲存變更</div>
        <button class="btn-sm btn-secondary" data-action="qf-full-edit" data-id="${esc(signalId)}">打開完整編輯</button>
    </div>`;

    openModal(title, formHtml, async () => {
        // Collect data
        const updates = {};
        for (const field of fixableFields) {
            const elId = 'qf-' + field;
            const el = document.getElementById(elId);
            if (!el) continue;
            if (field === 'confidence_score') {
                const val = Number(el.value);
                if (isNaN(val) || val < 0 || val > 100) {
                    showToast('信度必須介於 0 到 100', 'error');
                    throw new Error('__SILENT__');
                }
                updates[field] = val;
            } else if (field === 'abf_layers') {
                const val = el.value.trim();
                updates[field] = val ? Number(val) : null;
            } else if (field === 'cowos_required') {
                updates[field] = el.value === 'true';
            } else {
                updates[field] = el.value.trim();
            }
        }

        // Auto-fill company_name when company_id changes
        if (updates.company_id) {
            const company = companiesData.find(c => c.id === updates.company_id);
            if (company) updates.company_name = company.name_cn || company.name_en;
        }

        // Apply verification date
        if (updates.last_verified_at) {
            updates.last_verified_at = new Date(updates.last_verified_at).toISOString();
        }

        const actor = auth.currentUser?.email || '';
        await saveSignal(signalId, { ...signal, ...updates }, {
            actor,
            previousStatus: signal.status,
            previousConfidence: signal.confidence_score,
        });

        await fetchSignals();
        buildQualityQueueFromData();
        const refreshed = signalsData.find(s => s.id === signalId);
        const remaining = refreshed ? getRemainingIssues(refreshed) : [];
        if (remaining.length === 0) {
            showToast('已補全，此信號已完成數據品質檢查', 'success', 4000);
        } else {
            showToast(`已補全，仍有 ${remaining.length} 個問題需要處理`, 'success', 4000);
        }
        renderDataQualityTab();
    }, false);

    // Handle full-edit fallback from within quick-fix
    document.querySelector('[data-action="qf-full-edit"]')?.addEventListener('click', () => {
        closeModal();
        setTimeout(() => openEditSignalModal(signalId), 100);
    });
}

// ===== MARK REVIEWED MODAL (Phase 14.3 — Guided Resolution) =====

function getRemainingIssues(updatedSignal) {
    const companies = companiesData || [];
    const allChipNames = new Set(signalsData.map(s => s.chip_name).filter(Boolean));
    return evaluateSignalQuality(updatedSignal, { companies, allChipNames });
}

function openCompleteVerificationModal(signalId) {
    const signal = signalsData.find(s => s.id === signalId);
    if (!signal) return;

    const formHtml = `
        <div class="dq-review-form">
            <div class="dq-review-signal">
                <strong>${esc(signal.title)}</strong>
                <div style="margin-top:4px">${esc(signal.company_name)} / ${esc(signal.chip_name)}</div>
            </div>
            <div class="dq-section">
                <h4 class="dq-section-title">完成驗證</h4>
                <div class="dq-field">
                    <label>狀態</label>
                    <select id="dq-complete-status">
                        <option value="verified" ${signal.status === 'verified' ? 'selected' : ''}>${STATUS_LABEL.verified}</option>
                        <option value="watch" ${signal.status === 'watch' ? 'selected' : ''}>${STATUS_LABEL.watch}</option>
                        <option value="downgraded" ${signal.status === 'downgraded' ? 'selected' : ''}>${STATUS_LABEL.downgraded}</option>
                        <option value="invalidated" ${signal.status === 'invalidated' ? 'selected' : ''}>${STATUS_LABEL.invalidated}</option>
                    </select>
                </div>
                <div class="dq-field">
                    <label>信度 (0-100)</label>
                    <input id="dq-complete-confidence" type="number" min="0" max="100" value="${signal.confidence_score ?? 50}">
                </div>
                <div class="dq-field">
                    <label>驗證日期</label>
                    <input id="dq-complete-date" type="date" value="${signal.last_verified_at ? new Date(signal.last_verified_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}">
                </div>
                <div class="dq-field">
                    <label>驗證人</label>
                    <input id="dq-complete-by" value="${esc(signal.last_verified_by || auth.currentUser?.email || '')}">
                </div>
                <div class="dq-field">
                    <label>證據摘要</label>
                    <textarea id="dq-complete-evidence" rows="3">${esc(signal.evidence_summary || '')}</textarea>
                </div>
                <div class="dq-field">
                    <label>信度依據</label>
                    <textarea id="dq-complete-reason" rows="3">${esc(signal.confidence_reason || '')}</textarea>
                </div>
                <div class="dq-field">
                    <label>驗證備註</label>
                    <textarea id="dq-complete-note" rows="2">${esc(signal.verification_note || '')}</textarea>
                </div>
            </div>
            <div class="dq-review-info">
                這個動作會處理「待驗證」問題。若仍缺封裝、ABF 或公司關聯欄位，儲存後會留在其他數據品質分類中。
            </div>
        </div>
    `;

    openModal('完成驗證', formHtml, async () => {
        const status = document.getElementById('dq-complete-status').value;
        const confidence = Number(document.getElementById('dq-complete-confidence').value);
        const date = document.getElementById('dq-complete-date').value;
        const verifiedBy = document.getElementById('dq-complete-by').value.trim();
        const evidence = document.getElementById('dq-complete-evidence').value.trim();
        const reason = document.getElementById('dq-complete-reason').value.trim();
        const note = document.getElementById('dq-complete-note').value.trim();

        if (isNaN(confidence) || confidence < 0 || confidence > 100) {
            throw new Error('信度必須介於 0 到 100');
        }
        if (!date) throw new Error('請填寫驗證日期');
        if (!verifiedBy) throw new Error('請填寫驗證人');
        if (status === 'verified') {
            if (!evidence) throw new Error('verified 狀態必須填寫證據摘要');
            if (!reason) throw new Error('verified 狀態必須填寫信度依據');
        }

        const updatedData = {
            ...signal,
            status,
            confidence_score: confidence,
            last_verified_at: new Date(date).toISOString(),
            last_verified_by: verifiedBy,
            evidence_summary: evidence,
            confidence_reason: reason,
            verification_note: note,
        };

        const actor = auth.currentUser?.email || '';
        await saveSignal(signalId, updatedData, {
            actor,
            previousStatus: signal.status,
            previousConfidence: signal.confidence_score,
        });

        await fetchSignals();
        buildQualityQueueFromData();
        const refreshed = signalsData.find(s => s.id === signalId);
        const placement = refreshed ? describeSignalPlacement(refreshed, qualityQueue) : null;
        const remaining = refreshed ? getRemainingIssues(refreshed) : [];
        if (remaining.length === 0) {
            showToast(`驗證完成，${placement?.message || '沒有剩餘數據品質問題'}`, 'success', 4000);
        } else {
            const reasons = remaining.map(i => i.reason).join('；');
            showToast(`驗證完成，仍有 ${remaining.length} 個問題：${reasons}`, 'success', 5000);
        }
        renderDataQualityTab();
    }, true);
}

function openMarkReviewedModal(signalId) {
    const signal = signalsData.find(s => s.id === signalId);
    if (!signal) return;

    const qualityItem = qualityQueue.find(q => q.signalId === signalId);
    const currentIssuesHtml = qualityItem
        ? qualityItem.issues.map(i => `<span class="badge badge-red">${esc(i.reason)}</span>`).join(' ')
        : '—';

    const hasConflicting = !!signal.conflicting_evidence;

    // Check if signal has remaining NEEDS_VERIFICATION or MISSING_FIELDS issues
    const tempSignal = { ...signal, reviewed_at: new Date().toISOString() };
    if (hasConflicting) tempSignal.conflicting_evidence = '';
    const remainingAfterReview = getRemainingIssues(tempSignal);
    const hasRemainingIssues = remainingAfterReview.length > 0;

    const formHtml = `
        <div class="dq-review-form">
            <div class="dq-review-signal">
                <strong>${esc(signal.title)}</strong>
                <div style="margin-top:4px">${currentIssuesHtml}</div>
            </div>

            <!-- Core review section -->
            <div class="dq-section">
                <h4 class="dq-section-title">複核</h4>
                <div class="dq-field">
                    <label>複核備註</label>
                    <textarea id="dq-review-note" rows="3" placeholder="記錄複核結論...">${esc(signal.review_note || '')}</textarea>
                </div>
                ${hasConflicting ? `
                <div class="dq-field">
                    <label>
                        <input type="checkbox" id="dq-clear-conflicting">
                        清除矛盾證據（當前：${esc(signal.conflicting_evidence.slice(0, 60))}${signal.conflicting_evidence.length > 60 ? '...' : ''}）
                    </label>
                </div>
                ` : ''}
            </div>

            <!-- Guided resolution: complete verification -->
            ${hasRemainingIssues ? `
            <div class="dq-section dq-optional-section">
                <h4 class="dq-section-title">
                    <label style="cursor:pointer;display:flex;align-items:center;gap:6px">
                        <input type="checkbox" id="dq-complete-verification">
                        同時完成驗證
                    </label>
                </h4>
                <div id="dq-verification-fields" style="display:none">
                    <div class="dq-field">
                        <label>狀態</label>
                        <select id="dq-verify-status">
                            <option value="watch" ${signal.status === 'watch' ? 'selected' : ''}>${STATUS_LABEL.watch}</option>
                            <option value="verified">${STATUS_LABEL.verified}</option>
                        </select>
                    </div>
                    <div class="dq-field">
                        <label>信度 (0-100)</label>
                        <input id="dq-verify-confidence" type="number" min="0" max="100" value="${signal.confidence_score ?? 50}" />
                    </div>
                    <div class="dq-field">
                        <label>驗證日期</label>
                        <input id="dq-verify-date" type="date" value="${new Date().toISOString().slice(0, 10)}" />
                    </div>
                    <div class="dq-field">
                        <label>驗證人</label>
                        <input id="dq-verify-by" value="${esc(auth.currentUser?.email || '')}" />
                    </div>
                    <div class="dq-field">
                        <label>驗證備註</label>
                        <textarea id="dq-verify-note" rows="2" placeholder="記錄驗證依據..."></textarea>
                    </div>
                </div>
            </div>
            <div class="dq-review-info">
                數據品質需多步驟完成：複核 → 驗證 → 完整性 → 關聯。標記複核後，可在此繼續完成驗證。
            </div>
            ` : `
            <div class="dq-review-info">
                複核人：${esc(auth.currentUser?.email || 'unknown')}<br>
                複核時間：${new Date().toISOString().slice(0, 19).replace('T', ' ')}
            </div>
            `}
        </div>
        <style>
            .dq-review-form .dq-field { margin-bottom: 10px; }
            .dq-review-form label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px; color: var(--text-muted); }
            .dq-review-form textarea, .dq-review-form input[type="text"], .dq-review-form input[type="date"],
            .dq-review-form input[type="number"], .dq-review-form select {
                width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px;
                font-size: 13px; font-family: inherit; background: var(--bg); color: var(--text);
            }
            .dq-review-signal { margin-bottom: 12px; padding: 8px; background: #f5f5f5; border-radius: 4px; }
            .dq-review-info { font-size: 11px; color: var(--text-muted); margin-top: 8px; }
            .dq-section { margin-bottom: 14px; padding: 10px; border: 1px solid #eee; border-radius: 4px; }
            .dq-section-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--text); }
            .dq-optional-section { border-color: #cde6ff; background: #f9fbff; }
        </style>
    `;

    openModal('標記已複核', formHtml, async () => {
        // --- Core review fields ---
        const reviewNote = document.getElementById('dq-review-note').value.trim();
        const clearConflicting = document.getElementById('dq-clear-conflicting')?.checked || false;

        // Validation: conflicting evidence requires review_note if not cleared
        if (hasConflicting && !clearConflicting && !reviewNote) {
            throw new Error('矛盾證據未清除時，必須填寫複核備註');
        }

        const updatedData = {
            ...signal,
            reviewed_at: new Date().toISOString(),
            reviewed_by: auth.currentUser?.email || '',
            review_note: reviewNote,
        };

        if (clearConflicting) {
            updatedData.conflicting_evidence = '';
        }

        // --- Guided verification fields (if enabled) ---
        const completeVerification = document.getElementById('dq-complete-verification')?.checked || false;
        if (completeVerification) {
            const verifyStatus = document.getElementById('dq-verify-status').value;
            const verifyConfidence = Number(document.getElementById('dq-verify-confidence').value);
            const verifyDate = document.getElementById('dq-verify-date').value;
            const verifyBy = document.getElementById('dq-verify-by').value.trim();
            const verifyNote = document.getElementById('dq-verify-note').value.trim();

            // Validation for verified status
            if (verifyStatus === 'verified') {
                if (!verifyDate) throw new Error('驗證為 verified 時，必須填寫驗證日期');
                if (!verifyBy) throw new Error('驗證為 verified 時，必須填寫驗證人');
                if (!updatedData.evidence_summary && !signal.evidence_summary) {
                    throw new Error('驗證為 verified 時，必須填寫證據摘要');
                }
                if (!updatedData.confidence_reason && !signal.confidence_reason) {
                    throw new Error('驗證為 verified 時，必須填寫信度依據');
                }
            }

            updatedData.status = verifyStatus;
            updatedData.confidence_score = verifyConfidence;
            updatedData.last_verified_at = verifyDate;
            updatedData.last_verified_by = verifyBy;
            updatedData.verification_note = verifyNote;
        }

        const actor = auth.currentUser?.email || '';
        await saveSignal(signalId, updatedData, {
            actor,
            previousStatus: signal.status,
            previousConfidence: signal.confidence_score,
        });

        // Re-evaluate remaining issues after save
        const remaining = getRemainingIssues(updatedData);

        await fetchSignals();
        buildQualityQueueFromData();
        const refreshed = signalsData.find(s => s.id === signalId);
        const placement = refreshed ? describeSignalPlacement(refreshed, qualityQueue) : null;
        if (remaining.length === 0) {
            showToast(`複核已完成，${placement?.message || '沒有剩餘數據品質問題'}`, 'success', 4000);
        } else {
            const reasons = remaining.map(i => i.reason).join('；');
            showToast(`複核已完成，仍有 ${remaining.length} 個問題：${reasons}`, 'success', 5000);
        }
        renderDataQualityTab();
    }, false);

    // Toggle verification fields visibility
    document.getElementById('dq-complete-verification')?.addEventListener('change', e => {
        const fields = document.getElementById('dq-verification-fields');
        fields.style.display = e.target.checked ? 'block' : 'none';
    });
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
    const box = modal.querySelector('.modal-box');
    if (wide === 'signal-edit') {
        box.classList.add('signal-edit-modal');
        box.style.maxWidth = '';
        box.style.width = '';
    } else {
        box.classList.remove('signal-edit-modal');
        box.style.maxWidth = wide ? '900px' : '680px';
        box.style.width = '';
    }
    currentSaveFn = onSave;
    setTimeout(() => {
        const first = modalBody.querySelector('input, textarea, select');
        if (first) first.focus();
    }, 50);
}

function closeModal() {
    modal.style.display = 'none';
    modalBody.innerHTML = '';
    const box = modal.querySelector('.modal-box');
    box.classList.remove('signal-edit-modal');
    box.style.maxWidth = '680px';
    box.style.width = '';
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
        const silent = ['ID required', 'Duplicate ID', '__SILENT__'];
        if (!silent.includes(err.message)) {
            showToast('Error: ' + err.message, 'error');
        }
    } finally {
        modalSave.disabled = false;
        modalSave.textContent = 'Save';
    }
});
