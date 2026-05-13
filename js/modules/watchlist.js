/**
 * Watchlist Module
 * Handles local persistence and state for watched companies, chips, and signals.
 */

const STORAGE_KEY = 'chip-roadmap-watchlist';

let watchlist = {
    companies: [],
    chips: [],
    signals: []
};

// Load from localStorage
export function loadWatchlist() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            watchlist = JSON.parse(stored);
            // Migration/Safety: ensure all arrays exist
            if (!Array.isArray(watchlist.companies)) watchlist.companies = [];
            if (!Array.isArray(watchlist.chips)) watchlist.chips = [];
            if (!Array.isArray(watchlist.signals)) watchlist.signals = [];
        }
    } catch (e) {
        console.error('[Watchlist] load error:', e);
    }
    return watchlist;
}

// Save to localStorage
function saveWatchlist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
}

// Toggle company watch state
export function toggleWatchCompany(id) {
    if (!id) return false;
    const idx = watchlist.companies.indexOf(id);
    if (idx > -1) {
        watchlist.companies.splice(idx, 1);
    } else {
        watchlist.companies.push(id);
    }
    saveWatchlist();
    return watchlist.companies.includes(id);
}

// Toggle chip watch state
export function toggleWatchChip(name) {
    if (!name) return false;
    const idx = watchlist.chips.indexOf(name);
    if (idx > -1) {
        watchlist.chips.splice(idx, 1);
    } else {
        watchlist.chips.push(name);
    }
    saveWatchlist();
    return watchlist.chips.includes(name);
}

// Toggle signal watch state
export function toggleWatchSignal(id) {
    if (!id) return false;
    const idx = watchlist.signals.indexOf(id);
    if (idx > -1) {
        watchlist.signals.splice(idx, 1);
    } else {
        watchlist.signals.push(id);
    }
    saveWatchlist();
    return watchlist.signals.includes(id);
}

// Checkers
export function isWatchingCompany(id) { return watchlist.companies.includes(id); }
export function isWatchingChip(name) { return watchlist.chips.includes(name); }
export function isWatchingSignal(id) { return watchlist.signals.includes(id); }

export function getWatchlist() { return watchlist; }
export function isEmpty() {
    return watchlist.companies.length === 0 && 
           watchlist.chips.length === 0 && 
           watchlist.signals.length === 0;
}
