// ==================== //
// Data & State
// ==================== //
let allCompanies = [];
let filteredCompanies = [];
let categories = new Set();

// ==================== //
// DOM Elements
// ==================== //
const searchInput = document.getElementById('searchInput');
const regionFilter = document.getElementById('regionFilter');
const categoryFilter = document.getElementById('categoryFilter');
const abfFilter = document.getElementById('abfFilter');
const listingFilter = document.getElementById('listingFilter');
const resetFiltersBtn = document.getElementById('resetFilters');
const companiesGrid = document.getElementById('companiesGrid');
const loadingEl = document.getElementById('loading');
const noResultsEl = document.getElementById('noResults');
const resultsCountEl = document.getElementById('resultsCount');
const modal = document.getElementById('companyModal');
const modalClose = document.getElementById('modalClose');
const modalOverlay = modal.querySelector('.modal-overlay');

// Stats elements
const totalCountEl = document.getElementById('totalCount');
const chinaCountEl = document.getElementById('chinaCount');
const globalCountEl = document.getElementById('globalCount');
const listedCountEl = document.getElementById('listedCount');

// ==================== //
// Data Loading
// ==================== //
async function loadData() {
    try {
        showLoading(true);
        
        const [chinaRes, globalRes] = await Promise.all([
            fetch('data/china_companies.json'),
            fetch('data/global_companies.json')
        ]);
        
        const chinaData = await chinaRes.json();
        const globalData = await globalRes.json();
        
        // Normalize data structure
        const normalizedChina = chinaData.map(c => normalizeCompany(c, 'china'));
        const normalizedGlobal = globalData.map(c => normalizeCompany(c, 'global'));
        
        allCompanies = [...normalizedChina, ...normalizedGlobal];
        
        // Extract categories
        allCompanies.forEach(c => {
            if (c.category) categories.add(c.category);
        });
        
        populateCategoryFilter();
        updateStats();
        filterAndRender();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('数据加载失败，请刷新页面重试');
    } finally {
        showLoading(false);
    }
}

function normalizeCompany(company, region) {
    // Handle China companies
    if (region === 'china') {
        return {
            id: generateId(),
            name: company.company_cn || company.company_name || '',
            nameEn: company.company_en || '',
            region: 'china',
            category: company.category || company.type || '',
            products: company.main_products || '',
            stockCode: company.stock_code || '',
            establishmentYear: company.establishment_year || '',
            headquarters: company.headquarters || '',
            benchmark: company.benchmark_company || '',
            benchmarkProducts: company.benchmark_products || '',
            abfRelevance: company.abf_relevance || '',
            marketPosition: company.market_position || '',
            listingStatus: company.listing_status || '',
            dataSource: company.data_source || ''
        };
    }
    
    // Handle Global companies
    return {
        id: generateId(),
        name: company.company_name || '',
        nameEn: company.company_name || '',
        region: 'global',
        category: company.type || '',
        products: company.main_products || '',
        country: company.country || '',
        timeline: company.timeline || '',
        benchmark: company.benchmark_products || '',
        abfRelevance: company.abf_demand || '',
        marketPosition: company.market_position || '',
        dataSource: company.data_source || ''
    };
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// ==================== //
// Filtering
// ==================== //
function filterAndRender() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const regionValue = regionFilter.value;
    const categoryValue = categoryFilter.value;
    const abfValue = abfFilter.value;
    const listingValue = listingFilter.value;
    
    filteredCompanies = allCompanies.filter(company => {
        // Search filter
        if (searchTerm) {
            const searchFields = [
                company.name,
                company.nameEn,
                company.products,
                company.headquarters,
                company.country,
                company.category,
                company.benchmark
            ].filter(Boolean).join(' ').toLowerCase();
            
            if (!searchFields.includes(searchTerm)) {
                return false;
            }
        }
        
        // Region filter
        if (regionValue !== 'all' && company.region !== regionValue) {
            return false;
        }
        
        // Category filter
        if (categoryValue !== 'all' && company.category !== categoryValue) {
            return false;
        }
        
        // ABF filter
        if (abfValue !== 'all') {
            const abf = company.abfRelevance || '';
            if (!abf.includes(abfValue)) {
                return false;
            }
        }
        
        // Listing filter
        if (listingValue !== 'all') {
            const isListed = (company.listingStatus || '').includes('上市公司');
            if (listingValue === 'listed' && !isListed) return false;
            if (listingValue === 'unlisted' && isListed) return false;
        }
        
        return true;
    });
    
    renderCompanies(searchTerm);
    updateResultsCount();
}

