/**
 * patch-6-companies.js
 * 更新 6 家空白公司數據到 Firestore
 * 執行：node scripts/patch-6-companies.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(readFileSync(resolve(__dirname, 'service-account-key.json'), 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const TARGET_IDS = ['cerebras', 'groq', 'tenstorrent', 'graphcore', 'sambanova', 'habana_labs'];

const data = JSON.parse(readFileSync(resolve(__dirname, '../data/companies-template.json'), 'utf8'));

let written = 0;
for (const id of TARGET_IDS) {
    const company = data.data[id];
    if (!company) { console.log(`SKIP: ${id} not found`); continue; }
    const { __status, __sources, __last_updated, __updated_by, ...fields } = company;
    // Ensure essential fields exist
    if (!fields.description || !fields.analysis?.strengths?.length) {
        console.log(`SKIP: ${id} has empty description or SWOT`);
        continue;
    }
    await db.collection('companies').doc(id).set(fields, { merge: true });
    console.log(`✓ ${id}`);
    written++;
}
console.log(`\nDone: ${written} companies updated`);
