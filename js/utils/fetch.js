/**
 * 数据加载工具 - 安全的 fetch 封装
 * 使用 Promise.allSettled 确保单个文件失败不会导致整个应用崩溃
 */

async function fetchJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (err) {
        console.error(`[fetchJSON] 加载失败: ${url}`, err);
        return null;
    }
}

async function loadAllData() {
    const results = await Promise.allSettled([
        fetchJSON('data/companies.json'),
        fetchJSON('data/roadmaps.json'),
        fetchJSON('data/market.json'),
        fetchJSON('data/insights.json')
    ]);

    const [companiesResult, roadmapsResult, marketResult, insightsResult] = results;

    // 数据文件格式: { lastUpdated, dataVersion, data: { ... } }
    const extractData = (result) => {
        if (result.status !== 'fulfilled' || !result.value) return {};
        return result.value.data || result.value; // 兼容有 data 包装和无包装的情况
    };

    const companies = extractData(companiesResult);
    const roadmaps = extractData(roadmapsResult);
    const market = extractData(marketResult);
    const insights = extractData(insightsResult);

    // 报告加载失败的项
    results.forEach((result, index) => {
        const names = ['companies.json', 'roadmaps.json', 'market.json', 'insights.json'];
        if (result.status === 'rejected') {
            console.error(`[loadAllData] 加载 ${names[index]} 失败:`, result.reason);
            showErrorBanner(`無法加载 ${names[index]}，部分功能可能不可用。`);
        } else if (result.status === 'fulfilled' && result.value === null) {
            console.warn(`[loadAllData] ${names[index]} 返回 null`);
            showErrorBanner(`無法加载 ${names[index]}，部分功能可能不可用。`);
        }
    });

    console.log('[loadAllData] 数据加载完成:', {
        companies: Object.keys(companies).length,
        roadmaps: Object.keys(roadmaps).length,
        market: Object.keys(market).length,
        insights: Object.keys(insights).length
    });

    return { companies, roadmaps, market, insights };
}

function showErrorBanner(message) {
    const banner = document.createElement('div');
    banner.setAttribute('role', 'alert');
    banner.className = 'notification notification-error';
    banner.textContent = message;
    document.body.appendChild(banner);

    setTimeout(() => {
        banner.classList.add('notification-hide');
        setTimeout(() => banner.remove(), 300);
    }, 5000);
}

export { fetchJSON, loadAllData, showErrorBanner };
