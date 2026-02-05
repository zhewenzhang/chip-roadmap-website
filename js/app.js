/**
 * 芯片产业分析平台 - 功能逻辑
 */

// ============== 全局数据 ==============
let companiesData = {};
let roadmapsData = {};
let marketData = {};
let insightsData = {};

// ============== 初始化 ==============
document.addEventListener('DOMContentLoaded', function() {
    loadAllData();
    initSearch();
    initFilters();
});

// ============== 数据加载 ==============
async function loadAllData() {
    try {
        // 并行加载所有 JSON 数据
        const [companiesRes, roadmapsRes, marketRes, insightsRes] = await Promise.all([
            fetch('data/companies.json'),
            fetch('data/roadmaps.json'),
            fetch('data/market.json'),
            fetch('data/insights.json')
        ]);

        companiesData = await companiesRes.json();
        roadmapsData = await roadmapsRes.json();
        marketData = await marketRes.json();
        insightsData = await insightsRes.json();

        console.log('数据加载完成:', {
            companies: Object.keys(companiesData).length,
            roadmaps: Object.keys(roadmapsData).length
        });

        // 根据页面类型初始化特定功能
        initPageSpecific();
    } catch (error) {
        console.error('数据加载失败:', error);
        showNotification('数据加载失败，请刷新页面重试', 'error');
    }
}

// ============== 页面特定初始化 ==============
function initPageSpecific() {
    const path = window.location.pathname;
    
    if (path.includes('roadmap.html')) {
        initRoadmapPage();
    } else if (path.includes('companies.html')) {
        initCompaniesPage();
    } else if (path.includes('insights.html')) {
        initInsightsPage();
    } else {
        initHomePage();
    }
}

// ============== 首页初始化 ==============
function initHomePage() {
    // 首页数据由 HTML 静态渲染
    console.log('首页初始化完成');
}

// ============== Roadmap 页面初始化 ==============
function initRoadmapPage() {
    renderTimeline();
}

function renderTimeline(filterCompany = null) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    let timelineHTML = '<div class="timeline">';
    
    // 收集所有 roadmap 数据
    const allTimelines = [];
    
    Object.entries(roadmapsData).forEach(([companyId, data]) => {
        if (!data.timeline) return;
        
        if (filterCompany && companyId !== filterCompany) return;
        
        data.timeline.forEach(item => {
            allTimelines.push({
                company: data.company,
                companyId: companyId,
                ...item
            });
        });
    });

    // 按年份和季度排序
    allTimelines.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return (b.quarter || 'Q4').localeCompare(a.quarter || 'Q4');
    });

    // 渲染时间线项目
    allTimelines.forEach((item, index) => {
        const companyClass = item.companyId.toLowerCase();
        
        timelineHTML += `
            <div class="timeline-item">
                <div class="timeline-content">
                    <span class="timeline-year">${item.year} ${item.quarter || ''}</span>
                    <span class="timeline-company ${companyClass}">${item.company}</span>
                    <h3 class="timeline-product">${item.product}</h3>
                    ${item.specs ? `<p class="timeline-specs">${item.specs}</p>` : ''}
                    ${item.process ? `<p class="timeline-process">${item.process}</p>` : ''}
                </div>
            </div>
        `;
    });

    timelineHTML += '</div>';
    container.innerHTML = timelineHTML || '<p style="text-align:center;color:var(--text-muted);">暂无数据</p>';
}

// ============== 公司页面初始化 ==============
function initCompaniesPage() {
    renderCompaniesGrid();
}

