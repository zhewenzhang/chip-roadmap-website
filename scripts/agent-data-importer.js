import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const AGENT_BRANCH = process.env.AGENT_DATA_REF || 'origin/agent-data';

const STAGE_MAP = {
    development: 'announced',
    mass_production: 'volume',
    shipment_ramp: 'ramp',
    commercial_availability: 'volume',
    production: 'volume',
};

const REGION_MAP = {
    US: 'USA',
    'United States': 'USA',
    'South Korea': 'Korea',
};

const IMPACT_MAP = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    EXPLOSIVE: 'explosive',
};

export function stableId(prefix, parts, length = 20) {
    const hash = createHash('sha1').update(parts.filter(Boolean).join('|')).digest('hex');
    return `${prefix}-${hash.slice(0, length)}`;
}

export function sanitizeDocId(value) {
    return String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

export function parseJsonl(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => JSON.parse(line));
}

export function isValidUrl(url) {
    return /^https?:\/\//i.test(String(url || '').trim());
}

function git(args, options = {}) {
    return execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe'],
        ...options,
    });
}

function listAgentFiles(prefix) {
    try {
        return git(['ls-tree', '-r', '--name-only', AGENT_BRANCH, prefix], { allowFailure: true })
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean);
    } catch {
        return [];
    }
}

function readAgentFile(path) {
    return git(['show', `${AGENT_BRANCH}:${path}`]);
}

function readAgentJson(path) {
    return JSON.parse(readAgentFile(path));
}

function normalizeSources(sources) {
    if (!Array.isArray(sources)) return [];
    return sources
        .map(source => {
            if (typeof source === 'string') {
                return isValidUrl(source) ? { type: 'link', url: source, label: source } : null;
            }
            if (source && typeof source === 'object') {
                const url = source.url || '';
                return isValidUrl(url)
                    ? { type: source.type || 'link', url, label: source.label || source.title || source.publisher || url }
                    : null;
            }
            return null;
        })
        .filter(Boolean);
}

export function normalizeAgentSignal(row, manifest = {}) {
    const status = row.status === 'verified' ? 'verified' : 'watch';
    const confidence = Number(row.confidence_score || 0);
    const normalized = {
        ...row,
        company_id: String(row.company_id || '').trim(),
        company_name: row.company_name || '',
        chip_name: row.chip_name || '',
        title: row.title || '',
        region: REGION_MAP[row.region] || row.region || '',
        signal_type: row.signal_type || 'product_progress',
        stage: STAGE_MAP[row.stage] || row.stage || 'rumor',
        status,
        release_year: row.release_year || null,
        release_quarter: ['Q1', 'Q2', 'Q3', 'Q4'].includes(row.release_quarter) ? row.release_quarter : '',
        package_type: row.package_type === 'CoWoS_2.5D' ? 'CoWoS' : (row.package_type || ''),
        cowos_required: Boolean(row.cowos_required),
        abf_layers: row.abf_layers == null || row.abf_layers === '' ? null : Number(row.abf_layers),
        abf_demand_impact: IMPACT_MAP[row.abf_demand_impact] || row.abf_demand_impact || 'low',
        confidence_score: Math.max(0, Math.min(100, confidence || 0)),
        evidence_summary: row.evidence_summary || '',
        confidence_reason: row.confidence_reason || '',
        sources: normalizeSources(row.sources),
        ai_generated: true,
        source_type: 'ai_extracted',
        created_by: row.created_by || 'openclaw-auto',
        extraction_agent: row.extraction_agent || 'openclaw',
        pipeline_run_id: row.pipeline_run_id || manifest.run_id || '',
        audit_decision: row.audit_decision || '',
        requires_human_review: Boolean(row.requires_human_review || status !== 'verified'),
        imported_from_agent: true,
    };

    if (status === 'verified') {
        normalized.last_verified_at = row.last_verified_at || new Date().toISOString();
        normalized.last_verified_by = row.last_verified_by || 'openclaw-auto';
    } else {
        normalized.last_verified_at = row.last_verified_at || '';
        normalized.last_verified_by = row.last_verified_by || '';
    }

    normalized.import_key = row.import_key || [
        normalized.company_id,
        normalized.chip_name,
        normalized.signal_type,
        normalized.release_year,
        normalized.release_quarter,
        normalized.stage,
    ].filter(Boolean).join('_').toLowerCase().replace(/\s+/g, '-');

    return normalized;
}

