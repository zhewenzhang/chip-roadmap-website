import { loadSignals, loadCompanies } from '../firebase/db.js';
import { IMPACT_LABEL, STAGE_LABEL, STATUS_LABEL } from './signals-schema.js';
import { isRoadmapEligibleSignal } from './roadmap-derived.js';

let allEligible = [];
let companies = {};
let currentCompany = '';

function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function buildMatrix(signals) {
    const byCompany = {};
    const quartersSet = new Set();

    signals.forEach(s => {
        const key = `${s.release_year}-${s.release_quarter}`;
        quartersSet.add(key);
        if (!byCompany[s.company_id]) byCompany[s.company_id] = {};
        if (!byCompany[s.company_id][key]) byCompany[s.company_id][key] = [];
        byCompany[s.company_id][key].push(s);
    });

    const quarters = [...quartersSet].sort((a, b) => {
        const [ay, aq] = a.split('-');
        const [by, bq] = b.split('-');
        if (ay !== by) return Number(ay) - Number(by);
        return aq.localeCompare(bq);
    });

    const companyIds = Object.keys(byCompany).sort((a, b) => {
        const aName = companies[a]?.name_en || a;
        const bName = companies[b]?.name_en || b;
        return aName.localeCompare(bName);
    });

    return { quarters, companyIds, byCompany };
}

function renderCell(signals) {
    if (!signals.length) return '<td class="roadmap-cell roadmap-cell-empty"></td>';
    return `<td class="roadmap-cell">
        ${signals.map(s => `<a href="signal.html?id=${encodeURIComponent(s.id)}" class="roadmap-chip roadmap-chip-${s.abf_demand_impact} roadmap-chip-status-${s.status}" title="${esc(s.title)}">
            ${s.abf_demand_impact === 'explosive' ? '⚡' : s.abf_demand_impact === 'high' ? '↑' : ''}${esc(s.chip_name)}
        </a>`).join('')}
    </td>`;
}

function renderMatrix() {
    const filtered = currentCompany
        ? allEligible.filter(s => s.company_id === currentCompany)
        : allEligible;

    const { quarters, companyIds, byCompany } = buildMatrix(filtered);

    if (!filtered.length) {
        document.getElementById('roadmapMatrix').innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">◈</div>
            <div class="empty-state-title">沒有符合條件的信號</div>
            <div class="empty-state-sub">verified + pilot/ramp/volume 階段的信號才會顯示在路線圖</div>
        </div>`;
        document.getElementById('cellCount').textContent = 0;
        return;
    }

    document.getElementById('cellCount').textContent = filtered.length;

    let html = '<table class="roadmap-table"><thead><tr><th class="roadmap-head-company"></th>';
    quarters.forEach(q => {
        const [y, qq] = q.split('-');
        html += `<th class="roadmap-head-quarter">${y}<br><span class="roadmap-head-q">${qq}</span></th>`;
    });
    html += '</tr></thead><tbody>';

    companyIds.forEach(cid => {
        const c = companies[cid];
        const name = c?.name_en || cid;
        html += `<tr><td class="roadmap-row-company"><a href="company.html?id=${cid}" class="entity-link entity-company"><span class="entity-icon"></span>${esc(name)}</a></td>`;
        quarters.forEach(q => {
            html += renderCell(byCompany[cid][q] || []);
        });
        html += '</tr>';
    });
    html += '</tbody></table>';

    document.getElementById('roadmapMatrix').innerHTML = html;
}

function renderFilter() {
    const companyIds = [...new Set(allEligible.map(s => s.company_id))];
    const filterBar = document.getElementById('roadmapFilter');
    filterBar.innerHTML = '<button class="filter-btn active" data-company="">全部</button>' +
        companyIds.map(id => {
            const name = companies[id]?.name_en || id;
            return `<button class="filter-btn" data-company="${esc(id)}">${esc(name)}</button>`;
        }).join('');
    filterBar.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCompany = btn.dataset.company;
            renderMatrix();
        });
    });
}

async function init() {
    const [sResult, cMap] = await Promise.all([loadSignals(), loadCompanies()]);
    if (!sResult.ok) return;
    allEligible = sResult.data.filter(isRoadmapEligibleSignal);
    companies = cMap;

    renderFilter();
    renderMatrix();

    // Apply ?company= URL parameter
    const urlCompany = new URLSearchParams(window.location.search).get('company');
    if (urlCompany) {
        const btn = document.querySelector(`.filter-btn[data-company="${urlCompany}"]`);
        if (btn) btn.click();
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
