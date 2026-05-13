/**
 * Roadmap 矩陣表 — 全年份一覽，年份作分節行
 */

const COMPANY_ORDER = ['nvidia', 'amd', 'intel', 'huawei_ascend', 'cambricon', 'google_tpu'];

function renderTimeline(roadmapsData, filterCompany = null) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;
    container.innerHTML = '';

    const entries = [];
    Object.entries(roadmapsData).forEach(([companyId, data]) => {
        if (!data.timeline) return;
        data.timeline.forEach(item => {
            entries.push({ companyId, companyName: data.company, ...item });
        });
    });

    if (entries.length === 0) {
        const msg = document.createElement('p');
        msg.style.cssText = 'text-align:center;color:#888;padding:60px 0';
        msg.textContent = '暫無數據';
        container.appendChild(msg);
        return;
    }

    const years = [...new Set(entries.map(e => e.year))].sort((a, b) => a - b);

    let companyIds = COMPANY_ORDER.filter(id => roadmapsData[id]);
    Object.keys(roadmapsData).forEach(id => {
        if (!companyIds.includes(id)) companyIds.push(id);
    });
    if (filterCompany && filterCompany !== 'all') {
        companyIds = companyIds.filter(id => id === filterCompany);
    }

    const wrap = document.createElement('div');
    wrap.className = 'roadmap-matrix-wrap';

    const table = document.createElement('table');
    table.className = 'roadmap-matrix';

    // 固定表頭
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['公司', 'Q1', 'Q2', 'Q3', 'Q4'].forEach((label, i) => {
        const th = document.createElement('th');
        th.textContent = label;
        if (i === 0) th.className = 'col-company';
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    years.forEach(year => {
        // 年份分節行
        const yearRow = document.createElement('tr');
        yearRow.className = 'year-section-row';
        const yearTd = document.createElement('td');
        yearTd.colSpan = 5;
        yearTd.className = 'year-section-label';
        yearTd.textContent = year;
        yearRow.appendChild(yearTd);
        tbody.appendChild(yearRow);

        const yearEntries = entries.filter(e => e.year === year);

        companyIds.forEach(companyId => {
            const companyData = roadmapsData[companyId];
            if (!companyData) return;

            const tr = document.createElement('tr');
            tr.className = 'company-row';

            // 公司名
            const tdName = document.createElement('td');
            tdName.className = 'company-name-cell';
            const nameSpan = document.createElement('span');
            nameSpan.className = `company-label ${companyId}`;
            nameSpan.textContent = companyData.company || companyId;
            tdName.appendChild(nameSpan);
            tr.appendChild(tdName);

            // Q1–Q4
            ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
                const td = document.createElement('td');
                const chip = yearEntries.find(
                    e => e.companyId === companyId && e.quarter === q
                );

                if (chip) {
                    td.className = 'chip-cell';
                    td.setAttribute('role', 'button');
                    td.setAttribute('tabindex', '0');
                    td.setAttribute('aria-label',
                        `${chip.product} — ${companyData.company} ${year} ${q}`);

                    const tag = document.createElement('span');
                    tag.className = `chip-tag company-chip-${companyId}`;
                    tag.textContent = chip.product;
                    td.appendChild(tag);

                    const open = () => showChipPopup(chip, companyData.company);
                    td.addEventListener('click', open);
                    td.addEventListener('keydown', e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault(); open();
                        }
                    });
                } else {
                    td.className = 'empty-cell';
                    td.setAttribute('aria-hidden', 'true');
                }

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
}

function showChipPopup(chip, companyName) {
    document.querySelector('.chip-popup-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'chip-popup-overlay';

    const popup = document.createElement('div');
    popup.className = 'chip-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'chip-popup-close';
    closeBtn.setAttribute('aria-label', '關閉');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => overlay.remove());

    const header = document.createElement('div');
    header.className = 'chip-popup-header';
    header.textContent = `${companyName} · ${chip.year}${chip.quarter ? ' ' + chip.quarter : ''}`;

    const title = document.createElement('div');
    title.className = 'chip-popup-title';
    title.textContent = chip.product;

    const divider = document.createElement('div');
    divider.className = 'chip-popup-divider';

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
