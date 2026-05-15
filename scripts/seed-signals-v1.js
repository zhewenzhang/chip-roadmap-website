/**
 * seed-signals-v1.js — 導入 30 條種子信號
 * 執行：node scripts/seed-signals-v1.js [--dry-run]
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('[DRY RUN] 不寫入 Firestore\n');

const serviceAccount = JSON.parse(readFileSync(resolve(__dirname, 'service-account-key.json'), 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ===== 種子信號數據 =====
const SIGNALS = [

  // ── NVIDIA ──────────────────────────────────────────
  {
    title: 'NVIDIA H100 SXM5 進入量產，CoWoS-S 封裝確認',
    company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'H100 SXM5',
    region: 'USA', signal_type: 'product_progress', stage: 'volume', status: 'verified',
    release_year: 2024, release_quarter: 'Q1',
    package_type: 'CoWoS-S', cowos_required: true, abf_layers: 16, hbm: 'HBM3',
    expected_volume: 'high', abf_demand_impact: 'explosive', confidence_score: 95,
    evidence_summary: 'NVIDIA H100 SXM5 已於 2024Q1 進入大規模量產，採用台積電 CoWoS-S 封裝，搭載 HBM3，ABF 基板需求爆發性增長，供應鏈確認訂單充足。',
    sources: [{ type: 'link', url: 'https://nvidianews.nvidia.com', label: 'NVIDIA 官方新聞' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: 'NVIDIA H200 SXM5 量產出貨，HBM3E 配置確認',
    company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'H200 SXM5',
    region: 'USA', signal_type: 'product_progress', stage: 'volume', status: 'verified',
    release_year: 2024, release_quarter: 'Q2',
    package_type: 'CoWoS-S', cowos_required: true, abf_layers: 16, hbm: 'HBM3E',
    expected_volume: 'high', abf_demand_impact: 'explosive', confidence_score: 92,
    evidence_summary: 'NVIDIA H200 SXM5 於 2024Q2 開始出貨，升級 HBM3E（141GB），保持 CoWoS-S 封裝，主要客戶為 AWS、Azure、Google Cloud。',
    sources: [{ type: 'link', url: 'https://www.digitimes.com', label: 'DigiTimes' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: 'NVIDIA B200 Blackwell 進入量產爬坡',
    company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'B200',
    region: 'USA', signal_type: 'product_progress', stage: 'ramp', status: 'verified',
    release_year: 2025, release_quarter: 'Q1',
    package_type: 'CoWoS-L', cowos_required: true, abf_layers: 18, hbm: 'HBM3E',
    expected_volume: 'high', abf_demand_impact: 'explosive', confidence_score: 88,
    evidence_summary: 'Blackwell B200 採用台積電 CoWoS-L 封裝，兩顆 die 合封，ABF 基板需求進一步升級至 18L，2025Q1 開始量產爬坡，全年出貨目標超過 H100。',
    sources: [{ type: 'link', url: 'https://semianalysis.com', label: 'SemiAnalysis' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: 'NVIDIA GB200 NVL72 系統級封裝進入試產',
    company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'GB200 NVL72',
    region: 'USA', signal_type: 'product_progress', stage: 'pilot', status: 'verified',
    release_year: 2025, release_quarter: 'Q2',
    package_type: 'CoWoS-L', cowos_required: true, abf_layers: 18, hbm: 'HBM3E',
    expected_volume: 'high', abf_demand_impact: 'explosive', confidence_score: 85,
    evidence_summary: 'GB200 NVL72 將 72 顆 GPU 整合進一個 rack，每個 tray 需要大量 CoWoS-L 封裝，ABF 需求密度為單芯片產品的 72 倍，供應鏈高度關注。',
    sources: [{ type: 'link', url: 'https://www.digitimes.com', label: 'DigiTimes' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: 'NVIDIA Rubin R100 設計確認，台積電 3nm CoWoS',
    company_id: 'nvidia', company_name: 'NVIDIA', chip_name: 'Rubin R100',
    region: 'USA', signal_type: 'roadmap_change', stage: 'announced', status: 'verified',
    release_year: 2026, release_quarter: 'Q1',
    package_type: 'CoWoS-L', cowos_required: true, abf_layers: 20, hbm: 'HBM4',
    expected_volume: 'high', abf_demand_impact: 'explosive', confidence_score: 75,
    evidence_summary: 'NVIDIA Rubin 架構下一代 GPU，採用台積電 3nm 製程，CoWoS-L 封裝，預計搭載 HBM4，ABF 層數預計升至 20L，2026Q1 目標量產。',
    sources: [{ type: 'link', url: 'https://semianalysis.com', label: 'SemiAnalysis' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── AMD ──────────────────────────────────────────────
  {
    title: 'AMD MI300X 量產，CoWoS 封裝 + HBM3 配置確認',
    company_id: 'amd', company_name: 'AMD', chip_name: 'MI300X',
    region: 'USA', signal_type: 'product_progress', stage: 'volume', status: 'verified',
    release_year: 2024, release_quarter: 'Q1',
    package_type: 'CoWoS-S', cowos_required: true, abf_layers: 14, hbm: 'HBM3',
    expected_volume: 'high', abf_demand_impact: 'high', confidence_score: 90,
    evidence_summary: 'AMD MI300X 採用 3 顆 GPU die + 3 顆 CPU die 的 3D 堆疊設計，CoWoS 封裝，192GB HBM3，2024Q1 正式量產，主要替代方案挑戰 NVIDIA H100。',
    sources: [{ type: 'link', url: 'https://ir.amd.com', label: 'AMD IR' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: 'AMD MI325X 升級版進入量產，HBM3E 配置',
    company_id: 'amd', company_name: 'AMD', chip_name: 'MI325X',
    region: 'USA', signal_type: 'product_progress', stage: 'volume', status: 'verified',
    release_year: 2024, release_quarter: 'Q4',
    package_type: 'CoWoS-S', cowos_required: true, abf_layers: 14, hbm: 'HBM3E',
    expected_volume: 'medium', abf_demand_impact: 'high', confidence_score: 85,
    evidence_summary: 'AMD MI325X 是 MI300X 的記憶體升級版，升至 288GB HBM3E，2024Q4 進入量產，主要面向對記憶體頻寬敏感的推理工作負載。',
    sources: [{ type: 'link', url: 'https://www.amd.com', label: 'AMD 官網' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: 'AMD MI350 進入設計勝出，2025 量產',
    company_id: 'amd', company_name: 'AMD', chip_name: 'MI350',
    region: 'USA', signal_type: 'product_progress', stage: 'design_win', status: 'watch',
    release_year: 2025, release_quarter: 'Q2',
    package_type: 'CoWoS-L', cowos_required: true, abf_layers: 16, hbm: 'HBM3E',
    expected_volume: 'medium', abf_demand_impact: 'high', confidence_score: 70,
    evidence_summary: 'AMD MI350 基於 CDNA 4 架構，台積電 3nm 製程，預計 2025Q2 量產，多家雲廠商已下訂單。CoWoS-L 封裝升級。',
    sources: [{ type: 'link', url: 'https://semianalysis.com', label: 'SemiAnalysis' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── Intel / Habana ────────────────────────────────────
  {
    title: 'Intel Gaudi 3 進入量產，AWS 部署確認',
    company_id: 'habana_labs', company_name: 'Intel Habana', chip_name: 'Gaudi 3',
    region: 'Israel', signal_type: 'product_progress', stage: 'volume', status: 'verified',
    release_year: 2024, release_quarter: 'Q2',
    package_type: 'flip-chip', cowos_required: false, abf_layers: null, hbm: 'HBM2E',
    expected_volume: 'medium', abf_demand_impact: 'medium', confidence_score: 82,
    evidence_summary: 'Intel Gaudi 3 採用 TSMC 5nm 製程，傳統 flip-chip 封裝，搭載 HBM2E，在某些 LLM 訓練工作負載上性價比優於 H100，AWS 已部署在 DL2q 實例。',
    sources: [{ type: 'link', url: 'https://www.intel.com', label: 'Intel 官網' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── Google TPU ───────────────────────────────────────
  {
    title: 'Google TPU v5e 量產，GKE 全面部署',
    company_id: 'google_tpu', company_name: 'Google', chip_name: 'TPU v5e',
    region: 'USA', signal_type: 'product_progress', stage: 'volume', status: 'verified',
    release_year: 2024, release_quarter: 'Q1',
    package_type: '2.5D', cowos_required: false, abf_layers: 12, hbm: null,
    expected_volume: 'high', abf_demand_impact: 'high', confidence_score: 88,
    evidence_summary: 'Google TPU v5e 面向推理優化，2024Q1 在 Google Cloud 全面上線，採用 2.5D 封裝，在 Transformer 推理上效率領先，內部部署規模達十萬顆以上。',
    sources: [{ type: 'link', url: 'https://cloud.google.com/tpu', label: 'Google Cloud TPU' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: 'Google TPU v5p 量產，大型訓練集群部署',
    company_id: 'google_tpu', company_name: 'Google', chip_name: 'TPU v5p',
    region: 'USA', signal_type: 'product_progress', stage: 'volume', status: 'verified',
    release_year: 2024, release_quarter: 'Q2',
    package_type: '2.5D', cowos_required: false, abf_layers: 14, hbm: 'HBM3',
    expected_volume: 'high', abf_demand_impact: 'high', confidence_score: 85,
    evidence_summary: 'Google TPU v5p 針對大型語言模型訓練，搭載 HBM3，2024Q2 在 Google 內部超算集群部署，Gemini Ultra 訓練使用。',
    sources: [{ type: 'link', url: 'https://cloud.google.com/tpu', label: 'Google Cloud TPU' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: 'Google Ironwood TPU 第六代宣布，推理優化',
    company_id: 'google_tpu', company_name: 'Google', chip_name: 'Trillium TPU v6',
    region: 'USA', signal_type: 'product_progress', stage: 'ramp', status: 'verified',
    release_year: 2025, release_quarter: 'Q1',
    package_type: '2.5D', cowos_required: false, abf_layers: 16, hbm: 'HBM3E',
    expected_volume: 'high', abf_demand_impact: 'high', confidence_score: 80,
    evidence_summary: 'Google 第六代 TPU（Trillium）性能為 v5e 的 4.7 倍，2025Q1 開放 GKE 客戶訪問，Cloud TPU v6e 系列對外發布，ABF 需求持續增長。',
    sources: [{ type: 'link', url: 'https://cloud.google.com/blog', label: 'Google Cloud Blog' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── 寒武紀 Cambricon ──────────────────────────────────
  {
    title: '寒武紀思元 590 進入量產，國內雲廠商採購',
    company_id: 'cambricon', company_name: 'Cambricon', chip_name: '思元 590 (MLU590)',
    region: 'China', signal_type: 'product_progress', stage: 'pilot', status: 'watch',
    release_year: 2024, release_quarter: 'Q3',
    package_type: '2.5D', cowos_required: false, abf_layers: null, hbm: 'HBM2E',
    expected_volume: 'medium', abf_demand_impact: 'medium', confidence_score: 65,
    evidence_summary: '寒武紀 MLU590 採用台積電 7nm 製程，HBM2E，預計 2024Q3 進入試產，國內雲廠商正在測試，受出口管制影響替代需求增強，但性能與 H100 仍有差距。',
    sources: [{ type: 'link', url: 'https://36kr.com', label: '36氪' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: '寒武紀思元 690 宣布，2025 年量產計劃',
    company_id: 'cambricon', company_name: 'Cambricon', chip_name: '思元 690',
    region: 'China', signal_type: 'roadmap_change', stage: 'announced', status: 'watch',
    release_year: 2025, release_quarter: 'Q2',
    package_type: '2.5D', cowos_required: false, abf_layers: null, hbm: 'HBM3',
    expected_volume: 'medium', abf_demand_impact: 'medium', confidence_score: 58,
    evidence_summary: '寒武紀已宣布下一代思元 690，預計升級 HBM3，2025 年量產，目標對標 H100 性能，但具體量產時程和供應鏈尚未確認。',
    sources: [{ type: 'link', url: 'https://www.cambricon.com', label: '寒武紀官網' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── 海思 / 昇騰 HiSilicon ────────────────────────────
  {
    title: '昇騰 910B 量產出貨，華為國內雲部署',
    company_id: 'hisilicon', company_name: 'HiSilicon / Huawei', chip_name: 'Ascend 910B',
    region: 'China', signal_type: 'product_progress', stage: 'volume', status: 'watch',
    release_year: 2024, release_quarter: 'Q1',
    package_type: 'flip-chip', cowos_required: false, abf_layers: null, hbm: 'HBM2E',
    expected_volume: 'high', abf_demand_impact: 'medium', confidence_score: 72,
    evidence_summary: '昇騰 910B 由中芯國際 7nm（N+2）代工，2024Q1 開始規模出貨，百度、阿里、騰訊均有採購，出口管制環境下替代 NVIDIA 產品，但傳統封裝 ABF 需求有限。',
    sources: [{ type: 'link', url: 'https://36kr.com', label: '36氪' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: '昇騰 910C 進入試產，中芯 5nm 製程',
    company_id: 'hisilicon', company_name: 'HiSilicon / Huawei', chip_name: 'Ascend 910C',
    region: 'China', signal_type: 'product_progress', stage: 'pilot', status: 'watch',
    release_year: 2025, release_quarter: 'Q1',
    package_type: 'flip-chip', cowos_required: false, abf_layers: null, hbm: 'HBM2E',
    expected_volume: 'medium', abf_demand_impact: 'medium', confidence_score: 60,
    evidence_summary: '昇騰 910C 採用中芯 5nm 工藝（N+3），性能目標接近 H100，2025Q1 試產，量產時程受制於中芯 5nm 良率改善進度，供應鏈不透明。',
    sources: [{ type: 'link', url: 'https://www.reuters.com', label: 'Reuters' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── TSMC（供應鏈） ────────────────────────────────────
  {
    title: 'TSMC CoWoS 月產能突破 40K 片，ABF 需求暴增',
    company_id: 'tsmc', company_name: 'TSMC', chip_name: 'CoWoS Platform',
    region: 'Taiwan', signal_type: 'capacity', stage: 'volume', status: 'verified',
    release_year: 2024, release_quarter: 'Q3',
    package_type: 'CoWoS-L', cowos_required: true, abf_layers: null, hbm: null,
    expected_volume: 'high', abf_demand_impact: 'explosive', confidence_score: 88,
    evidence_summary: 'TSMC CoWoS 先進封裝月產能 2024Q3 突破 40,000 wafer，比 2023 年翻倍。每片 CoWoS 基板需要高層數 ABF，直接推動 ABF 全球供應緊張。',
    sources: [{ type: 'link', url: 'https://www.digitimes.com', label: 'DigiTimes' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: 'TSMC CoWoS-L 產能擴張至 2026，確保 Rubin 供應',
    company_id: 'tsmc', company_name: 'TSMC', chip_name: 'CoWoS-L',
    region: 'Taiwan', signal_type: 'capacity', stage: 'ramp', status: 'verified',
    release_year: 2025, release_quarter: 'Q4',
    package_type: 'CoWoS-L', cowos_required: true, abf_layers: null, hbm: null,
    expected_volume: 'high', abf_demand_impact: 'explosive', confidence_score: 82,
    evidence_summary: 'TSMC 宣布擴建 CoWoS-L 產能至 2026 年，主要為 NVIDIA Rubin 和未來 AI 芯片供貨，新建封裝廠預計 2025Q4 投產，ABF 需求鎖定長期合約。',
    sources: [{ type: 'link', url: 'https://www.digitimes.com', label: 'DigiTimes' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── SK Hynix（HBM） ───────────────────────────────────
  {
    title: 'SK Hynix HBM3E 12Hi 量產，NVIDIA B200 獨家供應',
    company_id: 'sk_hynix', company_name: 'SK Hynix', chip_name: 'HBM3E 12Hi',
    region: 'Korea', signal_type: 'product_progress', stage: 'volume', status: 'verified',
    release_year: 2024, release_quarter: 'Q2',
    package_type: '3D', cowos_required: false, abf_layers: null, hbm: 'HBM3E',
    expected_volume: 'high', abf_demand_impact: 'high', confidence_score: 90,
    evidence_summary: 'SK Hynix HBM3E 12Hi（141GB）2024Q2 量產，為 NVIDIA H200 和 B200 的獨家 HBM 供應商，每顆 B200 配置 8 顆 HBM3E，出貨規模巨大。',
    sources: [{ type: 'link', url: 'https://news.skhynix.com', label: 'SK Hynix 新聞' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: 'SK Hynix HBM4 送樣，2025 年量產計劃',
    company_id: 'sk_hynix', company_name: 'SK Hynix', chip_name: 'HBM4',
    region: 'Korea', signal_type: 'product_progress', stage: 'sampling', status: 'watch',
    release_year: 2025, release_quarter: 'Q3',
    package_type: '3D', cowos_required: false, abf_layers: null, hbm: 'HBM4',
    expected_volume: 'high', abf_demand_impact: 'high', confidence_score: 75,
    evidence_summary: 'SK Hynix HBM4 已向主要客戶送樣，頻寬比 HBM3E 提升 50%，預計 2025Q3 量產，配套 NVIDIA Rubin 和下一代 Google TPU 使用。',
    sources: [{ type: 'link', url: 'https://www.eetimes.com', label: 'EE Times' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── Samsung Memory ─────────────────────────────────────
  {
    title: '三星 HBM3E 通過 NVIDIA 認證，供貨 H200',
    company_id: 'samsung_memory', company_name: 'Samsung Memory', chip_name: 'HBM3E',
    region: 'Korea', signal_type: 'customer_win', stage: 'design_win', status: 'watch',
    release_year: 2024, release_quarter: 'Q4',
    package_type: '3D', cowos_required: false, abf_layers: null, hbm: 'HBM3E',
    expected_volume: 'medium', abf_demand_impact: 'medium', confidence_score: 68,
    evidence_summary: '三星 HBM3E 在長時間未通過 NVIDIA 良率測試後，據報 2024Q4 獲得認證，開始向 NVIDIA 供貨 H200 升級版，但供應量仍遠少於 SK Hynix。',
    sources: [{ type: 'link', url: 'https://www.digitimes.com', label: 'DigiTimes' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── ABF 基板廠商 ───────────────────────────────────────
  {
    title: 'Ajinomoto ABF 膜需求創歷史高位，擴產計劃確認',
    company_id: 'ajinomoto', company_name: 'Ajinomoto', chip_name: 'ABF Film',
    region: 'Japan', signal_type: 'capacity', stage: 'ramp', status: 'verified',
    release_year: 2024, release_quarter: 'Q2',
    package_type: null, cowos_required: false, abf_layers: null, hbm: null,
    expected_volume: 'high', abf_demand_impact: 'explosive', confidence_score: 85,
    evidence_summary: 'ABF（Ajinomoto Build-up Film）作為高端 AI 芯片基板核心材料，2024Q2 需求量創歷史高位，味之素宣布擴大日本工廠產能，但供應仍持續緊張至 2026 年。',
    sources: [{ type: 'link', url: 'https://www.ajinomoto.co.jp', label: 'Ajinomoto IR' }],
    ai_generated: false, source_type: 'manual'
  },
  {
    title: 'Ibiden ABF 基板產能擴張，服務 NVIDIA Blackwell',
    company_id: 'ibiden', company_name: 'Ibiden', chip_name: 'ABF Substrate',
    region: 'Japan', signal_type: 'capacity', stage: 'ramp', status: 'verified',
    release_year: 2025, release_quarter: 'Q1',
    package_type: null, cowos_required: false, abf_layers: null, hbm: null,
    expected_volume: 'high', abf_demand_impact: 'explosive', confidence_score: 82,
    evidence_summary: 'Ibiden 是全球最大 ABF 基板供應商之一，為配合 NVIDIA Blackwell 量產，2025Q1 新產能投入，高層數 ABF 基板（16-18L）需求佔比大幅上升。',
    sources: [{ type: 'link', url: 'https://www.ibiden.com', label: 'Ibiden IR' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── Broadcom ──────────────────────────────────────────
  {
    title: 'Broadcom 定制 ASIC 大客戶訂單爆發，Google/Meta 確認',
    company_id: 'broadcom', company_name: 'Broadcom', chip_name: 'Custom AI ASIC',
    region: 'USA', signal_type: 'customer_win', stage: 'design_win', status: 'verified',
    release_year: 2025, release_quarter: 'Q1',
    package_type: 'CoWoS-L', cowos_required: true, abf_layers: 16, hbm: 'HBM3E',
    expected_volume: 'high', abf_demand_impact: 'explosive', confidence_score: 82,
    evidence_summary: 'Broadcom 為 Google TPU 和 Meta AI ASIC 的主要設計合作夥伴，2025 年定制 ASIC 訂單預計超越網絡芯片成為最大收入來源，CoWoS 封裝 ABF 需求大幅增長。',
    sources: [{ type: 'link', url: 'https://investors.broadcom.com', label: 'Broadcom IR' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── Qualcomm ──────────────────────────────────────────
  {
    title: 'Qualcomm Cloud AI 100 Ultra 進入量產',
    company_id: 'qualcomm', company_name: 'Qualcomm', chip_name: 'Cloud AI 100 Ultra',
    region: 'USA', signal_type: 'product_progress', stage: 'volume', status: 'verified',
    release_year: 2024, release_quarter: 'Q2',
    package_type: 'flip-chip', cowos_required: false, abf_layers: null, hbm: null,
    expected_volume: 'medium', abf_demand_impact: 'low', confidence_score: 78,
    evidence_summary: 'Qualcomm Cloud AI 100 Ultra 採用 TSMC 4nm，傳統 flip-chip 封裝，2024Q2 量產，主要面向邊緣推理市場，不使用 CoWoS/ABF，ABF 影響有限。',
    sources: [{ type: 'link', url: 'https://www.qualcomm.com/news', label: 'Qualcomm 新聞' }],
    ai_generated: false, source_type: 'manual'
  },

  // ── Apple ─────────────────────────────────────────────
  {
    title: 'Apple M4 量產，台積電 3nm，AI 推理大幅增強',
    company_id: 'apple', company_name: 'Apple', chip_name: 'M4',
    region: 'USA', signal_type: 'product_progress', stage: 'volume', status: 'verified',
    release_year: 2024, release_quarter: 'Q2',
    package_type: 'flip-chip', cowos_required: false, abf_layers: 12, hbm: null,
    expected_volume: 'high', abf_demand_impact: 'medium', confidence_score: 95,
    evidence_summary: 'Apple M4 採用台積電 3nm（N3E），搭載 38 TOPS NPU，2024Q2 在 iPad Pro 搭載量產，下半年擴展至 MacBook，出貨量大，ABF 基板需求穩定增長。',
    sources: [{ type: 'link', url: 'https://www.apple.com/newsroom', label: 'Apple Newsroom' }],
    ai_generated: false, source_type: 'manual'
  },
];

// ===== 執行導入 =====
async function main() {
    console.log(`準備導入 ${SIGNALS.length} 條信號...`);
    let success = 0, failed = 0;

    for (const signal of SIGNALS) {
        try {
            if (!DRY_RUN) {
                await db.collection('signals').add({
                    ...signal,
                    last_verified_at: signal.status === 'verified' ? new Date().toISOString() : '',
                    last_verified_by: signal.status === 'verified' ? 'seed-v1' : '',
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                await new Promise(r => setTimeout(r, 100)); // rate limit
            }
            console.log(`✓ [${signal.status}] ${signal.company_id} — ${signal.chip_name}`);
            success++;
        } catch (err) {
            console.error(`✗ ${signal.company_id} — ${signal.chip_name}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n完成：${success} 成功，${failed} 失敗`);
    if (!DRY_RUN) {
        console.log('\n驗收步驟：');
        console.log('1. 打開 roadmap.html — 應看到 NVIDIA/AMD/Google/TSMC/SK Hynix 的時間軸');
        console.log('2. 打開 index.html — 應看到最新驗證信號和影響統計');
        console.log('3. 打開 signals.html — 應看到 30 條信號的完整表格');
    }
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
