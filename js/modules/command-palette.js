/**
 * ⌘K Command Palette — Phase 27
 */
import { loadCompanies, loadSignals } from '../firebase/db.js';

let palette = null;
let companies = [];
let signals = [];
let dataLoaded = false;

async function loadData() {
    if (dataLoaded) return;
    const [c, sResult] = await Promise.all([loadCompanies(), loadSignals()]);
    companies = Object.values(c);
    signals = sResult.ok ? sResult.data : [];
    dataLoaded = true;
}

export async function open() {
    if (!palette) buildPalette();
    palette.style.display = 'flex';
    const input = palette.querySelector('.cmdk-input');
    input.value = '';
    input.focus();
    await loadData();
    renderResults('');
}

function close() { if (palette) palette.style.display = 'none'; }

function buildPalette() {
    palette = document.createElement('div');
    palette.className = 'cmdk-overlay';
    palette.innerHTML = `
        <div class="cmdk">
            <input class="cmdk-input" type="text" placeholder="搜尋公司 / 芯片 / 信號..." autocomplete="off">
            <div class="cmdk-results"></div>
            <div class="cmdk-footer">
                <span>↑↓ 導航</span>
                <span>⏎ 開啟</span>
                <span>Esc 關閉</span>
            </div>
        </div>
    `;
    document.body.appendChild(palette);

    const input = palette.querySelector('.cmdk-input');
    input.addEventListener('input', () => renderResults(input.value));
    palette.addEventListener('click', (e) => { if (e.target === palette) close(); });
    document.addEventListener('keydown', (e) => {
        if (palette.style.display !== 'flex') return;
        if (e.key === 'Escape') close();
        if (e.key === 'Enter') {
            const first = palette.querySelector('.cmdk-result');
            if (first) window.location.href = first.dataset.href;
        }
    });
}

function renderResults(q) {
    const results = palette.querySelector('.cmdk-results');
    const query = q.trim().toLowerCase();

    const matchedCompanies = companies.filter(c =>
        (c.name_en?.toLowerCase().includes(query) || c.name_cn?.includes(q) || c.id?.toLowerCase().includes(query))
    ).slice(0, 5);

    const chipNames = new Set();
    signals.forEach(s => s.chip_name && chipNames.add(s.chip_name));
    const matchedChips = [...chipNames].filter(c => c.toLowerCase().includes(query)).slice(0, 5);

    const matchedSignals = signals.filter(s =>
        s.title?.toLowerCase().includes(query) || s.chip_name?.toLowerCase().includes(query)
    ).slice(0, 5);

    let html = '';
    if (matchedCompanies.length) {
        html += '<div class="cmdk-section-label">公司</div>';
        html += matchedCompanies.map(c =>
            `<a class="cmdk-result" data-href="company.html?id=${c.id}" href="company.html?id=${c.id}"><span class="entity-icon">◆</span> ${c.name_en || c.id}${c.name_cn ? ' / ' + c.name_cn : ''}</a>`
        ).join('');
    }
    if (matchedChips.length) {
        html += '<div class="cmdk-section-label">芯片</div>';
        html += matchedChips.map(name =>
            `<a class="cmdk-result" data-href="chip.html?name=${encodeURIComponent(name)}" href="chip.html?name=${encodeURIComponent(name)}"><span class="entity-icon">◇</span> ${name}</a>`
        ).join('');
    }
    if (matchedSignals.length) {
        html += '<div class="cmdk-section-label">最新信號</div>';
        html += matchedSignals.map(s =>
            `<a class="cmdk-result" data-href="signal.html?id=${s.id}" href="signal.html?id=${s.id}">${s.title}</a>`
        ).join('');
    }
    if (!html) html = '<div class="cmdk-empty">沒有匹配結果</div>';
    results.innerHTML = html;
}
