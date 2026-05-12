/**
 * Roadmap 时间线模块 - 使用安全的 DOM 方法渲染
 */

function renderTimeline(roadmapsData, filterCompany = null) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    // 清空
    container.innerHTML = '';

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

    if (allTimelines.length === 0) {
        const msg = document.createElement('p');
        msg.style.textAlign = 'center';
        msg.style.color = 'var(--text-muted, #888)';
        msg.textContent = '暂无数据';
        container.appendChild(msg);
        return;
    }

    const timeline = document.createElement('div');
    timeline.className = 'timeline';

    allTimelines.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'timeline-item';

        const content = document.createElement('div');
        content.className = 'timeline-content';

        // Year/Quarter
        const yearSpan = document.createElement('span');
        yearSpan.className = 'timeline-year';
        yearSpan.textContent = `${item.year} ${item.quarter || ''}`;
        content.appendChild(yearSpan);

        // Company
        const companySpan = document.createElement('span');
        companySpan.className = `timeline-company ${item.companyId.toLowerCase()}`;
        companySpan.textContent = item.company;
        content.appendChild(companySpan);

        // Product
        const productH3 = document.createElement('h3');
        productH3.className = 'timeline-product';
        productH3.textContent = item.product;
        content.appendChild(productH3);

        // Specs
        if (item.specs) {
            const specsP = document.createElement('p');
            specsP.className = 'timeline-specs';
            specsP.textContent = item.specs;
            content.appendChild(specsP);
        }

        // Process
        if (item.process) {
            const processP = document.createElement('p');
            processP.className = 'timeline-process';
            processP.textContent = item.process;
            content.appendChild(processP);
        }

        itemEl.appendChild(content);
        timeline.appendChild(itemEl);
    });

    container.appendChild(timeline);
}

export { renderTimeline };
