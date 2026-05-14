/**
 * Company Intelligence Directory — V2 (Signals-derived)
 *
 * Shows company master list enriched with live signal metadata:
 *   - signal count
 *   - latest signal date
 *   - highest ABF impact
 *   - primary chip count
 *
 * Click-through goes to company-signals.html?id=<company_id>.
 * The old static detail modal is no longer the primary path.
 */

const COMPANIES_PAGE_SIZE = 15;
let currentPage = 0;
let allFilteredCompanies = [];

/**
 * Build a map of company_id → signal summary metrics.
 *
 * @param {Array} signals — normalized signal array
 * @returns {Object} { [companyId]: { count, latestDate, highestImpact, chips } }
 */
function buildSignalMetrics(signals) {
    const IMPACT_RANK = { explosive: 4, high: 3, medium: 2, low: 1 };
    const IMPACT_REVERSE = { 4: 'explosive', 3: 'high', 2: 'medium', 1: 'low' };
    const metrics = {};

    for (const s of signals) {
        const cid = s.company_id;
        if (!cid) continue;
        if (!metrics[cid]) {
            metrics[cid] = { count: 0, latestDate: '', highestImpact: 0, chips: new Set() };
        }
        const m = metrics[cid];
        m.count++;
        const chipName = s.chip_name || '';
        if (chipName) m.chips.add(chipName);

        // Latest date: prefer last_verified_at, fall back to updatedAt/createdAt
        const d = s.last_verified_at || s.updatedAt || s.createdAt || '';
        if (d > m.latestDate) m.latestDate = d;

        // Highest ABF impact
        const rank = IMPACT_RANK[s.abf_demand_impact] || 0;
        if (rank > m.highestImpact) m.highestImpact = rank;
    }

    // Convert Set to count and rank back to label
    for (const cid of Object.keys(metrics)) {
        metrics[cid].chipCount = metrics[cid].chips.size;
        metrics[cid].highestImpactLabel = IMPACT_REVERSE[metrics[cid].highestImpact] || '';
        delete metrics[cid].chips;
    }

    return metrics;
}

function renderCompaniesGrid(companiesData, filter = 'all', searchTerm = '', signalMetrics = {}) {
    const container = document.getElementById('companiesGrid');
    if (!container) return;

    container.innerHTML = '';
    currentPage = 0;

    const companies = Array.isArray(companiesData) ? companiesData : Object.values(companiesData);

    // Attach signal metrics to each company
    const enriched = companies.map(c => ({
        ...c,
        _signalMetrics: signalMetrics[c.id] || { count: 0, latestDate: '', highestImpact: 0, highestImpactLabel: '', chipCount: 0 },
    }));

    // Filter
    allFilteredCompanies = enriched.filter(company => {
        if (filter !== 'all') {
            if (filter === 'china') {
                if (company.region !== 'China' && company.country !== '中国') return false;
            } else if (filter === 'overseas') {
                if (company.region === 'China' || company.country === '中国') return false;
            } else if (filter === 'usa') {
                if (company.region !== 'USA' && company.country !== '美国' && company.country !== '美國') return false;
            } else if (filter === 'taiwan') {
                if (company.region !== 'Taiwan' && company.country !== '台湾' && company.country !== '台灣') return false;
            } else if (filter === 'japan') {
                if (company.region !== 'Japan' && company.country !== '日本') return false;
            } else if (filter === 'korea') {
                if (company.region !== 'Korea' && company.country !== '韩国' && company.country !== '韓國') return false;
            } else if (filter === 'foundry') {
                const cat = (company.category || '').toLowerCase();
                if (!cat.includes('foundry') && !cat.includes('代工') && !cat.includes('製造')) return false;
            } else if (filter === 'memory') {
                const cat = (company.category || '').toLowerCase();
                if (!cat.includes('memory') && !cat.includes('記憶') && !cat.includes('存储')) return false;
            } else if (filter === 'substrate') {
                const cat = (company.category || '').toLowerCase();
                if (!cat.includes('substrate') && !cat.includes('abf') && !cat.includes('载板') && !cat.includes('載板')) return false;
            } else if (filter === 'osat') {
                const cat = (company.category || '').toLowerCase();
                if (!cat.includes('osat') && !cat.includes('封装') && !cat.includes('封裝') && !cat.includes('package')) return false;
            }
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const nameMatch = (company.name_en || '').toLowerCase().includes(term) ||
                             (company.name_cn || '').toLowerCase().includes(term);
            const productMatch = (company.products || []).some(p =>
                p.toLowerCase().includes(term)
            );
            if (!nameMatch && !productMatch) return false;
        }

        return true;
    });

    renderCurrentPage(container, signalMetrics);
    updateLoadMoreButton(container);
}

function renderCurrentPage(container, signalMetrics) {
    const start = currentPage * COMPANIES_PAGE_SIZE;
    const end = start + COMPANIES_PAGE_SIZE;
    const pageCompanies = allFilteredCompanies.slice(start, end);

    pageCompanies.forEach(company => {
        const card = buildCompanyCard(company);
        container.appendChild(card);
    });
}

function formatDateShort(d) {
    if (!d) return '—';
    try { return new Date(d).toISOString().slice(0, 10); } catch { return '—'; }
}

