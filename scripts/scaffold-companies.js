#!/usr/bin/env node
/**
 * Company Scaffolding Utility — Phase 16 / V2 Foundation Data
 *
 * Reads data/target-companies.txt, cross-references with data/companies.json,
 * and outputs data/companies-template.json with structured skeleton records.
 *
 * Usage:
 *   node scripts/scaffold-companies.js
 *
 * Output:
 *   data/companies-template.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// ===== Step 1: Read target companies =====

const targetPath = resolve(rootDir, 'data/target-companies.txt');
const targetText = readFileSync(targetPath, 'utf8');

const STATUS_RE = /\[(V2-ADD|V1-UPDATE|V1-KEEP|EXISTS)\]/;

function parseTargetCompanies(text) {
    const entries = [];
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        // Extract status marker from inline comment
        let status = null;
        const commentIdx = line.indexOf('#');
        if (commentIdx >= 0) {
            const comment = line.slice(commentIdx);
            const m = comment.match(STATUS_RE);
            if (m) status = m[1];
        }

        // Parse id | name_en | name_cn
        const pipePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
        const parts = pipePart.split('|').map(s => s.trim()).filter(Boolean);
        if (parts.length < 3) {
            console.warn(`⚠ Skipping malformed line: ${rawLine}`);
            continue;
        }

        const [id, name_en, name_cn] = parts;

        // Validate ID
        if (!/^[a-z][a-z0-9_]*$/.test(id)) {
            console.warn(`⚠ Skipping invalid ID "${id}": must be lowercase, start with letter, [a-z0-9_] only`);
            continue;
        }

        entries.push({ id, name_en, name_cn, status });
    }
    return entries;
}

const targets = parseTargetCompanies(targetText);

// ===== Step 2: Read existing companies =====

const companiesPath = resolve(rootDir, 'data/companies.json');
const companiesJson = JSON.parse(readFileSync(companiesPath, 'utf8'));
const existingData = companiesJson.data || {};

// ===== Step 3: Build template =====

/**
 * Safe default shape matching what admin/admin.js writes to Firestore companies collection.
 * NO facts invented — all descriptive fields are empty/null.
 */
function emptyCompanyRecord(id, name_en, name_cn) {
    return {
        id,
        name_en,
        name_cn,
        // Classification
        country: '',
        region: '',
        category: '',
        // Company metadata
        headquarters: '',
        founded: null,
        market_cap: '',
        description: '',
        // AI / ABF analysis fields (V2)
        abf_demand_impact: '',
        ai_chip_focus: '',
        foundry: '',
        packaging_partners: [],
        key_customers: [],
        // Market analysis
        market_position: '',
        analysis: {
            strengths: [],
            weaknesses: [],
            opportunities: [],
            threats: [],
        },
        // Product data
        products: [],
        roadmap: [],
        // Signal linkage
        signal_count: 0,
        last_signal_at: '',
        // Internal tracking
        __status: '',          // EXISTS / V1-UPDATE / V2-ADD / V1-KEEP
        __sources: {           // Per-field source URLs for operator to fill
            country: '',
            region: '',
            category: '',
            headquarters: '',
            founded: '',
            market_cap: '',
            description: '',
            abf_demand_impact: '',
            ai_chip_focus: '',
            foundry: '',
            packaging_partners: '',
            key_customers: '',
            market_position: '',
            analysis: '',
        },
        __last_updated: '',
        __updated_by: '',
    };
}

const templateEntries = {};
let counts = { add: 0, update: 0, skip: 0, exists: 0 };