export function normalizeDeepDiveSignal(row, context) {
    const url = row.url || row.source_url || '';
    if (!isValidUrl(url)) return null;

    const entity = row.entity || context.companyName || context.companyId;
    const topic = row.topic || row.title || 'Deep dive signal';
    const detail = row.detail || row.evidence_summary || '';

    return {
        title: `${entity} deep dive: ${topic}`,
        company_id: context.companyId,
        company_name: context.companyName,
        chip_name: entity,
        region: context.region || 'USA',
        signal_type: 'deep_dive',
        stage: 'watch',
        status: 'watch',
        release_year: context.runDate ? Number(context.runDate.slice(0, 4)) : null,
        release_quarter: '',
        package_type: '',
        cowos_required: false,
        abf_layers: null,
        abf_demand_impact: 'medium',
        confidence_score: Math.max(0, Math.min(100, Number(row.confidence || row.confidence_score || 50))),
        evidence_summary: detail,
        confidence_reason: 'OpenClaw deep-dive extraction. Human review required before verification.',
        sources: [{ type: 'link', url, label: row.source || url }],
        tags: ['deep-dive'],
        ai_generated: true,
        source_type: 'ai_extracted',
        created_by: 'openclaw-auto',
        extraction_agent: 'openclaw',
        pipeline_run_id: context.runId,
        deep_dive_id: context.deepDiveId,
        source_signal_id: row.signal_id || '',
        audit_decision: 'watch',
        requires_human_review: true,
        imported_from_agent: true,
        last_verified_at: '',
        last_verified_by: '',
    };
}

export function normalizeAgentCompany(row) {
    const companyId = sanitizeDocId(row.company_id || row.id || row.name_en);
    const marketData = row.market_data || {};
    const abfRelevance = row.abf_relevance || {};

    return {
        id: companyId,
        company_id: companyId,
        name_en: row.name_en || row.name || companyId,
        name_cn: row.name_cn || '',
        aliases: Array.isArray(row.aliases) ? row.aliases : [],
        region: REGION_MAP[row.region] || row.region || row.country || '',
        country: row.country || '',
        headquarters: row.headquarters || '',
        founded: row.founded || '',
        website: row.website || '',
        category: row.company_type || row.category || '',
        company_type: row.company_type || '',
        ticker: marketData.ticker || row.ticker || '',
        exchange: marketData.exchange || row.exchange || '',
        market_cap: marketData.market_cap || row.market_cap || '',
        market_data: marketData,
        products: Array.isArray(row.main_products) ? row.main_products : [],
        main_products: Array.isArray(row.main_products) ? row.main_products : [],
        supply_chain_role: Array.isArray(row.supply_chain_role) ? row.supply_chain_role : [],
        abf: abfRelevance.level || '',
        abf_relevance: abfRelevance,
        advanced_packaging_relevance: row.advanced_packaging_relevance || {},
        china_relevance: row.china_relevance || {},
        key_customers_or_partners: Array.isArray(row.key_customers_or_partners) ? row.key_customers_or_partners : [],
        competitors: Array.isArray(row.competitors) ? row.competitors : [],
        description: row.why_track || '',
        why_track: row.why_track || '',
        analysis: row.company_analysis || {},
        company_analysis: row.company_analysis || {},
        tracking_priority: row.tracking_priority || {},
        source_quality: row.source_quality || {},
        import_decision: row.import_decision || {},
        data_quality: row.data_quality || {},
        sources: normalizeSources(row.sources),
        agent_meta: row.agent_meta || {},
        review: row.review || {},
        imported_from_agent: true,
        needs_human_review: Boolean(row.data_quality?.needs_human_review || row.import_decision?.decision !== 'import_ready'),
    };
}

export function shouldImportCompany(row) {
    const decision = row.import_decision?.decision || row.review?.decision || '';
    return ['import_ready', 'reviewed', 'reviewed_needs_human_check'].includes(decision);
}

async function loadCompanyIds(db) {
    const snap = await db.collection('companies').get();
    return new Set(snap.docs.map(doc => doc.id));
}

async function setWithTimestamps(ref, data) {
    const snap = await ref.get();
    const timestamped = {
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
    };
    if (!snap.exists) {
        timestamped.createdAt = FieldValue.serverTimestamp();
    }
    await ref.set(timestamped, { merge: true });
}