function renderCompaniesGrid(filter = 'all', searchTerm = '') {
    const container = document.getElementById('companiesGrid');
    if (!container) return;

    let companiesHTML = '';
    const companies = Object.values(companiesData);
    
    // 按筛选条件过滤
    const filteredCompanies = companies.filter(company => {
        // 区域筛选
        if (filter !== 'all') {
            if (filter === 'china' && company.region !== 'China') return false;
            if (filter === 'overseas' && company.region === 'China') return false;
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

    // 渲染公司卡片
    filteredCompanies.forEach(company => {
        const regionClass = (company.region || '').toLowerCase();
        const productsHTML = (company.products || []).slice(0, 4).map(p => 
            `<span class="product-tag">${p.trim()}</span>`
        ).join('');

        companiesHTML += `
            <div class="company-card" data-company="${company.id}">
                <div class="company-card-header">
                    <div>
                        <h3 class="company-name">${company.name_en || company.name_cn || company.id}</h3>
                        ${company.name_cn ? `<p style="font-size:12px;color:var(--text-muted);">${company.name_cn}</p>` : ''}
                    </div>
                    <span class="company-region">${company.region || company.country || '未知'}</span>
                </div>
                <p class="company-category">${company.category || '半导体公司'}</p>
                <p class="company-description">${company.description || company.market_position || '暂无描述'}</p>
                <div class="company-metrics">
                    <div class="metric">
                        <span class="metric-label">ABF需求</span>
                        <span class="metric-value">${company.abf_demand || '未知'}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">市场地位</span>
                        <span class="metric-value">${company.market_position ? company.market_position.substring(0, 15) + '...' : '未知'}</span>
                    </div>
                </div>
                <div class="company-products">
                    ${productsHTML || '<span class="product-tag">暂无产品</span>'}
                </div>
            </div>
        `;
    });

    container.innerHTML = companiesHTML || '<p style="text-align:center;color:var(--text-muted);">暂无匹配的公司数据</p>';
    
    // 添加点击事件
    container.querySelectorAll('.company-card').forEach(card => {
        card.addEventListener('click', () => showCompanyDetail(card.dataset.company));
    });
}

function showCompanyDetail(companyId) {
    const company = companiesData[companyId];
    if (!company) return;

    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close">&times;</button>
            <h2>${company.name_en || company.name_cn || companyId}</h2>
            ${company.name_cn ? `<p style="color:var(--text-muted);">${company.name_cn}</p>` : ''}
            
            <div class="modal-section">
                <h4>基本信息</h4>
                <p><strong>国家/地区:</strong> ${company.country || '未知'}</p>
                <p><strong>总部:</strong> ${company.headquarters || '未知'}</p>
                <p><strong>类型:</strong> ${company.category || '未知'}</p>
                <p><strong>市场地位:</strong> ${company.market_position || '未知'}</p>
            </div>
            
            ${company.products && company.products.length > 0 ? `
                <div class="modal-section">
                    <h4>主要产品</h4>
                    <div class="company-products">
                        ${company.products.map(p => `<span class="product-tag">${p.trim()}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${company.roadmap && company.roadmap.length > 0 ? `
                <div class="modal-section">
                    <h4>Roadmap</h4>
                    <ul style="list-style:none;padding:0;">
                        ${company.roadmap.map(r => `
                            <li style="padding:8px 0;border-bottom:1px solid var(--border-color);">
                                <strong>${r.year}</strong> ${r.quarter || ''} - ${r.product}
                                <br><span style="color:var(--text-muted);font-size:12px;">${r.process || ''}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
            
            ${company.analysis && Object.keys(company.analysis).length > 0 ? `
                <div class="modal-section">
                    <h4>SWOT 分析</h4>
                    <p><strong>优势:</strong> ${company.analysis.strengths?.join(', ') || '暂无'}</p>
                    <p><strong>劣势:</strong> ${company.analysis.weaknesses?.join(', ') || '暂无'}</p>
                    <p><strong>机会:</strong> ${company.analysis.opportunities?.join(', ') || '暂无'}</p>
                    <p><strong>威胁:</strong> ${company.analysis.threats?.join(', ') || '暂无'}</p>
                </div>
            ` : ''}
        </div>
    `;

    document.body.appendChild(modal);

    // 关闭模态框
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
}

// ============== 洞察页面初始化 ==============
function initInsightsPage() {
    renderTrends();
    renderTopPlayers();
    renderABFAnalysis();
    renderKeyInsights();
}

function renderTrends() {
    const container = document.getElementById('trendsContainer');
    if (!container || !insightsData.trends) return;

    container.innerHTML = insightsData.trends.map(trend => `
        <div class="trend-card">
            <h3>${trend.title}</h3>
            <p>${trend.description}</p>
            <span class="insight-impact ${trend.impact?.toLowerCase() || 'medium'}">${trend.impact || '中'} 影响</span>
            <div class="trend-companies" style="margin-top:16px;">
                ${trend.companies?.map(c => `<span class="company-chip">${c}</span>`).join('') || ''}
            </div>
        </div>
    `).join('');
}

function renderTopPlayers() {
    const container = document.getElementById('topPlayersContainer');
    if (!container || !insightsData.top_players) return;

    container.innerHTML = insightsData.top_players.map((player, index) => `
        <div class="player-card">
            <div class="player-header">
                <h3 class="player-name">${index + 1}. ${player.name}</h3>
                <span class="player-share">${player.market_share}</span>
            </div>
            <div class="player-section">
                <h4>核心优势</h4>
                <p>${player.strength}</p>
            </div>
            <div class="player-section">
                <h4>主要弱点</h4>
                <p>${player.weakness || '暂无'}</p>
            </div>
            <div class="player-section">
                <h4>前景展望</h4>
                <p class="player-outlook">${player.outlook}</p>
            </div>
        </div>
    `).join('');
}

function renderABFAnalysis() {
    const container = document.getElementById('abfAnalysisContainer');
    if (!container || !insightsData.abf_demand_analysis) return;

    const analysis = insightsData.abf_demand_analysis;
    
    container.innerHTML = `
        <div class="abf-tier high">
            <h3>高需求</h3>
            ${Object.entries(analysis.high_demand || {}).map(([name, data]) => `
                <div class="abf-item">
                    <h4>${name}</h4>
                    <p>ABF层数: ${data.abf_layers}</p>
                    <p>价格区间: ${data.price_range}</p>
                </div>
            `).join('')}
        </div>
        <div class="abf-tier medium">
            <h3>中需求</h3>
            ${Object.entries(analysis.medium_demand || {}).map(([name, data]) => `
                <div class="abf-item">
                    <h4>${name}</h4>
                    <p>ABF层数: ${data.abf_layers}</p>
                    <p>价格区间: ${data.price_range}</p>
                </div>
            `).join('')}
        </div>
        <div class="abf-tier low">
            <h3>低需求</h3>
            ${Object.entries(analysis.low_demand || {}).map(([name, data]) => `
                <div class="abf-item">
                    <h4>${name}</h4>
                    <p>ABF层数: ${data.abf_layers}</p>
                    <p>价格区间: ${data.price_range}</p>
                </div>
            `).join('')}
        </div>
    `;
}

function renderKeyInsights() {
    const container = document.getElementById('keyInsightsList');
    if (!container || !insightsData.key_insights) return;

    container.innerHTML = insightsData.key_insights.map(insight => `
        <li>${insight}</li>
    `).join('');
}

// ============== 搜索功能 ==============
function initSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const term = e.target.value.trim();
            
            // 如果在公司页面，实时过滤
            if (window.location.pathname.includes('companies.html')) {
                const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
                renderCompaniesGrid(activeFilter, term);
            }
        }, 300);
    });
}

// ============== 筛选功能 ==============
function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // 更新活动状态
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            const searchTerm = document.getElementById('globalSearch')?.value.trim() || '';
            
            // 重新渲染
            if (window.location.pathname.includes('companies.html')) {
                renderCompaniesGrid(filter, searchTerm);
            } else if (window.location.pathname.includes('roadmap.html')) {
                renderTimeline(filter === 'all' ? null : filter);
            }
        });
    });
}

// ============== 通知提示 ==============
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 16px 24px;
        background: ${type === 'error' ? 'var(--danger)' : 'var(--accent-blue)'};
        color: white;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============== 动画关键帧 ==============
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }
    .modal-content {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 32px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        position: relative;
    }
    .modal-close {
        position: absolute;
        top: 16px;
        right: 16px;
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 24px;
        cursor: pointer;
    }
    .modal-close:hover { color: var(--text-primary); }
    .modal-section {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--border-color);
    }
    .modal-section h4 {
        font-size: 14px;
        color: var(--text-muted);
        margin-bottom: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .modal-section p {
        color: var(--text-secondary);
        margin-bottom: 8px;
    }
`;
document.head.appendChild(style);

// ============== 工具函数 ==============
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function getCompanyColor(companyId) {
    const colors = {
        'nvidia': '#4CAF50',
        'amd': '#FF5722',
        'intel': '#2196F3',
        'huawei': '#F44336'
    };
    return colors[companyId.toLowerCase()] || '#00D4FF';
}