for (const t of targets) {
    const existing = existingData[t.id];

    if (t.status === 'V2-ADD') {
        const record = emptyCompanyRecord(t.id, t.name_en, t.name_cn);
        record.__status = 'V2-ADD';
        templateEntries[t.id] = record;
        counts.add++;
    } else if (t.status === 'V1-UPDATE') {
        // Emit current record with V2 fields added as empty
        const record = existing
            ? {
                  ...existing,
                  // V2 fields — fill if missing
                  abf_demand_impact: existing.abf_demand_impact || '',
                  ai_chip_focus: existing.ai_chip_focus || '',
                  foundry: existing.foundry || '',
                  packaging_partners: existing.packaging_partners || [],
                  key_customers: existing.key_customers || [],
                  signal_count: existing.signal_count || 0,
                  last_signal_at: existing.last_signal_at || '',
                  // Internal tracking
                  __status: 'V1-UPDATE',
                  __sources: {
                      abf_demand_impact: '',
                      ai_chip_focus: '',
                      foundry: '',
                      packaging_partners: '',
                      key_customers: '',
                  },
                  __last_updated: '',
                  __updated_by: '',
              }
            : { ...emptyCompanyRecord(t.id, t.name_en, t.name_cn), __status: 'V1-UPDATE' };

        templateEntries[t.id] = record;
        counts.update++;
    } else if (t.status === 'V1-KEEP' || t.status === 'EXISTS') {
        // Preserve existing, just add tracking fields
        if (existing) {
            templateEntries[t.id] = {
                ...existing,
                __status: t.status === 'EXISTS' ? 'EXISTS' : 'V1-KEEP',
                __sources: { ...((existing.__sources || {})) },
                __last_updated: existing.__last_updated || '',
                __updated_by: existing.__updated_by || '',
            };
        }
        counts.skip++;
    }
}

// ===== Step 4: Write output =====

const outputPath = resolve(rootDir, 'data/companies-template.json');
const output = {
    lastUpdated: new Date().toISOString().slice(0, 10),
    dataVersion: '2.0.0-scaffold',
    note: 'Generated by scaffold-companies.js. DO NOT commit directly. Operator should fill __sources and facts before migration.',
    summary: {
        total_entries: Object.keys(templateEntries).length,
        v2_add: counts.add,
        v1_update: counts.update,
        v1_keep_exists: counts.skip,
    },
    data: templateEntries,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

// ===== Step 5: Print summary =====

console.log('\n=== Company Scaffolding Summary ===\n');
console.log(`Target companies parsed: ${targets.length}`);
console.log(`Existing companies in data/companies.json: ${Object.keys(existingData).length}`);
console.log('');
console.log(`  [V2-ADD]       ${counts.add} companies → new skeleton records (all facts empty)`);
console.log(`  [V1-UPDATE]    ${counts.update} companies → existing records with V2 fields appended`);
console.log(`  [V1-KEEP/EXISTS] ${counts.skip} companies → preserved as-is`);
console.log(`  [SKIPPED]      ${targets.length - counts.add - counts.update - counts.skip} (invalid or malformed)`);
console.log('');
console.log(`Total entries in template: ${Object.keys(templateEntries).length}`);
console.log(`Output written to: data/companies-template.json`);
console.log('');

if (counts.add > 0) {
    console.log('--- V2-ADD companies (need fact-filling) ---');
    for (const [id, rec] of Object.entries(templateEntries)) {
        if (rec.__status === 'V2-ADD') {
            console.log(`  ${id.padEnd(22)} | ${rec.name_en.padEnd(30)} | ${rec.name_cn}`);
        }
    }
    console.log('');
}

if (counts.update > 0) {
    console.log('--- V1-UPDATE companies (need V2 fields filled) ---');
    for (const [id, rec] of Object.entries(templateEntries)) {
        if (rec.__status === 'V1-UPDATE') {
            const missingFields = ['abf_demand_impact', 'ai_chip_focus', 'foundry', 'packaging_partners', 'key_customers']
                .filter(f => !rec[f] || (Array.isArray(rec[f]) && rec[f].length === 0));
            console.log(`  ${id.padEnd(22)} | ${rec.name_en.padEnd(30)} | ${rec.name_cn} | V2 fields missing: ${missingFields.join(', ') || 'none'}`);
        }
    }
    console.log('');
}

console.log('Next steps:');
console.log('  1. Review data/companies-template.json');
console.log('  2. Fill facts and __sources URLs for each company');
console.log('  3. Run migration: node scripts/migrate-companies.js (not yet implemented)');
console.log('');