// ==================== //
// Rendering
// ==================== //
function renderCompanies(searchTerm = '') {
    companiesGrid.innerHTML = '';
    
    if (filteredCompanies.length === 0) {
        noResultsEl.style.display = 'block';
        return;
    }
    
    noResultsEl.style.display = 'none';
    
    filteredCompanies.forEach(company => {
        const card = createCompanyCard(company, searchTerm);
        companiesGrid.appendChild(card);
    });
}

function createCompanyCard(company, searchTerm = '') {
    const card = document.createElement('div');
    card.className = 'company-card';
    card.dataset.id = company.id;
    
    const abfClass = getAbfClass(company.abfRelevance);
    const isListed = (company.listingStatus || '').includes('上市公司');
    
    const displayName = highlightText(company.name, searchTerm);
    const displayNameEn = highlightText(company.nameEn, searchTerm);
    const displayProducts = highlightText(company.products, searchTerm);
    
    card.innerHTML = `
        <div class="card-header">
            <div>
                <div class="company-name">${displayName}</div>
                ${company.nameEn && company.nameEn !== company.name ? 
                    `<div class="company-name-en">${displayNameEn}</div>` : ''}
            </div>
            <span class="region-badge ${company.region}">
                ${company.region === 'china' ? '中国' : company.country || '海外'}
            </span>
        </div>
        <div class="card-body">
            <div class="card-row">
                <span class="label">类型</span>
                <span class="value">${company.category || '-'}</span>
            </div>
            <div class="card-row">
                <span class="label">产品</span>
                <span class="value">${displayProducts || '-'}</span>
            </div>
            ${company.headquarters ? `
            <div class="card-row">
                <span class="label">总部</span>
                <span class="value">${company.headquarters}</span>
            </div>
            ` : ''}
            ${company.stockCode && company.stockCode !== '未上市' ? `
            <div class="card-row">
                <span class="label">股票代码</span>
                <span class="value highlight">${company.stockCode}</span>
            </div>
            ` : ''}
        </div>
        <div class="card-footer">
            ${company.abfRelevance ? `<span class="tag ${abfClass}">ABF: ${extractAbfLevel(company.abfRelevance)}</span>` : ''}
            ${isListed ? '<span class="tag listed">上市公司</span>' : ''}
            ${company.category ? `<span class="tag">${company.category}</span>` : ''}
        </div>
    `;
    
    card.addEventListener('click', () => openModal(company));
    
    return card;
}

