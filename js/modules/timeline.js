/**
 * Roadmap Horizontal Timeline Matrix — V2 (Signals-derived)
 *
 * Rows = companies, Columns = year × quarter
 * Data source: derived from signals via roadmap-derived.js
 *
 * This module only handles DOM rendering.
 * All derivation logic lives in js/modules/roadmap-derived.js.
 */

import { isRoadmapEligibleSignal } from './roadmap-derived.js';

const COMPANY_ORDER = ['nvidia', 'amd', 'intel', 'huawei_ascend', 'cambricon', 'google_tpu', 'tsmc', 'samsung', 'sk_hynix'];

const COMPANY_STYLE = {
    nvidia:        { label: 'NVIDIA',     color: '#ffffff', bg: '#111111', border: '#111111' },
    amd:           { label: 'AMD',        color: '#ffffff', bg: '#111111', border: '#111111' },
    intel:         { label: 'Intel',      color: '#ffffff', bg: '#111111', border: '#111111' },
    huawei_ascend: { label: '華為昇騰',  color: '#ffffff', bg: '#111111', border: '#111111' },
    cambricon:     { label: '寒武紀',     color: '#ffffff', bg: '#111111', border: '#111111' },
    google_tpu:    { label: 'Google TPU', color: '#ffffff', bg: '#111111', border: '#111111' },
    tsmc:          { label: '台積電',     color: '#ffffff', bg: '#111111', border: '#111111' },
    samsung:       { label: 'Samsung',    color: '#ffffff', bg: '#111111', border: '#111111' },
    sk_hynix:      { label: 'SK Hynix',   color: '#ffffff', bg: '#111111', border: '#111111' },
};

const YEAR_COLORS = [
    { year: 2024, header: '#f9fafb', border: '#e5e7eb', label: '#374151' },
    { year: 2025, header: '#f3f4f6', border: '#d1d5db', label: '#111827' },
    { year: 2026, header: '#f9fafb', border: '#e5e7eb', label: '#374151' },
    { year: 2027, header: '#f3f4f6', border: '#d1d5db', label: '#111827' },
    { year: 2028, header: '#f9fafb', border: '#e5e7eb', label: '#374151' },
];

const IMPACT_SORT = { explosive: 4, high: 3, medium: 2, low: 1 };

/**
 * Render the roadmap timeline matrix.
 *
 * @param {Object} matrix — derived matrix from buildRoadmapMatrixFromSignals()
 * @param {string|null} filterCompany — company ID filter or null for all
 * @param {Function} onSignalClick — callback(signal) when a cell is clicked
 */
