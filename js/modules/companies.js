/**
 * 公司分析模块 - 渲染、筛选、分页
 * 使用安全的 DOM 方法（textContent + createElement），避免 innerHTML XSS
 */

const COMPANIES_PAGE_SIZE = 15;
let currentPage = 0;
let allFilteredCompanies = [];

function renderCompaniesGrid(companiesData, filter = 'all', searchTerm = '') {
    const container = document.getElementById('companiesGrid');
    if (!container) return;

    // 清空容器
    container.innerHTML = '';
    currentPage = 0;

    const companies = Array.isArray(companiesData) ? companiesData : Object.values(companiesData);

    // 按筛选条件过滤
    allFilteredCompanies = companies.filter(company => {
        // 区域筛选
        if (filter !== 'all') {
            if (filter === 'china') {
                if (company.region !== 'China' && company.country !== '中国') return false;
            } else if (filter === 'overseas') {
                if (company.region === 'China' || company.country === '中国') return false;
            }
        }

        // 搜索过滤
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

    renderCurrentPage(container, companiesData);
    updateLoadMoreButton(container, companiesData);
}

function renderCurrentPage(container, companiesData) {
    const start = currentPage * COMPANIES_PAGE_SIZE;
    const end = start + COMPANIES_PAGE_SIZE;
    const pageCompanies = allFilteredCompanies.slice(start, end);

    pageCompanies.forEach(company => {
        const card = buildCompanyCard(company);
        container.appendChild(card);
    });
}

function buildCompanyCard(company) {
    const card = document.createElement('div');
    card.className = 'company-card';
    card.setAttribute('data-company', company.id);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `查看 ${company.name_en || company.name_cn || company.id} 的详细信息`);

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
        subName.style.color = 'var(--text-muted, #888)';
        subName.textContent = company.name_cn;
        nameGroup.appendChild(subName);
    }

    header.appendChild(nameGroup);

    const regionTag = document.createElement('span');
    regionTag.className = 'company-region';
    regionTag.textContent = company.region || company.country || '未知';
    header.appendChild(regionTag);

    card.appendChild(header);

    // Category
    if (company.category) {
        const category = document.createElement('p');
        category.className = 'company-category';
        category.textContent = company.category;
        card.appendChild(category);
    }

    // Description
    const desc = document.createElement('p');
    desc.className = 'company-description';
    desc.textContent = company.description || company.market_position || '暂无描述';
    card.appendChild(desc);

    // Metrics
    const metrics = document.createElement('div');
    metrics.className = 'company-metrics';

    const metric1 = document.createElement('div');
    metric1.className = 'metric';
    const label1 = document.createElement('span');
    label1.className = 'metric-label';
    label1.textContent = 'ABF需求';
    const value1 = document.createElement('span');
    value1.className = 'metric-value';
    value1.textContent = company.abf_demand || '未知';
    metric1.appendChild(label1);
    metric1.appendChild(value1);
    metrics.appendChild(metric1);

    const metric2 = document.createElement('div');
    metric2.className = 'metric';
    const label2 = document.createElement('span');
    label2.className = 'metric-label';
    label2.textContent = '市场地位';
    const value2 = document.createElement('span');
    value2.className = 'metric-value';
    const marketPos = company.market_position || '未知';
    value2.textContent = marketPos.length > 15 ? marketPos.substring(0, 15) + '...' : marketPos;
    metric2.appendChild(label2);
    metric2.appendChild(value2);
    metrics.appendChild(metric2);

    card.appendChild(metrics);

    // Products
    const productsDiv = document.createElement('div');
    productsDiv.className = 'company-products';

    const products = (company.products || []).slice(0, 4);
    if (products.length > 0) {
        products.forEach(p => {
            const tag = document.createElement('span');
            tag.className = 'product-tag';
            tag.textContent = p.trim();
            productsDiv.appendChild(tag);
        });
    } else {
        const tag = document.createElement('span');
        tag.className = 'product-tag';
        tag.textContent = '暂无产品';
        productsDiv.appendChild(tag);
    }

    card.appendChild(productsDiv);

    // Click handler
    card.addEventListener('click', () => {
        if (window.showCompanyDetail) {
            window.showCompanyDetail(company.id);
        }
    });

    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (window.showCompanyDetail) {
                window.showCompanyDetail(company.id);
            }
        }
    });

    return card;
}

function updateLoadMoreButton(container, companiesData) {
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
                renderCurrentPage(container, companiesData);
                updateLoadMoreButton(container, companiesData);
            });
            container.after(btn);
        }
    } else {
        if (existingBtn) {
            existingBtn.remove();
        }
    }

    // Show message if no data
    if (allFilteredCompanies.length === 0) {
        const msg = document.createElement('p');
        msg.style.textAlign = 'center';
        msg.style.color = 'var(--text-muted, #888)';
        msg.textContent = '暂无匹配的公司数据';
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

export { renderCompaniesGrid, resetPagination, COMPANIES_PAGE_SIZE };
