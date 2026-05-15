/**
 * Insights page — Phase 32
 * Reads from new insights collection schema (defined by OpenClaw Insight Agent).
 * Falls back to derived insights from signals if no Firestore insights exist.
 */
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { loadSignals, loadCompanies } from '../firebase/db.js';
import { IMPACT_LABEL, STAGE_LABEL } from './signals-schema.js';

let currentPeriod = 'weekly';

function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function formatDate(iso) {
    if (!iso) return '—';
    const d = iso.toDate ? iso.toDate() : new Date(iso);
    return d.toISOString().slice(0, 10);
}

async function loadInsightsByType(type) {
    try {
        const q = query(
            collection(db, 'insights'),
            where('type', '==', type),
            orderBy('generated_at', 'desc'),
            limit(10)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn('[Insights] query failed, falling back:', err.message);
        return [];
    }
}

function renderMarkdown(md) {
    // Minimal markdown: headings, bold, italic, links, lists
    if (!md) return '';
    let html = esc(md);
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h2 class="insight-h1">$1</h2>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.split(/\n\n+/).map(p => p.trim().startsWith('<') ? p : `<p>${p}</p>`).join('\n');
    return html;
}

function renderInsight(insight) {
    const body = renderMarkdown(insight.body_md || '');
    return `<article class="insight-card">
        <div class="insight-card-meta">
            <span class="badge badge-region">${esc(insight.type)}</span>
            <span>${formatDate(insight.generated_at || insight.createdAt)}</span>
            <span>${insight.signal_count || 0} 條信號分析</span>
        </div>
        <h2 class="insight-card-title">${esc(insight.summary || '無摘要')}</h2>
        <div class="insight-card-body">${body}</div>
    </article>`;
}

async function renderDerivedFallback() {
    const [sResult, cMap] = await Promise.all([loadSignals(), loadCompanies()]);
    const signals = sResult.ok ? sResult.data : [];
    const since = Date.now() - 7 * 86400000;
    const recent = signals.filter(s => new Date(s.updatedAt || 0).getTime() > since);

    const explosive = recent.filter(s => s.abf_demand_impact === 'explosive');
    const high = recent.filter(s => s.abf_demand_impact === 'high');
    const byCompany = {};
    recent.forEach(s => {
        byCompany[s.company_id] = (byCompany[s.company_id] || 0) + 1;
    });
    const topCompanies = Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return `<article class="insight-card">
        <div class="insight-card-meta">
            <span class="badge badge-region">DERIVED</span>
            <span>${new Date().toISOString().slice(0, 10)}</span>
            <span>${recent.length} 條本週信號</span>
        </div>
        <h2 class="insight-card-title">本週信號摘要（自動派生）</h2>
        <div class="insight-card-body">
            <p>本週收錄 <strong>${recent.length}</strong> 條信號，其中：</p>
            <ul>
                <li>爆發性影響：<strong>${explosive.length}</strong> 條</li>
                <li>高影響：<strong>${high.length}</strong> 條</li>
            </ul>
            <h3>最活躍公司</h3>
            <ul>${topCompanies.map(([id, count]) => `<li><a class="entity-link entity-company" href="company.html?id=${id}"><span class="entity-icon"></span>${esc(cMap[id]?.name_en || id)}</a>：${count} 條</li>`).join('')}</ul>
            ${explosive.length ? `<h3>爆發性影響信號</h3><ul>${explosive.slice(0, 5).map(s => `<li><a href="signal.html?id=${encodeURIComponent(s.id)}" style="color:var(--fg);text-decoration:none">⚡ ${esc(s.title)}</a></li>`).join('')}</ul>` : ''}
            <p style="margin-top:1.5rem;color:var(--fg-muted);font-size:var(--t-xs);font-style:italic">提示：OpenClaw Insight Agent 上線後，將自動產生更豐富的敘事報告，取代此處派生內容。</p>
        </div>
    </article>`;
}

async function render() {
    const root = document.getElementById('insightsRoot');
    root.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◈</div><div class="empty-state-title">載入中...</div></div>`;

    const insights = await loadInsightsByType(currentPeriod);

    if (insights.length === 0) {
        // Fallback to derived
        const derivedHtml = await renderDerivedFallback();
        root.innerHTML = derivedHtml;
        document.getElementById('lastInsightDate').textContent = new Date().toISOString().slice(0, 10);
        return;
    }

    root.innerHTML = insights.map(renderInsight).join('');
    document.getElementById('lastInsightDate').textContent = formatDate(insights[0].generated_at || insights[0].createdAt);
}

function init() {
    document.querySelectorAll('.filter-btn[data-period]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn[data-period]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            render();
        });
    });
    render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