function renderTimeline(matrix, filterCompany = null, onSignalClick = null) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;
    container.innerHTML = '';

    // Extract years and company IDs from the matrix
    const years = getMatrixYears(matrix);
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

    let companyIds = COMPANY_ORDER.filter(id => matrix[id]);
    Object.keys(matrix).forEach(id => {
        if (!companyIds.includes(id)) companyIds.push(id);
    });

    if (filterCompany && filterCompany !== 'all') {
        companyIds = companyIds.filter(id => id === filterCompany);
    }

    if (companyIds.length === 0) {
        const msg = document.createElement('p');
        msg.style.cssText = 'text-align:center;color:#9ca3af;padding:60px 0;font-size:15px';
        msg.textContent = '暫無已驗證 Roadmap 數據';
        container.appendChild(msg);
        return;
    }

    // Outer card
    const card = document.createElement('div');
    card.className = 'roadmap-card';

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'roadmap-scroll';

    const table = document.createElement('table');
    table.className = 'roadmap-matrix';

    // ── Header: two rows ──────────────────────────────────────
    const thead = document.createElement('thead');

    // Row 1: Company (rowspan=2) + Year headers (colspan=4 each)
    const row1 = document.createElement('tr');
    const thCompany = document.createElement('th');
    thCompany.rowSpan = 2;
    thCompany.className = 'th-company';
    thCompany.textContent = '公司';
    row1.appendChild(thCompany);

    years.forEach(year => {
        const yc = YEAR_COLORS.find(y => y.year === year) || YEAR_COLORS[0];
        const th = document.createElement('th');
        th.colSpan = quarters.length;
        th.className = 'th-year';
        th.textContent = year;
        th.style.cssText = `background:${yc.header};border-bottom:2px solid ${yc.border};color:${yc.label}`;
        row1.appendChild(th);
    });
    thead.appendChild(row1);

    // Row 2: Q1 Q2 Q3 Q4 repeated per year
    const row2 = document.createElement('tr');
    years.forEach(year => {
        const yc = YEAR_COLORS.find(y => y.year === year) || YEAR_COLORS[0];
        quarters.forEach(q => {
            const th = document.createElement('th');
            th.className = 'th-quarter';
            th.textContent = q;
            th.style.cssText = `background:${yc.header}`;
            row2.appendChild(th);
        });
    });
    thead.appendChild(row2);
    table.appendChild(thead);

    // ── Body ───────────────────────────────────────────────────
    const tbody = document.createElement('tbody');

    companyIds.forEach((companyId, rowIndex) => {
        const companyData = matrix[companyId];
        if (!companyData) return;
        const style = COMPANY_STYLE[companyId] || { label: companyData.companyName, color: '#374151', bg: '#f9fafb', border: '#e5e7eb' };

        const tr = document.createElement('tr');
        tr.className = rowIndex % 2 === 0 ? 'tr-even' : 'tr-odd';

        // Company name cell
        const tdName = document.createElement('td');
        tdName.className = 'td-company';
        const nameTag = document.createElement('span');
        nameTag.className = 'company-name-tag';
        nameTag.textContent = style.label;
        nameTag.style.cssText = `color:${style.color}`;
        tdName.appendChild(nameTag);
        tr.appendChild(tdName);

        // Year × Quarter cells
        years.forEach(year => {
            const yc = YEAR_COLORS.find(y => y.year === year) || YEAR_COLORS[0];
            quarters.forEach(q => {
                const td = document.createElement('td');
                const cellSignals = companyData?.cells?.[year]?.[q] || [];

                if (cellSignals.length > 0) {
                    td.className = 'td-chip';
                    td.style.cssText = `background:${yc.header}`;
                    td.setAttribute('role', 'button');
                    td.setAttribute('tabindex', '0');
                    td.setAttribute('aria-label', `${cellSignals.map(s => s.chip_name).join(', ')} — ${style.label} ${year} ${q}`);

                    if (cellSignals.length === 1) {
                        // Single signal: show chip name
                        const sig = cellSignals[0];
                        const tag = document.createElement('span');
                        tag.className = 'chip-tag';
                        tag.style.cssText = `color:${style.color};background:${style.bg};border-color:${style.border}`;
                        tag.textContent = sig.chip_name;
                        td.appendChild(tag);

                        const open = () => {
                            if (onSignalClick) onSignalClick(sig);
                            else showSignalDetail(sig, style);
                        };
                        td.addEventListener('click', open);
                        td.addEventListener('keydown', e => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
                        });
                    } else {
                        // Multiple signals: compact stacked list
                        cellSignals.forEach(sig => {
                            const tag = document.createElement('span');
                            tag.className = 'chip-tag';
                            tag.style.cssText = `color:${style.color};background:${style.bg};border-color:${style.border};display:block;margin-bottom:2px`;
                            tag.textContent = sig.chip_name;
                            td.appendChild(tag);

                            const open = () => {
                                if (onSignalClick) onSignalClick(sig);
                                else showSignalDetail(sig, style);
                            };
                            tag.addEventListener('click', e => { e.stopPropagation(); open(); });
                        });
                    }
                } else {
                    td.className = 'td-empty';
                    td.style.cssText = `background:${yc.header}`;
                }

                tr.appendChild(td);
            });
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    scrollWrap.appendChild(table);
    card.appendChild(scrollWrap);
    container.appendChild(card);
}

/**
 * Extract sorted years from the derived matrix.
 */
function getMatrixYears(matrix) {
    const years = new Set();
    for (const company of Object.values(matrix)) {
        for (const year of Object.keys(company.cells || {})) {
            years.add(Number(year));
        }
    }
    return [...years].sort((a, b) => a - b);
}

/**
 * Show signal detail in a compact popup (legacy behavior, updated to use signal fields).
 * Falls back to navigating to the chip intelligence page.
 */
function showSignalDetail(signal, style) {
    // Navigate to chip intelligence page as primary action
    window.location.href = `chip-signals.html?name=${encodeURIComponent(signal.chip_name)}`;
}

export { renderTimeline };
