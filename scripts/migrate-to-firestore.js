/**
 * Migration script: JSON data files → Firebase Firestore
 *
 * Prerequisites:
 *   1. Download service account key from Firebase Console:
 *      https://console.firebase.google.com/project/chip-roadmap-site/settings/serviceaccounts/adminsdk
 *   2. Save it as: scripts/service-account-key.json
 *   3. Run: npm run migrate
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load service account
let serviceAccount;
try {
    serviceAccount = JSON.parse(readFileSync(resolve(__dirname, 'service-account-key.json'), 'utf8'));
} catch {
    console.error('ERROR: scripts/service-account-key.json not found.');
    console.error('Download it from: https://console.firebase.google.com/project/chip-roadmap-site/settings/serviceaccounts/adminsdk');
    process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const now = FieldValue.serverTimestamp();

// Load source JSON files
const companiesRaw = JSON.parse(readFileSync(resolve(__dirname, '../data/companies.json'), 'utf8'));
const insightsRaw = JSON.parse(readFileSync(resolve(__dirname, '../data/insights.json'), 'utf8'));
const marketRaw = JSON.parse(readFileSync(resolve(__dirname, '../data/market.json'), 'utf8'));

let ok = 0, fail = 0;

function log(symbol, name) { console.log(`  ${symbol} ${name}`); }

async function migrateCompanies() {
    console.log('\n--- Migrating companies ---');
    for (const [id, c] of Object.entries(companiesRaw.data || {})) {
        try {
            await db.collection('companies').doc(id).set({
                id,
                name_en: c.name_en || '',
                name_cn: c.name_cn || '',
                country: c.country || '',
                region: c.region || '',
                category: c.category || '',
                headquarters: c.headquarters || '',
                founded: c.founded ?? null,
                market_cap: c.market_cap || '',
                abf_demand: c.abf_demand || '',
                market_position: c.market_position || '',
                description: c.description || '',
                products: Array.isArray(c.products) ? c.products : [],
                roadmap: Array.isArray(c.roadmap) ? c.roadmap : [],
                analysis: {
                    strengths: c.analysis?.strengths || [],
                    weaknesses: c.analysis?.weaknesses || [],
                    opportunities: c.analysis?.opportunities || [],
                    threats: c.analysis?.threats || []
                },
                createdAt: now,
                updatedAt: now
            });
            log('✓', id); ok++;
        } catch (err) {
            log('✗', `${id}: ${err.message}`); fail++;
        }
    }
}

async function migrateInsights() {
    console.log('\n--- Migrating insights ---');
    const d = insightsRaw.data || {};

    // Trends — individual documents
    for (const trend of (d.trends || [])) {
        try {
            await db.collection('insights').add({
                type: 'trend',
                title: trend.title || '',
                description: trend.description || '',
                impact: trend.impact || '中',
                companies: trend.companies || [],
                tags: ['trend'],
                publishedAt: now, createdAt: now, updatedAt: now
            });
            log('✓', `trend: ${trend.title}`); ok++;
        } catch (err) { log('✗', `trend ${trend.title}: ${err.message}`); fail++; }
    }

    // Top players — individual documents
    for (const player of (d.top_players || [])) {
        try {
            await db.collection('insights').add({
                type: 'top_player',
                name: player.name || '',
                market_share: player.market_share || '',
                strength: player.strength || '',
                weakness: player.weakness || '',
                outlook: player.outlook || '',
                tags: ['market'],
                publishedAt: now, createdAt: now, updatedAt: now
            });
            log('✓', `top_player: ${player.name}`); ok++;
        } catch (err) { log('✗', `top_player ${player.name}: ${err.message}`); fail++; }
    }

    // ABF demand analysis — single document with fixed ID
    if (d.abf_demand_analysis) {
        try {
            await db.collection('insights').doc('abf_analysis').set({
                type: 'abf_analysis',
                abf_data: d.abf_demand_analysis,
                updatedAt: now
            });
            log('✓', 'abf_analysis'); ok++;
        } catch (err) { log('✗', `abf_analysis: ${err.message}`); fail++; }
    }

    // Key insights — single document with fixed ID, array of strings
    if (Array.isArray(d.key_insights)) {
        try {
            await db.collection('insights').doc('key_insights').set({
                type: 'key_insights',
                items: d.key_insights,
                updatedAt: now
            });
            log('✓', 'key_insights'); ok++;
        } catch (err) { log('✗', `key_insights: ${err.message}`); fail++; }
    }
}

async function migrateMarketStats() {
    console.log('\n--- Migrating market stats ---');
    try {
        await db.collection('market_stats').doc('summary').set({
            ...(marketRaw.data || {}),
            updatedAt: now
        });
        log('✓', 'market_stats/summary'); ok++;
    } catch (err) { log('✗', `market_stats: ${err.message}`); fail++; }
}

async function migrateConfig() {
    console.log('\n--- Migrating config ---');
    try {
        await db.collection('config').doc('app').set({
            dataVersion: '2.0.0',
            lastUpdated: now,
            siteName: 'Chip Roadmap',
            description: '半导体行业芯片路线图与企业分析平台'
        });
        log('✓', 'config/app'); ok++;
    } catch (err) { log('✗', `config: ${err.message}`); fail++; }
}

(async () => {
    console.log('🚀 Starting Firebase Firestore migration...');
    await migrateCompanies();
    await migrateInsights();
    await migrateMarketStats();
    await migrateConfig();
    console.log(`\n${fail === 0 ? '✅' : '⚠️'} Done: ${ok} succeeded, ${fail} failed`);
    process.exit(fail > 0 ? 1 : 0);
})();