const IMPACT_LABELS = { explosive: '爆炸性', high: '高', medium: '中', low: '低' };

function buildCompanyCard(company) {
    const card = document.createElement('div');
    card.className = 'company-card';
    card.setAttribute('data-company', company.id);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `查看 ${company.name_en || company.name_cn || company.id} 的信號`);

    const metrics = company._signalMetrics || {};
    const signalCount = metrics.count || 0;
    const latestDate = metrics.latestDate || '';
    const highestImpact = metrics.highestImpactLabel || '';
    const chipCount = metrics.chipCount || 0;

    // Header
    const header = document.createElement('div');
    header.className = 'company-card-header';

    const nameGroup = document.createElement('div');

    const h3 = document.createElement('h3');
    h3.className = 'company-name';
    h3.textContent = company.name_en || company.name_cn || company.id;
    nameGroup.appendChild(h3);

    if (company.name_cn) {
        const subName = document.createElement('p');
        subName.style.fontSize = '12px';
        subName.style.color = 'var(--text-secondary, #888)';
        subName.textContent = company.name_cn;
        nameGroup.appendChild(subName);
    }

    header.appendChild(nameGroup);

    const regionTag = document.createElement('span');
    regionTag.className = 'company-region';
    regionTag.textContent = company.region || company.country || '未知';
    header.appendChild(regionTag);

    card.appendChild(header);

    // Category tag (operational, not editorial)
    if (company.category) {
        const category = document.createElement('p');
        category.className = 'company-category';
        category.textContent = company.category;
        card.appendChild(category);
    }

    // Signal-driven metrics (replaces V1 description/market_position prose)
    const metricsDiv = document.createElement('div');
    metricsDiv.className = 'company-metrics';

    // Metric 1: Signal count
    const m1 = document.createElement('div');
    m1.className = 'metric';
    const l1 = document.createElement('span');
    l1.className = 'metric-label';
    l1.textContent = '信號';
    const v1 = document.createElement('span');
    v1.className = 'metric-value';
    v1.textContent = signalCount > 0 ? signalCount : '—';
    m1.appendChild(l1);
    m1.appendChild(v1);
    metricsDiv.appendChild(m1);

    // Metric 2: Latest signal date
    const m2 = document.createElement('div');
    m2.className = 'metric';
    const l2 = document.createElement('span');
    l2.className = 'metric-label';
    l2.textContent = '最新信號';
    const v2 = document.createElement('span');
    v2.className = 'metric-value';
    v2.textContent = signalCount > 0 ? formatDateShort(latestDate) : '—';
    m2.appendChild(l2);
    m2.appendChild(v2);
    metricsDiv.appendChild(m2);

    // Metric 3: Highest ABF impact
    const m3 = document.createElement('div');
    m3.className = 'metric';
    const l3 = document.createElement('span');
    l3.className = 'metric-label';
    l3.textContent = '最高 ABF';
    const v3 = document.createElement('span');
    v3.className = 'metric-value';
    v3.textContent = highestImpact ? IMPACT_LABELS[highestImpact] : '—';
    m3.appendChild(l3);
    m3.appendChild(v3);
    metricsDiv.appendChild(m3);

    // Metric 4: Chip count
    const m4 = document.createElement('div');
    m4.className = 'metric';
    const l4 = document.createElement('span');
    l4.className = 'metric-label';
    l4.textContent = '芯片';
    const v4 = document.createElement('span');
    v4.className = 'metric-value';
    v4.textContent = chipCount > 0 ? chipCount : '—';
    m4.appendChild(l4);
    m4.appendChild(v4);
    metricsDiv.appendChild(m4);

    card.appendChild(metricsDiv);

    // Click-through to company intelligence page
    card.addEventListener('click', () => {
        window.location.href = `company-signals.html?id=${encodeURIComponent(company.id)}`;
    });

    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.location.href = `company-signals.html?id=${encodeURIComponent(company.id)}`;
        }
    });

    return card;
}

function updateLoadMoreButton(container) {
    const existingBtn = document.getElementById('loadMoreBtn');
    const hasMore = (currentPage + 1) * COMPANIES_PAGE_SIZE < allFilteredCompanies.length;

    if (hasMore) {
        if (!existingBtn) {
            const btn = document.createElement('button');
            btn.id = 'loadMoreBtn';
            btn.className = 'load-more-btn';
            btn.textContent = '加载更多公司';
            btn.setAttribute('aria-label', '加载更多公司');
            btn.addEventListener('click', () => {
                currentPage++;
                renderCurrentPage(container);
                updateLoadMoreButton(container);
            });
            container.after(btn);
        }
    } else {
        if (existingBtn) {
            existingBtn.remove();
        }
    }

    if (allFilteredCompanies.length === 0) {
        const msg = document.createElement('p');
        msg.style.textAlign = 'center';
        msg.style.color = 'var(--text-muted, #888)';
        msg.textContent = '暫無匹配的公司';
        container.appendChild(msg);
    }
}

function resetPagination() {
    currentPage = 0;
    allFilteredCompanies = [];
    const existingBtn = document.getElementById('loadMoreBtn');
    if (existingBtn) {
        existingBtn.remove();
    }
}

export { renderCompaniesGrid, resetPagination, COMPANIES_PAGE_SIZE, buildSignalMetrics };
