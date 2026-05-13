/**
 * Roadmap 矩陣表模塊
 * 年份 Tab + 公司 × 季度矩陣，點擊芯片格彈出詳情 popup
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
        msg.style.cssText = 'text-align:center;color:var(--text-muted,#888);padding:40px';
        msg.textContent = '暫無數據';
        container.appendChild(msg);
        return;
    }

    const years = [...new Set(entries.map(e => e.year))].sort((a, b) => a - b);
    const defaultYear = years.includes(2025) ? 2025 : years[0];

    let activeYear = defaultYear;

    const tabsEl = buildYearTabs(years, activeYear, (year) => {
        activeYear = year;
        tableEl.replaceWith(buildMatrix(entries, roadmapsData, activeYear, filterCompany));
        tableEl = container.querySelector('.roadmap-matrix-wrap');
    });

    container.appendChild(tabsEl);

    let tableEl = buildMatrix(entries, roadmapsData, activeYear, filterCompany);
    container.appendChild(tableEl);
}

function buildYearTabs(years, activeYear, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'roadmap-year-tabs';

    years.forEach(year => {
        const btn = document.createElement('button');
        btn.className = 'year-tab' + (year === activeYear ? ' active' : '');
        btn.textContent = year;
        btn.addEventListener('click', () => {
            wrap.querySelectorAll('.year-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onChange(year);
        });
        wrap.appendChild(btn);
    });

    return wrap;
}

function buildMatrix(entries, roadmapsData, year, filterCompany) {
    const wrap = document.createElement('div');
    wrap.className = 'roadmap-matrix-wrap';

    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const yearEntries = entries.filter(e => e.year === year);

    // 決定顯示哪些公司行
    let companyIds = COMPANY_ORDER.filter(id => roadmapsData[id]);
    // 加上不在預設順序裡的公司
    Object.keys(roadmapsData).forEach(id => {
        if (!companyIds.includes(id)) companyIds.push(id);
    });
    if (filterCompany && filterCompany !== 'all') {
        companyIds = companyIds.filter(id => id === filterCompany);
    }

    if (companyIds.length === 0) {
        const msg = document.createElement('p');
        msg.style.cssText = 'text-align:center;color:var(--text-muted,#888);padding:40px';
        msg.textContent = '暫無數據';
        wrap.appendChild(msg);
        return wrap;
    }

    const table = document.createElement('table');
    table.className = 'roadmap-matrix';

    // 表頭
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const thCompany = document.createElement('th');
    thCompany.textContent = '公司';
    headRow.appendChild(thCompany);
    quarters.forEach(q => {
        const th = document.createElement('th');
        th.textContent = q;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // 表身
    const tbody = document.createElement('tbody');
    companyIds.forEach(companyId => {
        const companyData = roadmapsData[companyId];
        if (!companyData) return;

        const tr = document.createElement('tr');

        // 公司名格
        const tdName = document.createElement('td');
        tdName.className = 'company-name-cell';
        const nameSpan = document.createElement('span');
        nameSpan.className = `company-label ${companyId}`;
        nameSpan.textContent = companyData.company || companyId;
        tdName.appendChild(nameSpan);
        tr.appendChild(tdName);

        // 季度格
        quarters.forEach(q => {
            const td = document.createElement('td');
            const chip = yearEntries.find(e => e.companyId === companyId && e.quarter === q);

            if (chip) {
                td.className = 'chip-cell';
                td.setAttribute('role', 'button');
                td.setAttribute('tabindex', '0');
                td.setAttribute('aria-label', `${chip.product} — ${companyData.company} ${year} ${q}`);

                const nameEl = document.createElement('span');
                nameEl.className = 'chip-name';
                nameEl.textContent = chip.product;
                td.appendChild(nameEl);

                const openPopup = () => showChipPopup(chip, companyData.company);
                td.addEventListener('click', openPopup);
                td.addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPopup(); }
                });
            } else {
                td.className = 'empty-cell';
                td.textContent = '—';
                td.setAttribute('aria-hidden', 'true');
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
}

function showChipPopup(chip, companyName) {
    // 移除舊 popup
    document.querySelector('.chip-popup-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'chip-popup-overlay';

    const popup = document.createElement('div');
    popup.className = 'chip-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');

    // 關閉按鈕
    const closeBtn = document.createElement('button');
    closeBtn.className = 'chip-popup-close';
    closeBtn.setAttribute('aria-label', '關閉');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => overlay.remove());

    // Header
    const header = document.createElement('div');
    header.className = 'chip-popup-header';
    header.textContent = `${companyName} · ${chip.year}${chip.quarter ? ' ' + chip.quarter : ''}`;

    // Title
    const title = document.createElement('div');
    title.className = 'chip-popup-title';
    title.textContent = chip.product;

    // Divider
    const divider = document.createElement('div');
    divider.className = 'chip-popup-divider';

    popup.appendChild(closeBtn);
    popup.appendChild(header);
    popup.appendChild(title);
    popup.appendChild(divider);

    // 欄位列表（只顯示有值的）
    const fields = [
        { label: '用途',       value: chip.purpose },
        { label: '製程',       value: chip.process },
        { label: '規格',       value: chip.specs },
        { label: 'CoWoS封裝',  value: chip.cowos === true ? '是' : chip.cowos === false ? '否' : null },
        { label: 'ABF尺寸',    value: chip.abf_size },
        { label: 'ABF層數',    value: chip.abf_layers != null ? chip.abf_layers + ' 層' : null },
    ];

    fields.forEach(({ label, value }) => {
        if (!value) return;
        const row = document.createElement('div');
        row.className = 'chip-popup-field';

        const labelEl = document.createElement('span');
        labelEl.className = 'chip-popup-field-label';
        labelEl.textContent = label;

        const valueEl = document.createElement('span');
        valueEl.className = 'chip-popup-field-value';
        valueEl.textContent = value;

        row.appendChild(labelEl);
        row.appendChild(valueEl);
        popup.appendChild(row);
    });

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // 點遮罩關閉
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // ESC 關閉
    const onKey = e => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    closeBtn.focus();
}

export { renderTimeline };
