/**
 * Roadmap 橫向時間軸矩陣
 * 行 = 公司，列 = 年份×季度（2024 Q1~Q4 | 2025 Q1~Q4 | 2026 Q1~Q4）
 */

const COMPANY_ORDER = ['nvidia', 'amd', 'intel', 'huawei_ascend', 'cambricon', 'google_tpu'];

const COMPANY_STYLE = {
    nvidia:        { label: 'NVIDIA',     color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
    amd:           { label: 'AMD',        color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
    intel:         { label: 'Intel',      color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
    huawei_ascend: { label: '華為昇騰',  color: '#be123c', bg: '#fff1f2', border: '#fda4af' },
    cambricon:     { label: '寒武紀',     color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
    google_tpu:    { label: 'Google TPU', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
};

const YEAR_COLORS = [
    { year: 2024, header: '#f8fafc', border: '#e2e8f0', label: '#64748b' },
    { year: 2025, header: '#fefce8', border: '#fde68a', label: '#92400e' },
    { year: 2026, header: '#f0fdf4', border: '#bbf7d0', label: '#065f46' },
];

function renderTimeline(roadmapsData, filterCompany = null) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;
    container.innerHTML = '';

    // 收集所有條目
    const entries = [];
    Object.entries(roadmapsData).forEach(([companyId, data]) => {
        if (!data.timeline) return;
        data.timeline.forEach(item => {
            entries.push({ companyId, companyName: data.company, ...item });
        });
    });

    if (entries.length === 0) {
        const msg = document.createElement('p');
        msg.style.cssText = 'text-align:center;color:#9ca3af;padding:60px 0;font-size:15px';
        msg.textContent = '暫無數據';
        container.appendChild(msg);
        return;
    }

    const years = [...new Set(entries.map(e => e.year))].sort((a, b) => a - b);
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

    // 公司列表，套用篩選
    let companyIds = COMPANY_ORDER.filter(id => roadmapsData[id]);
    Object.keys(roadmapsData).forEach(id => {
        if (!companyIds.includes(id)) companyIds.push(id);
    });
    if (filterCompany && filterCompany !== 'all') {
        companyIds = companyIds.filter(id => id === filterCompany);
    }

    // 外層容器（白色卡片）
    const card = document.createElement('div');
    card.className = 'roadmap-card';

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'roadmap-scroll';

    const table = document.createElement('table');
    table.className = 'roadmap-matrix';

    // ── 表頭：兩行 ──────────────────────────────────────
    const thead = document.createElement('thead');

    // 行 1：公司(rowspan=2) + 年份(colspan=4 each)
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

    // 行 2：Q1 Q2 Q3 Q4（每個年份重複一次）
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

    // ── 表身 ───────────────────────────────────────────
    const tbody = document.createElement('tbody');

    companyIds.forEach((companyId, rowIndex) => {
        const companyData = roadmapsData[companyId];
        if (!companyData) return;
        const style = COMPANY_STYLE[companyId] || { label: companyData.company, color: '#374151', bg: '#f9fafb', border: '#e5e7eb' };

        const tr = document.createElement('tr');
        tr.className = rowIndex % 2 === 0 ? 'tr-even' : 'tr-odd';

        // 公司名格
        const tdName = document.createElement('td');
        tdName.className = 'td-company';
        const nameTag = document.createElement('span');
        nameTag.className = 'company-name-tag';
        nameTag.textContent = style.label;
        nameTag.style.cssText = `color:${style.color}`;
        tdName.appendChild(nameTag);
        tr.appendChild(tdName);

        // 年份 × 季度格
        years.forEach(year => {
            const yc = YEAR_COLORS.find(y => y.year === year) || YEAR_COLORS[0];
            quarters.forEach(q => {
                const td = document.createElement('td');
                const chip = entries.find(
                    e => e.companyId === companyId && e.year === year && e.quarter === q
                );

                if (chip) {
                    td.className = 'td-chip';
                    td.style.cssText = `background:${yc.header}`;
                    td.setAttribute('role', 'button');
                    td.setAttribute('tabindex', '0');
                    td.setAttribute('aria-label', `${chip.product} — ${style.label} ${year} ${q}`);

                    const tag = document.createElement('span');
                    tag.className = 'chip-tag';
                    tag.style.cssText = `color:${style.color};background:${style.bg};border-color:${style.border}`;
                    tag.textContent = chip.product;
                    td.appendChild(tag);

                    const open = () => showChipPopup(chip, style.label, style.color);
                    td.addEventListener('click', open);
                    td.addEventListener('keydown', e => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
                    });
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

function showChipPopup(chip, companyName, accentColor) {
    document.querySelector('.chip-popup-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'chip-popup-overlay';

    const popup = document.createElement('div');
    popup.className = 'chip-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');

    // 頂部色條
    const colorBar = document.createElement('div');
    colorBar.className = 'chip-popup-colorbar';
    colorBar.style.background = accentColor;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'chip-popup-close';
    closeBtn.setAttribute('aria-label', '關閉');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => overlay.remove());

    const header = document.createElement('div');
    header.className = 'chip-popup-header';
    header.textContent = `${companyName}  ·  ${chip.year}${chip.quarter ? ' ' + chip.quarter : ''}`;

    const title = document.createElement('div');
    title.className = 'chip-popup-title';
    title.style.color = accentColor;
    title.textContent = chip.product;

    const divider = document.createElement('div');
    divider.className = 'chip-popup-divider';

    popup.appendChild(colorBar);
    popup.appendChild(closeBtn);
    popup.appendChild(header);
    popup.appendChild(title);
    popup.appendChild(divider);

    const fields = [
        { label: '用途',      value: chip.purpose },
        { label: '製程',      value: chip.process },
        { label: '規格',      value: chip.specs },
        { label: 'CoWoS封裝', value: chip.cowos === true ? '是' : chip.cowos === false ? '否' : null },
        { label: 'ABF尺寸',   value: chip.abf_size },
        { label: 'ABF層數',   value: chip.abf_layers != null ? chip.abf_layers + ' 層' : null },
    ];

    fields.forEach(({ label, value }) => {
        if (!value) return;
        const row = document.createElement('div');
        row.className = 'chip-popup-field';

        const lEl = document.createElement('span');
        lEl.className = 'chip-popup-field-label';
        lEl.textContent = label;

        const vEl = document.createElement('span');
        vEl.className = 'chip-popup-field-value';
        vEl.textContent = value;

        row.appendChild(lEl);
        row.appendChild(vEl);
        popup.appendChild(row);
    });

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    const onKey = e => {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
    closeBtn.focus();
}

export { renderTimeline };
