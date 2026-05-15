/**
 * Roadmap Horizontal Timeline Matrix — V2 (Signals-derived)
 *
 * Rows = companies, Columns = year × quarter
 * Data source: derived from signals via roadmap-derived.js
 *
 * This module only handles DOM rendering.
 * All derivation logic lives in js/modules/roadmap-derived.js.
 */

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
    { year: 2024, header: '#111111', border: '#1f521f', label: '#33ff00' },
    { year: 2025, header: '#0d0d0d', border: '#1f521f', label: '#33ff00' },
    { year: 2026, header: '#111111', border: '#1f521f', label: '#33ff00' },
    { year: 2027, header: '#0d0d0d', border: '#1f521f', label: '#33ff00' },
    { year: 2028, header: '#111111', border: '#1f521f', label: '#33ff00' },
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
        const msg = document.createElement('div');
        msg.innerHTML = `<div class="page-empty-state">
  <div class="page-empty-state-icon">◈</div>
  <div class="page-empty-state-title">路線圖數據累積中</div>
  <div class="page-empty-state-sub">路線圖由已驗證信號自動生成。<br>添加信號並審核通過後，此處將自動顯示時間軸。</div>
  <a href="signals.html" class="page-empty-state-link">前往信號工作台 →</a>
</div>`;
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
        const style = COMPANY_STYLE[companyId] || { label: companyData.companyName, color: '#ffffff', bg: '#111111', border: '#1f521f' };

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
 * Show signal detail in a compact overlay driven by the signal record.
 * Displays identity, status, confidence, ABF impact, and evidence summary.
 * Provides onward navigation to chip and company intelligence pages.
 */
function showSignalDetail(signal, style) {
    document.querySelector('.roadmap-signal-detail')?.remove();

    const IMPACT_LABELS = { explosive: '爆炸性', high: '高', medium: '中', low: '低' };
    const STAGE_LABELS = { pilot: '試產', ramp: '爬坡', volume: '量產' };
    const STATUS_LABELS = { verified: '已驗證', watch: '觀望', draft: '草稿', downgraded: '降級', invalidated: '失效' };

    const overlay = document.createElement('div');
    overlay.className = 'roadmap-signal-detail';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#0a0a0a;border:2px solid #33ff00;color:#33ff00;max-width:480px;width:90%;max-height:80vh;overflow-y:auto;padding:24px;position:relative;';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'position:absolute;top:8px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;color:#33ff00;';
    closeBtn.addEventListener('click', () => overlay.remove());
    modal.appendChild(closeBtn);

    // Header: company + chip
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #1f521f;';

    const companyLine = document.createElement('div');
    companyLine.style.cssText = 'font-size:12px;color:rgba(51,255,0,0.55);font-family:monospace;';
    companyLine.textContent = style.label || signal.company_name;

    const chipLine = document.createElement('div');
    chipLine.style.cssText = 'font-size:20px;font-weight:700;margin-top:4px;';
    chipLine.textContent = signal.chip_name;

    const titleLine = document.createElement('div');
    titleLine.style.cssText = 'font-size:13px;color:rgba(51,255,0,0.55);margin-top:4px;';
    titleLine.textContent = signal.title || '';

    header.appendChild(companyLine);
    header.appendChild(chipLine);
    header.appendChild(titleLine);
    modal.appendChild(header);

    // Meta badges
    const metaRow = document.createElement('div');
    metaRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;';

    const addBadge = (label, color) => {
        const b = document.createElement('span');
        b.style.cssText = `font-size:11px;padding:3px 8px;border:1px solid ${color};color:${color};font-family:monospace;text-transform:uppercase;`;
        b.textContent = label;
        metaRow.appendChild(b);
    };

    addBadge(STAGE_LABELS[signal.stage] || signal.stage, '#33ff00');
    addBadge(STATUS_LABELS[signal.status] || signal.status, '#33ff00');
    addBadge(`信度 ${signal.confidence_score}`, '#33ff00');
    addBadge(`ABF ${IMPACT_LABELS[signal.abf_demand_impact] || signal.abf_demand_impact}`, '#33ff00');
    modal.appendChild(metaRow);

    // Fields
    const fields = [];
    if (signal.package_type) fields.push({ label: '封裝', value: signal.package_type });
    if (signal.cowos_required) fields.push({ label: 'CoWoS', value: '是' });
    if (signal.abf_size) fields.push({ label: 'ABF 尺寸', value: signal.abf_size });
    if (signal.abf_layers) fields.push({ label: 'ABF 層數', value: signal.abf_layers + ' 層' });
    if (signal.hbm) fields.push({ label: 'HBM', value: signal.hbm });
    if (signal.release_year) fields.push({ label: '量產', value: `${signal.release_year} ${signal.release_quarter || ''}` });

    if (fields.length > 0) {
        const fieldsDiv = document.createElement('div');
        fieldsDiv.style.cssText = 'margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #1f521f;';
        fields.forEach(f => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;font-size:13px;padding:3px 0;';
            row.innerHTML = `<span style="color:rgba(51,255,0,0.55)">${f.label}</span><span style="font-weight:500">${f.value}</span>`;
            fieldsDiv.appendChild(row);
        });
        modal.appendChild(fieldsDiv);
    }

    // Evidence summary
    if (signal.evidence_summary) {
        const evidenceDiv = document.createElement('div');
        evidenceDiv.style.cssText = 'margin-bottom:16px;';
        const evidenceTitle = document.createElement('div');
        evidenceTitle.style.cssText = 'font-size:11px;text-transform:uppercase;color:rgba(51,255,0,0.55);font-family:monospace;margin-bottom:4px;';
        evidenceTitle.textContent = '證據摘要';
        const evidenceText = document.createElement('div');
        evidenceText.style.cssText = 'font-size:13px;line-height:1.6;color:#33ff00;';
        evidenceText.textContent = signal.evidence_summary;
        evidenceDiv.appendChild(evidenceTitle);
        evidenceDiv.appendChild(evidenceText);
        modal.appendChild(evidenceDiv);
    }

    // Onward navigation
    const navDiv = document.createElement('div');
    navDiv.style.cssText = 'display:flex;gap:8px;padding-top:12px;border-top:1px solid #1f521f;flex-wrap:wrap;';

    const makeLink = (href, text) => {
        const a = document.createElement('a');
        a.href = href;
        a.style.cssText = 'font-size:12px;font-family:monospace;color:#33ff00;text-decoration:none;padding:6px 12px;border:1px solid #33ff00;';
        a.textContent = text;
        return a;
    };

    navDiv.appendChild(makeLink(`chip-signals.html?name=${encodeURIComponent(signal.chip_name)}`, '查看芯片影響 →'));
    if (signal.company_id) {
        navDiv.appendChild(makeLink(`company-signals.html?id=${encodeURIComponent(signal.company_id)}`, '查看公司信號 →'));
    }
    modal.appendChild(navDiv);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Event handlers
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    const onKey = e => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    closeBtn.focus();
}

export { renderTimeline };
