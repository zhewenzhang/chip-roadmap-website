import { loadCompanies, loadSignals } from '../firebase/db.js';
import { IMPACT_LABEL, REGION_LABEL } from './signals-schema.js';

let companies = [];
let signals = [];
let signalsByCompany = {};

function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function maxImpact(sigs) {
    const order = { explosive: 4, high: 3, medium: 2, low: 1 };
    return sigs.reduce((max, s) => {
        return (order[s.abf_demand_impact] || 0) > (order[max] || 0) ? s.abf_demand_impact : max;
    }, '');
}

function renderCard(c) {
    const sigs = signalsByCompany[c.id] || [];
    const sigCount = sigs.length;
    const impact = c.abf_demand_impact || maxImpact(sigs);
    return `<a href="company.html?id=${c.id}" class="company-card">
        <div class="company-card-header">
            <span class="entity-icon" style="color:var(--accent)">◆</span>
            <h3 class="company-card-name">${esc(c.name_en || c.id)}</h3>
        </div>
        ${c.name_cn ? `<div class="company-card-cn">${esc(c.name_cn)}</div>` : ''}
        <div class="company-card-meta">
            ${esc(REGION_LABEL[c.country] || c.country || '')} · ${esc(c.category || '')}
        </div>
        ${c.market_cap ? `<div class="company-card-cap">💰 ${esc(c.market_cap)}</div>` : ''}
        <div class="company-card-stats">
            <span>📡 ${sigCount} 信號</span>
            ${impact ? `<span class="badge badge-impact-${impact}">⚡ ${esc(IMPACT_LABEL[impact])}</span>` : ''}
        </div>
    </a>`;
}

function populateFilters() {
    const regions = [...new Set(companies.map(c => c.country).filter(Boolean))].sort();
    const categories = [...new Set(companies.map(c => c.category).filter(Boolean))].sort();
    document.getElementById('filterRegion').innerHTML = '<option value="">全部地區</option>' +
        regions.map(r => `<option value="${esc(r)}">${esc(REGION_LABEL[r] || r)}</option>`).join('');
    document.getElementById('filterCategory').innerHTML = '<option value="">全部類別</option>' +
        categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

function applyFilters() {
    const q = document.getElementById('companySearch').value.trim().toLowerCase();
    const region = document.getElementById('filterRegion').value;
    const category = document.getElementById('filterCategory').value;
    const impact = document.getElementById('filterImpact').value;

    let result = [...companies];
    if (q) result = result.filter(c =>
        (c.name_en || '').toLowerCase().includes(q) ||
        (c.name_cn || '').includes(q) ||
        (c.id || '').toLowerCase().includes(q)
    );
    if (region) result = result.filter(c => c.country === region);
    if (category) result = result.filter(c => c.category === category);
    if (impact) result = result.filter(c => {
        const sigs = signalsByCompany[c.id] || [];
        return (c.abf_demand_impact === impact) || sigs.some(s => s.abf_demand_impact === impact);
    });

    const grid = document.getElementById('companyGrid');
    if (result.length === 0) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◈</div><div class="empty-state-title">沒有匹配公司</div></div>`;
    } else {
        grid.innerHTML = result.map(renderCard).join('');
    }
    document.getElementById('companyCount').textContent = result.length;
}

async function init() {
    const [cMap, sResult] = await Promise.all([loadCompanies(), loadSignals()]);
    companies = Object.values(cMap).sort((a, b) => (a.name_en || a.id).localeCompare(b.name_en || b.id));
    signals = sResult.ok ? sResult.data : [];
    signalsByCompany = signals.reduce((acc, s) => {
        (acc[s.company_id] = acc[s.company_id] || []).push(s);
        return acc;
    }, {});

    document.getElementById('companySignalCount').textContent = signals.length;
    populateFilters();
    applyFilters();

    document.getElementById('companySearch').addEventListener('input', applyFilters);
    ['filterRegion', 'filterCategory', 'filterImpact'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
