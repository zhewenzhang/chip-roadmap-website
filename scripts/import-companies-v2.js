/**
 * import-companies-v2.js — 公司數據批量導入 Firestore
 *
 * 使用方法：
 *   1. 確認 scripts/service-account-key.json 存在
 *   2. 乾跑（只顯示，不寫入）：node scripts/import-companies-v2.js --dry-run
 *   3. 正式執行：node scripts/import-companies-v2.js
 *
 * 路由規則：
 *   __status === 'V2-ADD'    → setDoc（新增，若已存在則覆蓋）
 *   __status === 'V1-UPDATE' → setDoc merge:true（只更新有值的字段）
 *   __status === 'V1-KEEP'   → 跳過（不動）
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) {
    console.log('[DRY RUN] 不寫入 Firestore，僅顯示操作計劃\n');
}

// Load service account
let serviceAccount;
try {
    serviceAccount = JSON.parse(readFileSync(resolve(__dirname, 'service-account-key.json'), 'utf8'));
} catch {
    console.error('ERROR: scripts/service-account-key.json 不存在');
    console.error('請從 Firebase Console 下載 Service Account Key：');
    console.error('https://console.firebase.google.com/project/chip-roadmap-site/settings/serviceaccounts/adminsdk');
    process.exit(1);
}

if (!DRY_RUN) {
    initializeApp({ credential: cert(serviceAccount) });
}
const db = DRY_RUN ? null : getFirestore();
const now = DRY_RUN ? null : FieldValue.serverTimestamp();

// Load template
const templatePath = resolve(__dirname, '../data/companies-template.json');
let template;
try {
    template = JSON.parse(readFileSync(templatePath, 'utf8'));
} catch (e) {
    console.error('ERROR: data/companies-template.json 不存在或格式錯誤');
    process.exit(1);
}

const entries = Object.entries(template.data || {});
const stats = { add: 0, update: 0, skip: 0, error: 0 };

function buildDocData(id, c, isUpdate) {
    // 共用字段（有值才包含，避免覆蓋空字符串）
    const base = {
        id,
        name_en: c.name_en || '',
        name_cn: c.name_cn || '',
        region: c.region || '',
        country: c.country || '',
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
            threats: c.analysis?.threats || [],
        },
    };

    // V2 新增字段
    if (c.abf_demand_impact) base.abf_demand_impact = c.abf_demand_impact;
    if (c.ai_chip_focus !== undefined) base.ai_chip_focus = c.ai_chip_focus;
    if (c.supply_chain_role) base.supply_chain_role = c.supply_chain_role;

    if (isUpdate) {
        // merge 更新：只加 updatedAt，不覆蓋 createdAt
        base.updatedAt = now;
    } else {
        // 新增：設置 createdAt 和 updatedAt
        base.createdAt = now;
        base.updatedAt = now;
    }

    // 過濾掉空字符串（避免覆蓋 Firestore 中已有的真實值）
    if (isUpdate) {
        for (const key of Object.keys(base)) {
            if (base[key] === '' || base[key] === null) {
                delete base[key];
            }
            if (Array.isArray(base[key]) && base[key].length === 0) {
                delete base[key];
            }
        }
        // analysis 子字段也過濾
        if (base.analysis) {
            for (const key of Object.keys(base.analysis)) {
                if (Array.isArray(base.analysis[key]) && base.analysis[key].length === 0) {
                    delete base.analysis[key];
                }
            }
            if (Object.keys(base.analysis).length === 0) {
                delete base.analysis;
            }
        }
    }

    return base;
}

async function run() {
    console.log(`共 ${entries.length} 條記錄，開始處理...\n`);

    for (const [id, c] of entries) {
        const status = c.__status || 'V1-KEEP';

        if (status === 'V1-KEEP') {
            console.log(`  ⏭  ${id.padEnd(30)} [跳過 V1-KEEP]`);
            stats.skip++;
            continue;
        }

        const isUpdate = status === 'V1-UPDATE';
        const action = isUpdate ? 'merge 更新' : '新增';

        if (DRY_RUN) {
            console.log(`  ${isUpdate ? '↑' : '+'} ${id.padEnd(30)} [${action}] ${c.name_en || ''}`);
            isUpdate ? stats.update++ : stats.add++;
            continue;
        }

        try {
            const data = buildDocData(id, c, isUpdate);
            const ref = db.collection('companies').doc(id);

            if (isUpdate) {
                await ref.set(data, { merge: true });
            } else {
                await ref.set(data);
            }

            console.log(`  ✓ ${id.padEnd(30)} [${action}]`);
            isUpdate ? stats.update++ : stats.add++;
        } catch (err) {
            console.error(`  ✗ ${id.padEnd(30)} [${action}] ERROR: ${err.message}`);
            stats.error++;
        }
    }

    console.log('\n========== 完成 ==========');
    console.log(`  新增：${stats.add}`);
    console.log(`  更新：${stats.update}`);
    console.log(`  跳過：${stats.skip}`);
    console.log(`  失敗：${stats.error}`);
    if (DRY_RUN) console.log('\n[DRY RUN] 未寫入任何數據。去掉 --dry-run 參數後重新執行以正式導入。');
}

run().catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
});