function highlightText(text, searchTerm) {
    if (!text || !searchTerm) return text || '';
    
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    return text.replace(regex, '<span class="highlight-text">$1</span>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAbfClass(abfRelevance) {
    if (!abfRelevance) return '';
    if (abfRelevance.includes('高')) return 'abf-high';
    if (abfRelevance.includes('中')) return 'abf-medium';
    return 'abf-low';
}

function extractAbfLevel(abfRelevance) {
    if (!abfRelevance) return '-';
    if (abfRelevance.includes('高')) return '高';
    if (abfRelevance.includes('中')) return '中';
    if (abfRelevance.includes('低')) return '低';
    return abfRelevance;
}

// ==================== //
// Modal
// ==================== //
function openModal(company) {
    const modalCompanyName = document.getElementById('modalCompanyName');
    const modalRegion = document.getElementById('modalRegion');
    const modalBody = document.getElementById('modalBody');
    
    modalCompanyName.textContent = `${company.name}${company.nameEn && company.nameEn !== company.name ? ` (${company.nameEn})` : ''}`;
    
    modalRegion.textContent = company.region === 'china' ? '中国' : (company.country || '海外');
    modalRegion.className = `modal-region region-badge ${company.region}`;
    
    const details = [];
    
    if (company.category) details.push({ label: '类型', value: company.category });
    if (company.products) details.push({ label: '主要产品', value: company.products });
    if (company.headquarters) details.push({ label: '总部', value: company.headquarters });
    if (company.country && company.region === 'global') details.push({ label: '国家', value: company.country });
    if (company.establishmentYear) details.push({ label: '成立时间', value: company.establishmentYear });
    if (company.stockCode && company.stockCode !== '未上市') details.push({ label: '股票代码', value: company.stockCode, highlight: true });
    if (company.listingStatus) details.push({ label: '上市状态', value: company.listingStatus });
    if (company.benchmark) details.push({ label: '对标公司', value: company.benchmark });
    if (company.benchmarkProducts) details.push({ label: '对标产品', value: company.benchmarkProducts });
    if (company.abfRelevance) details.push({ label: 'ABF相关度', value: company.abfRelevance });
    if (company.marketPosition) details.push({ label: '市场地位', value: company.marketPosition });
    if (company.timeline) details.push({ label: '时间线', value: company.timeline });
    if (company.dataSource) details.push({ label: '数据来源', value: company.dataSource });
    
    modalBody.innerHTML = details.map(d => `
        <div class="detail-row">
            <span class="detail-label">${d.label}</span>
            <span class="detail-value ${d.highlight ? 'highlight' : ''}">${d.value}</span>
        </div>
    `).join('');
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// ==================== //
// Stats & UI Updates
// ==================== //
function updateStats() {
    const chinaCount = allCompanies.filter(c => c.region === 'china').length;
    const globalCount = allCompanies.filter(c => c.region === 'global').length;
    const listedCount = allCompanies.filter(c => (c.listingStatus || '').includes('上市公司')).length;
    
    animateNumber(totalCountEl, allCompanies.length);
    animateNumber(chinaCountEl, chinaCount);
    animateNumber(globalCountEl, globalCount);
    animateNumber(listedCountEl, listedCount);
}

function animateNumber(element, target) {
    const duration = 1000;
    const start = parseInt(element.textContent) || 0;
    const increment = (target - start) / (duration / 16);
    let current = start;
    
    const animate = () => {
        current += increment;
        if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
            element.textContent = target;
        } else {
            element.textContent = Math.floor(current);
            requestAnimationFrame(animate);
        }
    };
    
    animate();
}

function updateResultsCount() {
    resultsCountEl.textContent = `显示 ${filteredCompanies.length} 家公司`;
}

function populateCategoryFilter() {
    const sortedCategories = Array.from(categories).sort();
    sortedCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
}

function showLoading(show) {
    loadingEl.style.display = show ? 'block' : 'none';
    companiesGrid.style.display = show ? 'none' : 'grid';
}

function showError(message) {
    companiesGrid.innerHTML = `<div class="no-results"><p>${message}</p></div>`;
}

function resetFilters() {
    searchInput.value = '';
    regionFilter.value = 'all';
    categoryFilter.value = 'all';
    abfFilter.value = 'all';
    listingFilter.value = 'all';
    filterAndRender();
}

// ==================== //
// Event Listeners
// ==================== //
searchInput.addEventListener('input', debounce(filterAndRender, 300));
regionFilter.addEventListener('change', filterAndRender);
categoryFilter.addEventListener('change', filterAndRender);
abfFilter.addEventListener('change', filterAndRender);
listingFilter.addEventListener('change', filterAndRender);
resetFiltersBtn.addEventListener('click', resetFilters);
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Stat card click filters
document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => {
        const stat = card.dataset.stat;
        if (stat === 'china') {
            regionFilter.value = 'china';
        } else if (stat === 'global') {
            regionFilter.value = 'global';
        } else if (stat === 'listed') {
            listingFilter.value = 'listed';
        } else {
            regionFilter.value = 'all';
            listingFilter.value = 'all';
        }
        filterAndRender();
    });
});

// ==================== //
// Utilities
// ==================== //
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==================== //
// Initialize
// ==================== //
document.addEventListener('DOMContentLoaded', loadData);
