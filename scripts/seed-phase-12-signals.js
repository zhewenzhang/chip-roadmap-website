/**
 * Phase 12 Seed Script — AI Chip → ABF Wedge Dataset
 *
 * Usage:
 *   node scripts/seed-phase-12-signals.js          # dry-run (default)
 *   node scripts/seed-phase-12-signals.js --write   # actually write to Firestore
 *
 * Requires: scripts/service-account-key.json
 * (Download from Firebase Console > Settings > Service Accounts)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// ===== Firebase Admin Init =====
const keyPath = resolve(rootDir, 'scripts/service-account-key.json');
if (!existsSync(keyPath)) {
    console.error('ERROR: service-account-key.json not found at:', keyPath);
    console.error('Download from Firebase Console > Settings > Service Accounts');
    process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount),
        projectId: 'chip-roadmap-site',
    });
}

const db = getFirestore();
const DRY_RUN = !process.argv.includes('--write');

if (DRY_RUN) {
    console.log('=== DRY RUN MODE — no data will be written ===');
    console.log('Use --write to actually write to Firestore\n');
}

// ===== Utility =====

function makeDocId(companyId, chipName, title) {
    // Deterministic ID for upsert detection
    const safe = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40);
    return `sig-${safe(companyId)}-${safe(chipName)}-${safe(title)}`;
}

// ===== Wedge Dataset =====
// Each entry: { company_id, company_name, chip_name, signals: [signal] }
// Signals follow the normalized shape from signals-schema.js

const WEDGE = [
    // ===================================================================
    // NVIDIA — Global AI Accelerator Leader
    // ===================================================================
    {
        company_id: 'nvidia',
        company_name: 'NVIDIA',
        chips: [
            {
                chip_name: 'Blackwell B200',
                signals: [
                    {
                        title: 'Blackwell B200 進入量產爬坡階段',
                        status: 'verified',
                        stage: 'ramp',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'explosive',
                        confidence_score: 85,
                        confidence_reason: 'TSMC 4NP 製程已確認量產，CoWoS-L 封裝產能擴張中',
                        evidence_summary: 'NVIDIA 2024 GTC 確認 Blackwell 架構，TSMC 法說會提及 4NP 產能分配。B200 採用 CoWoS-L 封裝，ABF 層數預估 16-18 層，基板尺寸約 77mm x 77mm。',
                        package_type: 'CoWoS-L',
                        cowos_required: true,
                        abf_size: '77mm x 77mm',
                        abf_layers: 18,
                        hbm: 'HBM3E',
                        expected_volume: 'high',
                        release_year: 2024,
                        release_quarter: 'Q4',
                        last_verified_at: '2025-03-15T00:00:00Z',
                        source_regions: ['USA', 'Taiwan'],
                        tags: ['ai-accelerator', 'datacenter', 'cowos'],
                        verification_note: '多來源交叉驗證：TSMC 法說會 + NVIDIA GTC + 供應鏈消息',
                    },
                    {
                        title: 'Blackwell B200 CoWoS 產能瓶頸風險',
                        status: 'watch',
                        stage: 'ramp',
                        region: 'Taiwan',
                        signal_type: 'supply_chain',
                        abf_demand_impact: 'high',
                        confidence_score: 55,
                        confidence_reason: '部分供應鏈消息指出 CoWoS 產能可能不足，但尚未獲 NVIDIA 或 TSMC 官方確認',
                        evidence_summary: 'DigiTimes 及供應鏈消息指出 2025 Q1 CoWoS 產能可能無法完全滿足 B200 需求。NVIDIA 可能尋求第二封裝來源。',
                        package_type: 'CoWoS-L',
                        cowos_required: true,
                        abf_layers: 16,
                        last_verified_at: '2025-02-20T00:00:00Z',
                        source_regions: ['Taiwan'],
                        tags: ['supply-chain', 'cowos', 'capacity'],
                        conflicting_evidence: 'NVIDIA 官方未確認產能問題，TSMC 表示產能充足',
                    },
                ],
            },
            {
                chip_name: 'Blackwell GB200',
                signals: [
                    {
                        title: 'GB200 NVL72 系統確認 CoWoS 封裝需求',
                        status: 'verified',
                        stage: 'ramp',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'explosive',
                        confidence_score: 80,
                        confidence_reason: 'NVIDIA 官方文件確認 GB200 採用 CoWoS-L 封裝，每套系統需要多顆 GPU 晶片',
                        evidence_summary: 'GB200 NVL72 系統整合 36 顆 B200 GPU 和 18 顆 Grace CPU，全部需要 CoWoS-L 封裝。每顆 GPU 使用 HBM3E，ABF 層數 16-18 層。整體系統對 ABF 基板需求極高。',
                        package_type: 'CoWoS-L',
                        cowos_required: true,
                        abf_size: '77mm x 77mm',
                        abf_layers: 18,
                        hbm: 'HBM3E',
                        expected_volume: 'high',
                        release_year: 2025,
                        release_quarter: 'Q1',
                        last_verified_at: '2025-04-01T00:00:00Z',
                        source_regions: ['USA', 'Taiwan'],
                        tags: ['ai-accelerator', 'datacenter', 'cowos', 'nvl72'],
                    },
                ],
            },
            {
                chip_name: 'Rubin',
                signals: [
                    {
                        title: 'Rubin 架構確認採用 HBM4 和下一代 CoWoS',
                        status: 'watch',
                        stage: 'design_win',
                        region: 'USA',
                        signal_type: 'roadmap_change',
                        abf_demand_impact: 'explosive',
                        confidence_score: 65,
                        confidence_reason: 'NVIDIA Roadmap 洩露，Jensen Huang 於 2024 提及 Rubin 架構，但詳細規格尚未確認',
                        evidence_summary: 'Rubin 為 Blackwell 之後的下一代架構，預計採用 HBM4 和更先進的 CoWoS 封裝。ABF 層數可能增至 20 層以上。預計 2026 年下半年開始量產。',
                        package_type: 'CoWoS-L',
                        cowos_required: true,
                        abf_layers: 20,
                        hbm: 'HBM4',
                        expected_volume: 'medium',
                        release_year: 2026,
                        release_quarter: 'Q4',
                        last_verified_at: '2025-01-10T00:00:00Z',
                        source_regions: ['USA'],
                        tags: ['ai-accelerator', 'next-gen', 'hbm4'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // AMD — Global AI Accelerator #2
    // ===================================================================
    {
        company_id: 'amd',
        company_name: 'AMD',
        chips: [
            {
                chip_name: 'MI300X',
                signals: [
                    {
                        title: 'MI300X 量產確認，CoWoS 封裝需求高',
                        status: 'verified',
                        stage: 'volume',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'high',
                        confidence_score: 80,
                        confidence_reason: 'AMD 財報確認 MI300X 量產出貨，TSMC CoWoS 產能分配明確',
                        evidence_summary: 'AMD MI300X 採用 TSMC 5nm + CoWoS 封裝，整合 8 顆 HBM3 晶片。ABF 層數約 16 層，基板尺寸約 75mm x 75mm。2024 年量產出貨，主要競爭 NVIDIA H100/H200。',
                        package_type: 'CoWoS',
                        cowos_required: true,
                        abf_size: '75mm x 75mm',
                        abf_layers: 16,
                        hbm: 'HBM3',
                        expected_volume: 'high',
                        release_year: 2024,
                        release_quarter: 'Q1',
                        last_verified_at: '2025-02-01T00:00:00Z',
                        source_regions: ['USA', 'Taiwan'],
                        tags: ['ai-accelerator', 'datacenter', 'cowos'],
                    },
                ],
            },
            {
                chip_name: 'MI350X',
                signals: [
                    {
                        title: 'MI350X 設計獲勝，預計 2025 量產',
                        status: 'watch',
                        stage: 'design_win',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'high',
                        confidence_score: 60,
                        confidence_reason: 'AMD 產品路線圖確認 MI350X，但詳細封裝規格尚未完全公開',
                        evidence_summary: 'MI350X 基於 CDNA 4 架構，預計採用 HBM3E 和 CoWoS 封裝。ABF 需求可能與 MI300X 相近。主要客戶包括 Microsoft、Meta 等雲端大廠。',
                        package_type: 'CoWoS',
                        cowos_required: true,
                        abf_layers: 16,
                        hbm: 'HBM3E',
                        expected_volume: 'medium',
                        release_year: 2025,
                        release_quarter: 'Q3',
                        last_verified_at: '2025-03-01T00:00:00Z',
                        source_regions: ['USA'],
                        tags: ['ai-accelerator', 'next-gen', 'cdna4'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // Intel — Global, AI Accelerator + CPU
    // ===================================================================
    {
        company_id: 'intel',
        company_name: 'Intel',
        chips: [
            {
                chip_name: 'Gaudi 3',
                signals: [
                    {
                        title: 'Gaudi 3 量產出貨，封裝方案確認',
                        status: 'verified',
                        stage: 'ramp',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'high',
                        confidence_score: 75,
                        confidence_reason: 'Intel 官方確認 Gaudi 3 出貨，封裝方案明確',
                        evidence_summary: 'Intel Gaudi 3 採用 TSMC 5nm + CoWoS 封裝或 Intel 自身封裝方案。整合 HBM2E/HBM3，ABF 層數約 14-16 層。主要競爭 AMD MI300 系列。',
                        package_type: 'CoWoS',
                        cowos_required: true,
                        abf_layers: 16,
                        hbm: 'HBM3',
                        expected_volume: 'medium',
                        release_year: 2024,
                        release_quarter: 'Q2',
                        last_verified_at: '2025-01-15T00:00:00Z',
                        source_regions: ['USA'],
                        tags: ['ai-accelerator', 'datacenter'],
                    },
                ],
            },
            {
                chip_name: 'Falcon Shores',
                signals: [
                    {
                        title: 'Falcon Shores 延期至 2026，XPU 架構確認',
                        status: 'watch',
                        stage: 'announced',
                        region: 'USA',
                        signal_type: 'roadmap_change',
                        abf_demand_impact: 'medium',
                        confidence_score: 50,
                        confidence_reason: 'Intel 官方確認延期，但最終規格和封裝方案尚未完全確認',
                        evidence_summary: 'Falcon Shores 為 Intel XPU 混合架構，原計劃 2025 年推出，現延期至 2026。採用 Intel 18A 製程。封裝方案可能使用 Intel 自身的 Foveros 或 CoWoS。',
                        package_type: 'Foveros',
                        cowos_required: false,
                        expected_volume: 'low',
                        release_year: 2026,
                        release_quarter: 'Q2',
                        last_verified_at: '2025-02-10T00:00:00Z',
                        source_regions: ['USA'],
                        tags: ['ai-accelerator', 'xpu', 'roadmap-delay'],
                        conflicting_evidence: '部分消息稱 Falcon Shores 可能改用 CoWoS，但 Intel 未確認',
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // Google — TPU
    // ===================================================================
    {
        company_id: 'google-tpu',
        company_name: 'Google',
        chips: [
            {
                chip_name: 'TPU v5p',
                signals: [
                    {
                        title: 'TPU v5p 量產部署於 Google Cloud',
                        status: 'verified',
                        stage: 'volume',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'high',
                        confidence_score: 80,
                        confidence_reason: 'Google Cloud 官方確認 TPU v5p 可用，TSMC 製程確認',
                        evidence_summary: 'Google TPU v5p 採用 TSMC 製程和 2.5D 封裝，整合 HBM。ABF 層數約 14-16 層。部署於 Google Cloud 數據中心，用於 Gemini 模型訓練和推論。',
                        package_type: '2.5D',
                        cowos_required: true,
                        abf_layers: 16,
                        hbm: 'HBM3',
                        expected_volume: 'high',
                        release_year: 2024,
                        release_quarter: 'Q1',
                        last_verified_at: '2025-01-20T00:00:00Z',
                        source_regions: ['USA', 'Taiwan'],
                        tags: ['ai-accelerator', 'tpu', 'datacenter'],
                    },
                ],
            },
            {
                chip_name: 'TPU v6 (Trillium)',
                signals: [
                    {
                        title: 'TPU v6 Trillium 設計獲勝，2025 部署',
                        status: 'watch',
                        stage: 'design_win',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'high',
                        confidence_score: 65,
                        confidence_reason: 'Google I/O 確認 Trillium 架構，但封裝細節尚未完全公開',
                        evidence_summary: 'TPU v6 Trillium 為 Google 第六代 TPU，預計採用更先進的製程和封裝。性能提升約 4 倍。ABF 需求可能增加。',
                        package_type: '2.5D',
                        cowos_required: true,
                        expected_volume: 'high',
                        release_year: 2025,
                        release_quarter: 'Q2',
                        last_verified_at: '2025-03-10T00:00:00Z',
                        source_regions: ['USA'],
                        tags: ['ai-accelerator', 'tpu', 'next-gen'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // AWS — Trainium / Inferentia
    // ===================================================================
    {
        company_id: 'aws',
        company_name: 'AWS',
        chips: [
            {
                chip_name: 'Trainium2',
                signals: [
                    {
                        title: 'Trainium2 部署於 AWS EC2，封裝需求確認',
                        status: 'verified',
                        stage: 'ramp',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'high',
                        confidence_score: 70,
                        confidence_reason: 'AWS re:Invent 確認 Trainium2，封裝方案明確',
                        evidence_summary: 'AWS Trainium2 採用先進封裝方案，整合 HBM。用於 AWS EC2 Trn2 實例。ABF 層數約 14-16 層。主要競爭 NVIDIA GPU 在雲端訓練市場。',
                        package_type: '2.5D',
                        cowos_required: true,
                        abf_layers: 16,
                        hbm: 'HBM3',
                        expected_volume: 'medium',
                        release_year: 2024,
                        release_quarter: 'Q4',
                        last_verified_at: '2025-02-15T00:00:00Z',
                        source_regions: ['USA'],
                        tags: ['ai-accelerator', 'cloud', 'training'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // Microsoft — Maia
    // ===================================================================
    {
        company_id: 'microsoft',
        company_name: 'Microsoft',
        chips: [
            {
                chip_name: 'Maia 100',
                signals: [
                    {
                        title: 'Maia 100 AI 加速器部署於 Azure',
                        status: 'verified',
                        stage: 'ramp',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'high',
                        confidence_score: 70,
                        confidence_reason: 'Microsoft Ignite 確認 Maia 100，封裝方案明確',
                        evidence_summary: 'Microsoft Maia 100 為自研 AI 加速器，部署於 Azure 雲平台。採用先進封裝和 HBM。ABF 層數約 14-16 層。降低對 NVIDIA GPU 的依賴。',
                        package_type: '2.5D',
                        cowos_required: true,
                        abf_layers: 16,
                        hbm: 'HBM3',
                        expected_volume: 'medium',
                        release_year: 2024,
                        release_quarter: 'Q4',
                        last_verified_at: '2025-01-25T00:00:00Z',
                        source_regions: ['USA'],
                        tags: ['ai-accelerator', 'cloud', 'azure'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // Huawei — China AI Accelerator
    // ===================================================================
    {
        company_id: 'huawei-ascend',
        company_name: 'Huawei',
        chips: [
            {
                chip_name: 'Ascend 910B',
                signals: [
                    {
                        title: 'Ascend 910B 量產出貨，中國 AI 芯片主力',
                        status: 'verified',
                        stage: 'volume',
                        region: 'China',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'high',
                        confidence_score: 75,
                        confidence_reason: '華為官方確認 910B 量產，多家中國雲端廠商採用',
                        evidence_summary: '華為 Ascend 910B 採用 SMIC 7nm 製程，為中國最主要的 AI 訓練芯片。ABF 層數約 12-14 層。受限於先進製程，但中國市場需求強勁。主要客戶包括百度、阿里巴巴、騰訊。',
                        package_type: '2.5D',
                        cowos_required: false,
                        abf_layers: 14,
                        expected_volume: 'high',
                        release_year: 2023,
                        release_quarter: 'Q4',
                        last_verified_at: '2025-02-05T00:00:00Z',
                        source_regions: ['China'],
                        tags: ['ai-accelerator', 'china', 'datacenter'],
                    },
                ],
            },
            {
                chip_name: 'Ascend 910C',
                signals: [
                    {
                        title: 'Ascend 910C 性能提升，封裝升級',
                        status: 'watch',
                        stage: 'sampling',
                        region: 'China',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'high',
                        confidence_score: 55,
                        confidence_reason: '供應鏈消息指出 910C 開發中，但華為未官方確認規格',
                        evidence_summary: 'Ascend 910C 為 910B 的升級版，性能提升約 20%。可能採用改進的封裝方案和更多 ABF 層數。受限於 SMIC 製程進展。',
                        package_type: '2.5D',
                        cowos_required: false,
                        abf_layers: 16,
                        expected_volume: 'medium',
                        release_year: 2025,
                        release_quarter: 'Q3',
                        last_verified_at: '2025-03-05T00:00:00Z',
                        source_regions: ['China'],
                        tags: ['ai-accelerator', 'china', 'next-gen'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // Cambricon — China AI Accelerator
    // ===================================================================
    {
        company_id: 'cambricon',
        company_name: 'Cambricon',
        chips: [
            {
                chip_name: 'MLU590',
                signals: [
                    {
                        title: 'MLU590 送樣測試，中國國產 AI 芯片',
                        status: 'watch',
                        stage: 'sampling',
                        region: 'China',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'medium',
                        confidence_score: 50,
                        confidence_reason: 'Cambricon 公開資訊有限，主要來自行業報告和供應鏈消息',
                        evidence_summary: 'Cambricon MLU590 為新一代 AI 加速器，定位數據中心訓練和推論。封裝方案和 ABF 需求尚不明確，但預計採用 2.5D 封裝。中國國產替代趨勢下需求增長。',
                        package_type: '2.5D',
                        cowos_required: false,
                        expected_volume: 'low',
                        release_year: 2025,
                        release_quarter: 'Q4',
                        last_verified_at: '2025-01-30T00:00:00Z',
                        source_regions: ['China'],
                        tags: ['ai-accelerator', 'china', 'domestic'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // Biren — China AI GPU
    // ===================================================================
    {
        company_id: 'biren',
        company_name: 'Biren Technology',
        chips: [
            {
                chip_name: 'BR100',
                signals: [
                    {
                        title: 'BR100 量產，中國 GPGPU 先驅',
                        status: 'verified',
                        stage: 'ramp',
                        region: 'China',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'medium',
                        confidence_score: 60,
                        confidence_reason: 'Biren 官方確認 BR100 量產，採用 TSMC 製程和 2.5D 封裝',
                        evidence_summary: 'Biren BR100 為中國首顆量產的 GPGPU，採用 TSMC 7nm 和 2.5D 封裝。整合 HBM，ABF 層數約 14 層。受限於美國出口管制，但中國市場需求持續。',
                        package_type: '2.5D',
                        cowos_required: false,
                        abf_layers: 14,
                        hbm: 'HBM2E',
                        expected_volume: 'medium',
                        release_year: 2024,
                        release_quarter: 'Q2',
                        last_verified_at: '2025-02-25T00:00:00Z',
                        source_regions: ['China'],
                        tags: ['ai-accelerator', 'china', 'gpgpu'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // Meta — MTIA (in-house AI chip)
    // ===================================================================
    {
        company_id: 'meta',
        company_name: 'Meta',
        chips: [
            {
                chip_name: 'MTIA v2',
                signals: [
                    {
                        title: 'MTIA v2 部署於 Meta 數據中心',
                        status: 'verified',
                        stage: 'ramp',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'medium',
                        confidence_score: 70,
                        confidence_reason: 'Meta 官方確認 MTIA v2 部署，封裝方案明確',
                        evidence_summary: 'Meta MTIA v2 為自研 AI 推論加速器，部署於 Meta 數據中心用於推薦系統。採用先進封裝，ABF 層數約 12-14 層。降低對外部 GPU 供應商的依賴。',
                        package_type: '2.5D',
                        cowos_required: true,
                        abf_layers: 14,
                        expected_volume: 'medium',
                        release_year: 2024,
                        release_quarter: 'Q3',
                        last_verified_at: '2025-01-05T00:00:00Z',
                        source_regions: ['USA'],
                        tags: ['ai-accelerator', 'cloud', 'inference'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // Groq — AI Inference Specialist
    // ===================================================================
    {
        company_id: 'groq',
        company_name: 'Groq',
        chips: [
            {
                chip_name: 'Groq LPU',
                signals: [
                    {
                        title: 'Groq LPU 推論加速器量產',
                        status: 'watch',
                        stage: 'ramp',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'medium',
                        confidence_score: 55,
                        confidence_reason: 'Groq 官方確認產品，但封裝細節和 ABF 需求尚不明確',
                        evidence_summary: 'Groq LPU (Language Processing Unit) 專為 AI 推論設計，採用 SRAM-based 架構，不依賴 HBM。封裝方案相對簡單，ABF 層數約 8-10 層。性能優於傳統 GPU 推論。',
                        package_type: 'flip-chip',
                        cowos_required: false,
                        abf_layers: 10,
                        expected_volume: 'medium',
                        release_year: 2024,
                        release_quarter: 'Q2',
                        last_verified_at: '2025-03-20T00:00:00Z',
                        source_regions: ['USA'],
                        tags: ['ai-accelerator', 'inference', 'sram'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // Tenstorrent — RISC-V AI Accelerator
    // ===================================================================
    {
        company_id: 'tenstorrent',
        company_name: 'Tenstorrent',
        chips: [
            {
                chip_name: 'Wormhole',
                signals: [
                    {
                        title: 'Wormhole AI 加速器採用 RISC-V 架構',
                        status: 'watch',
                        stage: 'sampling',
                        region: 'USA',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'medium',
                        confidence_score: 50,
                        confidence_reason: 'Tenstorrent 官方資訊有限，來自行業報告和技術分析',
                        evidence_summary: 'Tenstorrent Wormhole 採用 RISC-V 架構的 AI 加速器，定位數據中心訓練和推論。封裝方案和 ABF 需求尚待確認。Jim Keller 領導的團隊，技術路線獨特。',
                        package_type: '2.5D',
                        cowos_required: false,
                        expected_volume: 'low',
                        release_year: 2025,
                        release_quarter: 'Q2',
                        last_verified_at: '2025-02-28T00:00:00Z',
                        source_regions: ['USA'],
                        tags: ['ai-accelerator', 'risc-v', 'datacenter'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // Enflame — China AI Accelerator
    // ===================================================================
    {
        company_id: 'enflame',
        company_name: 'Enflame',
        chips: [
            {
                chip_name: 'CloudBlazer',
                signals: [
                    {
                        title: 'CloudBlazer 雲端 AI 加速器出貨',
                        status: 'watch',
                        stage: 'sampling',
                        region: 'China',
                        signal_type: 'product_progress',
                        abf_demand_impact: 'medium',
                        confidence_score: 45,
                        confidence_reason: 'Enflame 公開資訊有限，主要來自中國行業報告',
                        evidence_summary: 'Enflame CloudBlazer 為雲端 AI 加速器，定位數據中心。封裝方案和 ABF 需求尚不明確。中國國產替代趨勢下有一定市場機會。',
                        package_type: '2.5D',
                        cowos_required: false,
                        expected_volume: 'low',
                        release_year: 2025,
                        release_quarter: 'Q3',
                        last_verified_at: '2025-03-15T00:00:00Z',
                        source_regions: ['China'],
                        tags: ['ai-accelerator', 'china', 'cloud'],
                    },
                ],
            },
        ],
    },

    // ===================================================================
    // Supply Chain / ABF Substrate Signals
    // ===================================================================
    {
        company_id: 'ibiden',
        company_name: 'Ibiden',
        chips: [
            {
                chip_name: 'ABF 基板產能擴張',
                signals: [
                    {
                        title: 'Ibiden ABF 基板產能擴張以滿足 AI 芯片需求',
                        status: 'verified',
                        stage: 'volume',
                        region: 'Japan',
                        signal_type: 'supply_chain',
                        abf_demand_impact: 'explosive',
                        confidence_score: 80,
                        confidence_reason: 'Ibiden 財報和法說會確認產能擴張計劃',
                        evidence_summary: 'Ibiden（揖斐電）為全球最大 ABF 基板供應商之一，正在擴產以滿足 AI 芯片對高層數 ABF 基板的需求。AI 芯片 ABF 層數從傳統 4-6 層增至 14-20 層。Ibiden 在日本和馬來西亞的工廠都在擴產。',
                        abf_layers: 20,
                        expected_volume: 'high',
                        last_verified_at: '2025-03-01T00:00:00Z',
                        source_regions: ['Japan', 'Global'],
                        tags: ['abf-substrate', 'capacity', 'supply-chain'],
                        verification_note: 'Ibiden 財報 + 法說會資料確認',
                    },
                ],
            },
        ],
    },
    {
        company_id: 'shinko',
        company_name: 'Shinko Electric',
        chips: [
            {
                chip_name: 'ABF 基板供應',
                signals: [
                    {
                        title: 'Shinko Electric ABF 基板供貨緊張',
                        status: 'watch',
                        stage: 'volume',
                        region: 'Japan',
                        signal_type: 'supply_chain',
                        abf_demand_impact: 'high',
                        confidence_score: 60,
                        confidence_reason: '供應鏈消息指出 ABF 基板供應緊張，但 Shinko 未明確確認',
                        evidence_summary: 'Shinko Electric 為全球主要 ABF 基板供應商之一，與 Ibiden 和 Unimicron 競爭。AI 芯片需求增長導致高層數 ABF 基板供應緊張。可能影響 NVIDIA、AMD 等芯片的量產進度。',
                        expected_volume: 'high',
                        last_verified_at: '2025-02-15T00:00:00Z',
                        source_regions: ['Japan', 'Global'],
                        tags: ['abf-substrate', 'supply-chain', 'capacity'],
                        conflicting_evidence: '部分分析師認為 2025 下半年供應可能緩解',
                    },
                ],
            },
        ],
    },
];

// ===== Dedup & Upsert Logic =====

async function upsertSignal(docId, data) {
    const ref = db.collection('signals').doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
        // Update existing
        await ref.set(data, { merge: true });
        return 'updated';
    } else {
        // Create new
        await ref.set({ ...data, createdAt: new Date(), updatedAt: new Date() });
        return 'created';
    }
}

// ===== Main =====

async function main() {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const signalCounts = { verified: 0, watch: 0, draft: 0, downgraded: 0, invalidated: 0 };
    const chipsCovered = new Set();
    const companiesCovered = new Set();

    for (const company of WEDGE) {
        companiesCovered.add(company.company_id);

        for (const chip of company.chips) {
            chipsCovered.add(chip.chip_name);

            for (const sig of chip.signals) {
                const docId = makeDocId(company.company_id, chip.chip_name, sig.title);

                const signalData = {
                    company_id: company.company_id,
                    company_name: company.company_name,
                    chip_name: chip.chip_name,
                    ...sig,
                };

                console.log(`  ${DRY_RUN ? '[DRY]' : '[WRITE]'} ${sig.status.padEnd(12)} ${company.company_name.padEnd(20)} | ${chip.chip_name.padEnd(20)} | ${sig.title.slice(0, 40)}`);

                if (DRY_RUN) {
                    created++;
                    signalCounts[sig.status] = (signalCounts[sig.status] || 0) + 1;
                    continue;
                }

                try {
                    const action = await upsertSignal(docId, signalData);
                    if (action === 'created') created++;
                    else updated++;
                    signalCounts[sig.status] = (signalCounts[sig.status] || 0) + 1;
                } catch (err) {
                    console.error(`  ERROR: ${err.message}`);
                    errors++;
                }
            }
        }
    }

    console.log('\n===== Summary =====');
    console.log(`Created:  ${created}`);
    console.log(`Updated:  ${updated}`);
    console.log(`Skipped:  ${skipped}`);
    console.log(`Errors:   ${errors}`);
    console.log(`\nStatus breakdown:`);
    for (const [status, count] of Object.entries(signalCounts)) {
        console.log(`  ${status.padEnd(12)} ${count}`);
    }
    console.log(`\nChips covered:    ${chipsCovered.size}`);
    console.log(`Companies covered: ${companiesCovered.size}`);

    if (DRY_RUN) {
        console.log('\nDry run complete. Use --write to actually write to Firestore.');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
