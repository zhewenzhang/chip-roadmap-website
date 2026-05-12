/**
 * 洞察页面模块 - 使用安全的 DOM 方法渲染
 */

function renderTrends(insightsData) {
    const container = document.getElementById('trendsContainer');
    if (!container || !insightsData.trends) return;

    container.innerHTML = '';

    insightsData.trends.forEach(trend => {
        const card = document.createElement('div');
        card.className = 'trend-card';

        const h3 = document.createElement('h3');
        h3.textContent = trend.title;
        card.appendChild(h3);

        const p = document.createElement('p');
        p.textContent = trend.description;
        card.appendChild(p);

        const impact = document.createElement('span');
        impact.className = `insight-impact ${trend.impact?.toLowerCase() || 'medium'}`;
        impact.textContent = trend.impact || '中' + ' 影响';
        card.appendChild(impact);

        if (trend.companies && trend.companies.length > 0) {
            const companiesDiv = document.createElement('div');
            companiesDiv.className = 'trend-companies';
            companiesDiv.style.marginTop = '16px';

            trend.companies.forEach(c => {
                const chip = document.createElement('span');
                chip.className = 'company-chip';
                chip.textContent = c;
                companiesDiv.appendChild(chip);
            });

            card.appendChild(companiesDiv);
        }

        container.appendChild(card);
    });
}

function renderTopPlayers(insightsData) {
    const container = document.getElementById('topPlayersContainer');
    if (!container || !insightsData.top_players) return;

    container.innerHTML = '';

    insightsData.top_players.forEach((player, index) => {
        const card = document.createElement('div');
        card.className = 'player-card';

        // Header
        const header = document.createElement('div');
        header.className = 'player-header';

        const h3 = document.createElement('h3');
        h3.className = 'player-name';
        h3.textContent = `${index + 1}. ${player.name}`;
        header.appendChild(h3);

        const share = document.createElement('span');
        share.className = 'player-share';
        share.textContent = player.market_share;
        header.appendChild(share);

        card.appendChild(header);

        // Sections
        const sections = [
            { title: '核心优势', text: player.strength },
            { title: '主要弱点', text: player.weakness || '暂无' },
        ];

        sections.forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'player-section';

            const h4 = document.createElement('h4');
            h4.textContent = section.title;
            sectionDiv.appendChild(h4);

            const p = document.createElement('p');
            p.textContent = section.text;
            sectionDiv.appendChild(p);

            card.appendChild(sectionDiv);
        });

        // Outlook
        const outlookDiv = document.createElement('div');
        outlookDiv.className = 'player-section';

        const outlookH4 = document.createElement('h4');
        outlookH4.textContent = '前景展望';
        outlookDiv.appendChild(outlookH4);

        const outlookP = document.createElement('p');
        outlookP.className = 'player-outlook';
        outlookP.textContent = player.outlook;
        outlookDiv.appendChild(outlookP);

        card.appendChild(outlookDiv);

        container.appendChild(card);
    });
}

function renderABFAnalysis(insightsData) {
    const container = document.getElementById('abfAnalysisContainer');
    if (!container || !insightsData.abf_demand_analysis) return;

    container.innerHTML = '';

    const analysis = insightsData.abf_demand_analysis;

    const tiers = [
        { level: 'high', title: '高需求', data: analysis.high_demand || {} },
        { level: 'medium', title: '中需求', data: analysis.medium_demand || {} },
        { level: 'low', title: '低需求', data: analysis.low_demand || {} },
    ];

    tiers.forEach(tier => {
        const tierDiv = document.createElement('div');
        tierDiv.className = `abf-tier ${tier.level}`;

        const h3 = document.createElement('h3');
        h3.textContent = tier.title;
        tierDiv.appendChild(h3);

        Object.entries(tier.data).forEach(([name, data]) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'abf-item';

            const h4 = document.createElement('h4');
            h4.textContent = name;
            itemDiv.appendChild(h4);

            const p1 = document.createElement('p');
            p1.textContent = `ABF层数: ${data.abf_layers}`;
            itemDiv.appendChild(p1);

            const p2 = document.createElement('p');
            p2.textContent = `价格区间: ${data.price_range}`;
            itemDiv.appendChild(p2);

            tierDiv.appendChild(itemDiv);
        });

        container.appendChild(tierDiv);
    });
}

function renderKeyInsights(insightsData) {
    const container = document.getElementById('keyInsightsList');
    if (!container || !insightsData.key_insights) return;

    container.innerHTML = '';

    insightsData.key_insights.forEach(insight => {
        const li = document.createElement('li');
        li.textContent = insight;
        container.appendChild(li);
    });
}

export { renderTrends, renderTopPlayers, renderABFAnalysis, renderKeyInsights };