async function importSignalRuns(db) {
    const manifests = listAgentFiles('agent-inbox/signals').filter(path => path.endsWith('/publish-manifest.json'));
    const companyIds = await loadCompanyIds(db);
    const stats = { runs: manifests.length, createdOrUpdated: 0, skipped: 0, insights: 0, errors: 0 };

    for (const manifestPath of manifests) {
        const manifest = readAgentJson(manifestPath);
        if (!manifest.ready_for_firestore_import) {
            stats.skipped++;
            continue;
        }

        const runDir = manifestPath.replace(/\/publish-manifest\.json$/, '');
        const runId = manifest.run_id || sanitizeDocId(runDir.split('/').pop());
        const runDate = manifest.run_date || runDir.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '';

        const rows = parseJsonl(readAgentFile(manifest.signals_file || `${runDir}/signals.reviewed.jsonl`));
        for (const row of rows) {
            try {
                const signal = normalizeAgentSignal(row, manifest);
                if (!signal.company_id || !companyIds.has(signal.company_id)) {
                    stats.skipped++;
                    continue;
                }
                const id = stableId('oc', [runId, signal.company_id, signal.chip_name, signal.title]);
                await setWithTimestamps(db.collection('signals').doc(id), signal);
                stats.createdOrUpdated++;
            } catch (err) {
                stats.errors++;
                console.error(`[signals] ${runId}: ${err.message}`);
            }
        }

        const insightPath = manifest.daily_insight_file || `${runDir}/insight.daily.md`;
        try {
            const body = readAgentFile(insightPath);
            const insightId = sanitizeDocId(`daily-${runDate}-${runId}`);
            await setWithTimestamps(db.collection('insights').doc(insightId), {
                type: 'daily',
                title: `Daily Intelligence Snapshot ${runDate}`,
                period_start: runDate,
                period_end: runDate,
                body_md: body,
                signal_count: rows.length,
                source_type: 'openclaw_auto_import',
                pipeline_run_id: runId,
            });
            stats.insights++;
        } catch {
            // Daily report is useful but not required for the signal import to succeed.
        }

        const deepDiveFiles = listAgentFiles(`${runDir}/deep-dive`).filter(path => path.endsWith('_signals.jsonl'));
        for (const path of deepDiveFiles) {
            const deepDiveId = sanitizeDocId(path.split('/').pop().replace(/_signals\.jsonl$/, ''));
            const companyId = deepDiveId === 'google-tpu' || deepDiveId === 'google_tpu' ? 'google_tpu' : deepDiveId.replace(/-/g, '_');
            if (!companyIds.has(companyId)) {
                stats.skipped++;
                continue;
            }
            const context = {
                runId,
                runDate,
                companyId,
                companyName: companyId === 'google_tpu' ? 'Google TPU' : companyId,
                deepDiveId,
                region: 'USA',
            };
            for (const row of parseJsonl(readAgentFile(path))) {
                const signal = normalizeDeepDiveSignal(row, context);
                if (!signal) {
                    stats.skipped++;
                    continue;
                }
                const id = stableId('oc-dd', [runId, deepDiveId, row.signal_id, row.topic, row.detail]);
                await setWithTimestamps(db.collection('signals').doc(id), signal);
                stats.createdOrUpdated++;
            }
        }

        const deepDiveMarkdown = listAgentFiles(`${runDir}/deep-dive`).filter(path => path.endsWith('.md'));
        for (const path of deepDiveMarkdown) {
            const deepDiveId = sanitizeDocId(path.split('/').pop().replace(/\.md$/, ''));
            const insightId = sanitizeDocId(`deep-dive-${deepDiveId}-${runDate}-${runId}`);
            await setWithTimestamps(db.collection('insights').doc(insightId), {
                type: 'deep_dive',
                title: `Deep Dive: ${deepDiveId}`,
                period_start: runDate,
                period_end: runDate,
                body_md: readAgentFile(path),
                source_type: 'openclaw_auto_import',
                pipeline_run_id: runId,
                deep_dive_id: deepDiveId,
            });
            stats.insights++;
        }
    }

    return stats;
}

async function importCompanies(db) {
    const files = listAgentFiles('agent-inbox/company-intel/reviewed').filter(path => path.endsWith('/company-profiles.reviewed.jsonl'));
    const stats = { files: files.length, createdOrUpdated: 0, skipped: 0, errors: 0 };

    for (const file of files) {
        const rows = parseJsonl(readAgentFile(file));
        for (const row of rows) {
            try {
                if (!shouldImportCompany(row)) {
                    stats.skipped++;
                    continue;
                }
                const company = normalizeAgentCompany(row);
                if (!company.id) {
                    stats.skipped++;
                    continue;
                }
                await setWithTimestamps(db.collection('companies').doc(company.id), company);
                stats.createdOrUpdated++;
            } catch (err) {
                stats.errors++;
                console.error(`[companies] ${file}: ${err.message}`);
            }
        }
    }

    return stats;
}

function getServiceAccount() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    }
    const localKey = resolve(__dirname, 'service-account-key.json');
    if (existsSync(localKey)) {
        return JSON.parse(readFileSync(localKey, 'utf8'));
    }
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON secret or scripts/service-account-key.json');
}

async function main() {
    if (process.env.GITHUB_ACTIONS) {
        git(['fetch', 'origin', 'agent-data:refs/remotes/origin/agent-data']);
    }

    if (!getApps().length) {
        initializeApp({ credential: cert(getServiceAccount()) });
    }
    const db = getFirestore();

    const signalStats = await importSignalRuns(db);
    const companyStats = await importCompanies(db);

    console.log('OpenClaw agent-data import complete');
    console.log(JSON.stringify({ signalStats, companyStats }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
