/**
 * patch-companies-data.js
 * 將 Stage C 事實數據批量寫入 data/companies-template.json
 * 執行：node scripts/patch-companies-data.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(__dirname, '../data/companies-template.json');
const template = JSON.parse(readFileSync(PATH, 'utf8'));

// ─── V2-ADD 新增公司的完整事實數據 ─────────────────────────────────────────

const V2_DATA = {

  huawei_ascend: {
    country: '中国', region: 'China', category: 'AI加速器/NPU',
    headquarters: '深圳', founded: 2004, market_cap: '未上市（华为旗下）',
    abf_demand_impact: 'high', ai_chip_focus: true, foundry: 'SMIC/TSMC',
    market_position: '中国AI芯片第一，昇腾910B/920系列主导国产替代',
    description: '华为旗下AI芯片品牌，昇腾系列NPU是中国替代NVIDIA的核心方案。受出口管制影响先进制程受限，正加速国内供应链整合。',
    analysis: {
      strengths: ['国内AI芯片市占率第一', '政策支持力度大', 'CANN软件生态持续完善'],
      weaknesses: ['先进制程受限（7nm为主）', 'CoWoS产能依赖受阻', 'CUDA软件生态差距大'],
      opportunities: ['国产替代需求强劲', '昇腾920升级预期', '大模型训练本土化'],
      threats: ['NVIDIA技术代差', '出口管制加剧', '制程瓶颈难以突破']
    }
  },

  cambricon: {
    country: '中国', region: 'China', category: 'AI加速器/NPU',
    headquarters: '北京', founded: 2016, market_cap: '约200亿人民币',
    abf_demand_impact: 'medium', ai_chip_focus: true, foundry: 'TSMC/SMIC',
    market_position: '中国AI芯片上市第一股，思元590系列训推芯片',
    description: '中科院孵化的AI芯片公司，专注云端和边端AI训练/推理芯片，主要产品为思元系列，A股唯一AI芯片纯正标的。',
    analysis: {
      strengths: ['中国AI芯片A股第一股', '中科院学术背景深厚', '思元590产品成熟量产'],
      weaknesses: ['客户集中度高', '盈利压力持续', '软件生态相对弱'],
      opportunities: ['国产替代政策红利', '大模型推理需求增长', '边缘AI应用拓展'],
      threats: ['华为昇腾强力竞争', '英伟达H20中国特供版', '融资成本高企']
    }
  },

  moore_threads: {
    country: '中国', region: 'China', category: 'GPU',
    headquarters: '北京', founded: 2020, market_cap: '未上市',
    abf_demand_impact: 'low', ai_chip_focus: true, foundry: 'TSMC',
    market_position: '中国通用GPU独角兽，MTT S4000训推一体卡',
    description: '专注通用GPU研发，产品覆盖AI计算、图形渲染和视频编解码。创始团队来自NVIDIA，已被美国列入实体清单。',
    analysis: {
      strengths: ['通用GPU技术路线完整', '创始团队NVIDIA背景', '产品线覆盖全场景'],
      weaknesses: ['被列入美国实体清单', '先进制程获取受限', '市场规模仍小'],
      opportunities: ['国内GPU短缺推动替代需求', '游戏+AI双市场覆盖'],
      threats: ['实体清单限制台积电代工', '英伟达RTX/CUDA生态壁垒', '华为昇腾竞争']
    }
  },

  biren: {
    country: '中国', region: 'China', category: 'GPU/AI加速器',
    headquarters: '上海', founded: 2019, market_cap: '未上市',
    abf_demand_impact: 'low', ai_chip_focus: true, foundry: 'TSMC',
    market_position: '中国高性能GPU初创，BR100系列号称国产最强GPU',
    description: '专注高性能GPU研发，BR100基于7nm工艺，性能对标A100，已被美国列入实体清单，量产进展受阻。',
    analysis: {
      strengths: ['高性能GPU设计能力', '融资规模大（累计超50亿元）'],
      weaknesses: ['被列入实体清单无法使用台积电先进制程', '量产规模极有限'],
      opportunities: ['国产替代高性能GPU空缺'],
      threats: ['实体清单限制', '竞争对手众多', '软件生态几乎空白']
    }
  },

  enflame: {
    country: '中国', region: 'China', category: 'AI加速器',
    headquarters: '上海', founded: 2019, market_cap: '未上市',
    abf_demand_impact: 'low', ai_chip_focus: true, foundry: 'TSMC',
    market_position: '腾讯系AI芯片，云燧T20/T21训练加速卡深度绑定腾讯云',
    description: '腾讯战略投资的AI芯片公司，主打云端AI训练加速，与腾讯云深度整合，是腾讯减少NVIDIA依赖的核心布局。',
    analysis: {
      strengths: ['腾讯云战略客户保障', 'AI训练芯片专注深耕', '软件栈与腾讯生态融合'],
      weaknesses: ['客户过度依赖腾讯', '出口管制限制先进制程'],
      opportunities: ['腾讯混元大模型训练需求', '腾讯云AI服务扩张'],
      threats: ['华为昇腾竞争', 'NVIDIA H20中国特供版']
    }
  },

  horizon_robotics: {
    country: '中国', region: 'China', category: '车载AI芯片/ADAS',
    headquarters: '北京', founded: 2015, market_cap: '约300亿港元',
    abf_demand_impact: 'low', ai_chip_focus: false, foundry: 'TSMC/Samsung',
    market_position: '中国车载AI芯片市占率第一，征程系列合作车厂超30家',
    description: '专注ADAS和自动驾驶AI芯片，征程5/6系列量产，合作比亚迪/理想/长安等主流车厂，2024年赴港上市。',
    analysis: {
      strengths: ['国内车载AI芯片市占率领先', '合作车厂覆盖广', '已上市资金充裕'],
      weaknesses: ['与英伟达Orin技术差距仍存', 'ABF需求规模有限'],
      opportunities: ['中国新能源车智能化渗透率持续提升', 'L2+智驾普及'],
      threats: ['英伟达Orin竞争', '高通Snapdragon Ride布局']
    }
  },

  black_sesame: {
    country: '中国', region: 'China', category: '车载AI芯片/ADAS',
    headquarters: '武汉', founded: 2016, market_cap: '约50亿港元',
    abf_demand_impact: 'low', ai_chip_focus: false, foundry: 'TSMC',
    market_position: '中国车载AI感知芯片，华山A1000系列量产，2024年赴港上市',
    description: '专注汽车智能驾驶感知芯片，华山A1000系列已在多家车厂量产，2024年港股上市，是中国自动驾驶芯片细分领域代表。',
    analysis: {
      strengths: ['华山A1000系列量产落地', '专注车载细分市场', '已上市融资渠道通畅'],
      weaknesses: ['规模较小', '与地平线差距明显', '盈利压力大'],
      opportunities: ['自动驾驶芯片国产化替代', '车厂智能化升级需求'],
      threats: ['地平线/英伟达竞争', '市场集中度提升']
    }
  },

  iluvatar: {
    country: '中国', region: 'China', category: 'AI加速器/GPGPU',
    headquarters: '上海', founded: 2018, market_cap: '未上市',
    abf_demand_impact: 'low', ai_chip_focus: true, foundry: 'TSMC',
    market_position: '中国GPGPU初创，天垓100系列面向AI训练和HPC',
    description: '专注通用GPU和AI加速器，天垓100基于7nm工艺，面向AI训练和高性能计算场景，已获多轮融资。',
    analysis: {
      strengths: ['GPGPU技术路线积累', 'HPC应用场景覆盖'],
      weaknesses: ['知名度较低', '量产规模有限', '软件生态薄弱'],
      opportunities: ['HPC领域国产化需求', '科研计算市场'],
      threats: ['英伟达/华为昇腾竞争', '出口管制间接影响']
    }
  },

  tsmc: {
    country: '台湾', region: 'Taiwan', category: '晶圆代工',
    headquarters: '新竹', founded: 1987, market_cap: '约9000亿美元',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '全球晶圆代工市占率约60%，掌握3nm/2nm最先进制程，CoWoS先进封装供不应求',
    description: '全球最大晶圆代工厂，是NVIDIA/AMD/Apple/Broadcom等芯片设计公司的核心制造伙伴。CoWoS先进封装产能是当前AI芯片供应链最大瓶颈之一。',
    analysis: {
      strengths: ['先进制程领先业界2-3年', 'CoWoS先进封装扩产中', '客户粘性极高无可替代'],
      weaknesses: ['地缘政治风险高度集中台湾', 'CoWoS产能持续短缺'],
      opportunities: ['AI芯片需求驱动代工需求爆发', '先进封装扩产带来更高单价'],
      threats: ['地缘政治风险', '三星/英特尔代工追赶']
    }
  },

  samsung_foundry: {
    country: '韩国', region: 'Korea', category: '晶圆代工',
    headquarters: '华城（京畿道）', founded: 1969, market_cap: '（三星电子旗下）',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '全球晶圆代工市占率约10%，3nm GAA工艺已量产，追赶台积电',
    description: '三星电子旗下代工部门，提供4nm/3nm GAA工艺，良率问题是主要挑战，正争取AI芯片高端代工订单。',
    analysis: {
      strengths: ['GAA工艺率先量产', '内存+代工垂直整合协同', 'HBM自供优势'],
      weaknesses: ['良率问题持续影响客户信心', '高端客户流失风险'],
      opportunities: ['AI芯片代工需求溢出台积电', 'GAA工艺成熟后差异化竞争'],
      threats: ['台积电技术和良率领先', '英特尔代工（IFS）追赶']
    }
  },

  smic: {
    country: '中国', region: 'China', category: '晶圆代工',
    headquarters: '上海', founded: 2000, market_cap: '约1600亿港元',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '中国最大晶圆代工厂，制程上限约7nm（受出口管制），成熟制程14nm主力',
    description: '中国最大集成电路制造商，受美国出口管制限制先进制程发展，14nm成熟制程是核心业务，承接大量国产芯片代工需求。',
    analysis: {
      strengths: ['国内代工市场垄断地位', '政策支持力度大', '14nm工艺成熟稳定'],
      weaknesses: ['先进制程受出口管制严重限制', 'EUV光刻机采购被禁'],
      opportunities: ['国产替代政策红利', '成熟制程需求（汽车/工控）稳定'],
      threats: ['美国出口管制持续收紧', '先进制程无法追赶国际']
    }
  },

  gf: {
    country: '美国', region: 'USA', category: '晶圆代工',
    headquarters: '马耳他（纽约州）', founded: 2009, market_cap: '约300亿美元',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '全球第三大代工厂，专注12nm以上成熟制程，聚焦汽车/IoT/射频半导体',
    description: '退出7nm以下先进制程竞争，专注差异化成熟工艺，在美国/欧洲/新加坡有制造基地，受CHIPS法案支持。',
    analysis: {
      strengths: ['成熟制程利基市场稳定', '美国/欧洲本土化战略受政策支持', 'CHIPS法案补贴受益'],
      weaknesses: ['不参与先进制程竞争', '市场份额有限'],
      opportunities: ['汽车芯片和IoT成熟制程需求持续', '本土化供应链战略受益'],
      threats: ['成熟制程产能过剩', '中国代工厂低价竞争']
    }
  },

  sk_hynix: {
    country: '韩国', region: 'Korea', category: 'DRAM/HBM/NAND',
    headquarters: '利川（京畿道）', founded: 1983, market_cap: '约1000亿美元',
    abf_demand_impact: 'medium', ai_chip_focus: false, foundry: '',
    market_position: '全球HBM市占率约50%，NVIDIA H200/B200 HBM3E独供，AI时代最受益内存厂',
    description: 'AI计算时代最大受益者之一，HBM3E独家供应NVIDIA，HBM4已进入开发阶段，与NVIDIA战略绑定深度。',
    analysis: {
      strengths: ['HBM全球市场领先', 'NVIDIA长期战略供应商', 'HBM4技术路线清晰'],
      weaknesses: ['HBM产能扩张受封装设备瓶颈', 'NAND市场价格竞争激烈'],
      opportunities: ['AI训练对HBM需求爆发式增长', 'HBM4高价值升级周期'],
      threats: ['三星/美光追赶HBM', 'AI投资放缓时需求端风险']
    }
  },

  micron: {
    country: '美国', region: 'USA', category: 'DRAM/HBM/NAND',
    headquarters: '博伊西（爱达荷州）', founded: 1978, market_cap: '约1100亿美元',
    abf_demand_impact: 'medium', ai_chip_focus: false, foundry: '',
    market_position: '美国唯一大型内存厂，HBM3E已量产出货，CHIPS法案支持本土扩产',
    description: '美国本土唯一大型DRAM/NAND制造商，HBM3E量产并向NVIDIA供货，受CHIPS法案补贴支持在美建厂。',
    analysis: {
      strengths: ['美国本土内存唯一大厂', 'CHIPS法案补贴优势', 'HBM3E量产进入正轨'],
      weaknesses: ['HBM市占率落后SK海力士', 'NAND价格周期波动'],
      opportunities: ['AI服务器内存需求持续增长', '本土化供应链政策红利'],
      threats: ['SK海力士/三星HBM技术领先', '中国CXMT低价竞争成熟制程']
    }
  },

  samsung_memory: {
    country: '韩国', region: 'Korea', category: 'DRAM/HBM/NAND',
    headquarters: '华城（京畿道）', founded: 1969, market_cap: '（三星电子旗下）',
    abf_demand_impact: 'medium', ai_chip_focus: false, foundry: '',
    market_position: '全球最大DRAM/NAND厂商，HBM3E被NVIDIA认证延迟，市场份额被SK海力士超越',
    description: '全球内存市场规模最大，但在HBM领域被SK海力士超越，正积极追赶HBM3E/4良率和NVIDIA认证。',
    analysis: {
      strengths: ['内存总体市场规模最大', '规模效应成本竞争力强', '代工+内存垂直整合'],
      weaknesses: ['HBM良率问题延误NVIDIA认证', '先进HBM市占下滑'],
      opportunities: ['HBM4市场重夺领先地位', 'AI内存需求长期增长'],
      threats: ['SK海力士HBM领先地位稳固', '美国制裁风险']
    }
  },

  cxmt: {
    country: '中国', region: 'China', category: 'DRAM',
    headquarters: '合肥（安徽）', founded: 2016, market_cap: '未上市',
    abf_demand_impact: 'low', ai_chip_focus: false, foundry: '',
    market_position: '中国唯一量产DRAM厂，19nm DDR4，国产替代主力军',
    description: '中国最重要的DRAM国产替代项目，由合肥政府主导，技术源于奇梦达专利，当前量产19nm DDR4，HBM尚无量产能力。',
    analysis: {
      strengths: ['国内DRAM唯一规模量产', '政府资金和政策支持强', '国产替代需求旺盛'],
      weaknesses: ['技术代差约3-4代', 'HBM无量产能力', '先进制程设备获取困难'],
      opportunities: ['国内数据中心DRAM国产化', '消费级DRAM市场渗透'],
      threats: ['美国技术/设备封锁加剧', '先进制程无法独立突破']
    }
  },

  ibiden: {
    country: '日本', region: 'Japan', category: 'ABF载板/PCB',
    headquarters: '大垣市（岐阜县）', founded: 1912, market_cap: '约6000亿日元',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '全球ABF载板市占率约40%，是揖斐电薄膜（ABF材料命名来源），NVIDIA/AMD最核心基板供应商',
    description: '全球最大ABF（Ajinomoto Build-up Film）载板供应商，是AI芯片供应链最关键瓶颈环节，高层数ABF技术全球领先。',
    analysis: {
      strengths: ['ABF载板全球市占第一', 'NVIDIA/AMD长期战略供应商', '高层数ABF技术护城河深'],
      weaknesses: ['产能扩张速度受设备和工艺限制', '单一产品线依赖风险'],
      opportunities: ['AI芯片高层数ABF需求爆发', '产能供不应求推动持续涨价'],
      threats: ['欣兴/南亚/景硕产能扩张追赶', '产能瓶颈限制收入增速']
    }
  },

  shinko: {
    country: '日本', region: 'Japan', category: 'ABF载板/封装基板',
    headquarters: '长野', founded: 1946, market_cap: '约3000亿日元',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '全球ABF载板市占率约20%，英特尔历史主要供应商',
    description: '日本重要ABF载板供应商，英特尔传统长期战略合作商，也为AMD和多家AI芯片客户提供封装基板。',
    analysis: {
      strengths: ['与英特尔长期战略绑定', 'ABF载板工艺技术积累深厚'],
      weaknesses: ['英特尔业务萎缩直接影响订单', '台湾/中国对手成本竞争力'],
      opportunities: ['开拓AI新客户', '高层数ABF技术升级涨价'],
      threats: ['揖斐电技术和市场份额领先', '英特尔客户集中风险高']
    }
  },

  unimicron: {
    country: '台湾', region: 'Taiwan', category: 'ABF载板/PCB',
    headquarters: '桃园', founded: 1990, market_cap: '约3000亿新台币',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '台湾最大ABF载板厂，全球第三，积极扩产高层数ABF与日本厂竞争',
    description: '台湾最大PCB和ABF载板厂商，积极投资扩产高层数ABF载板，是日本揖斐电和新光电气的主要亚洲竞争对手。',
    analysis: {
      strengths: ['台湾ABF载板龙头', '产能扩张积极主动', '成本竞争力相对日本厂强'],
      weaknesses: ['高层数ABF良率仍落后揖斐电', '技术积累历史较短'],
      opportunities: ['AI芯片ABF需求旺盛溢出到台湾厂', '揖斐电产能不足时承接订单'],
      threats: ['揖斐电技术护城河深', '南亚/景硕竞争']
    }
  },

  nan_ya_pcb: {
    country: '台湾', region: 'Taiwan', category: 'PCB/ABF载板',
    headquarters: '桃园', founded: 1970, market_cap: '约500亿新台币',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '台塑集团旗下PCB厂，积极布局ABF载板，规模小于欣兴/景硕',
    description: '台塑集团旗下PCB制造商，正积极进入ABF载板市场，背靠台塑集团资金资源，产能和技术规模相对欣兴较小。',
    analysis: {
      strengths: ['台塑集团资金背景支持', 'PCB基础工艺成熟稳定'],
      weaknesses: ['ABF载板规模和经验落后同业', '高层数ABF技术积累有限'],
      opportunities: ['AI芯片ABF需求扩容带来进入机会'],
      threats: ['欣兴/景硕/揖斐电竞争优势明显']
    }
  },

  kinsus: {
    country: '台湾', region: 'Taiwan', category: 'ABF载板/IC载板',
    headquarters: '龙潭（桃园）', founded: 1998, market_cap: '约600亿新台币',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '台湾ABF/BT载板专业厂，IC载板深耕多年',
    description: '专注IC载板（ABF和BT）制造，是台湾主要ABF载板供应商之一，客户涵盖多家AI和消费电子芯片设计公司。',
    analysis: {
      strengths: ['IC载板专注深耕', '台湾ABF载板重要配套供应商'],
      weaknesses: ['规模明显小于欣兴', '高层数ABF能力有限'],
      opportunities: ['AI芯片基板需求增长', '欣兴产能满载溢出订单'],
      threats: ['欣兴/揖斐电竞争', '产能扩张需大量资本投入']
    }
  },

  at_s: {
    country: '奥地利', region: 'Europe', category: 'ABF载板/HDI PCB',
    headquarters: '莱布尼茨（奥地利）', founded: 1987, market_cap: '约10亿欧元',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '欧洲最大PCB厂，在马来西亚建有ABF载板工厂，英特尔封装基板供应商',
    description: '欧洲最大高端PCB和基板厂商，马来西亚工厂主要为英特尔等客户提供ABF载板，是欧洲本土PCB最重要企业。',
    analysis: {
      strengths: ['欧洲PCB/ABF市场独特地位', '英特尔战略合作伙伴'],
      weaknesses: ['规模相对亚洲竞争对手小', '成本劣势明显'],
      opportunities: ['欧洲半导体供应链本土化政策', 'ABF市场扩容带来增量'],
      threats: ['亚洲竞争对手（揖斐电/欣兴）成本优势', '英特尔客户集中风险']
    }
  },

  zhen_ding: {
    country: '台湾', region: 'Taiwan', category: 'FPC/PCB',
    headquarters: '桃园', founded: 2000, market_cap: '约800亿新台币',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '台湾FPC软板龙头，ABF载板业务占比较小，间接受益AI',
    description: '主力业务为FPC（软性电路板），PCB硬板和ABF基板规模较小，相比欣兴受益AI芯片需求较间接。',
    analysis: {
      strengths: ['FPC软板市场领先地位', '大型消费电子客户资源'],
      weaknesses: ['ABF载板非主力业务', '受益AI芯片需求较间接'],
      opportunities: ['消费电子FPC需求稳定', '逐步布局高端基板'],
      threats: ['ABF专注厂商竞争优势更强', 'FPC市场价格竞争激烈']
    }
  },

  ase: {
    country: '台湾', region: 'Taiwan', category: '封装测试/OSAT',
    headquarters: '高雄', founded: 1984, market_cap: '约8000亿新台币',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '全球最大OSAT，积极布局CoWoS和SoIC先进封装与台积电互补合作',
    description: '全球规模最大的外包半导体封装测试（OSAT）公司，在先进封装（CoWoS转包、SoIC）领域持续布局，与台积电互补。',
    analysis: {
      strengths: ['OSAT全球市占第一', '先进封装能力持续提升', '规模效应显著'],
      weaknesses: ['先进封装技术仍落后台积电', 'CoWoS依赖台积电转包'],
      opportunities: ['AI芯片封装需求旺盛', '台积电CoWoS产能满载时溢出承接'],
      threats: ['台积电自做封装趋势', '艾克尔等竞争']
    }
  },

  amkor: {
    country: '美国', region: 'USA', category: '封装测试/OSAT',
    headquarters: '坦佩（亚利桑那州）', founded: 1968, market_cap: '约60亿美元',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '全球第二大OSAT，苹果/高通核心封装合作商，积极布局先进封装',
    description: '全球第二大OSAT，苹果iPhone芯片的主要封装合作伙伴，在CHIPS法案支持下扩大美国本土封装产能。',
    analysis: {
      strengths: ['苹果战略合作商地位稳固', '先进封装能力持续提升', '美国本土化优势'],
      weaknesses: ['规模小于日月光', '先进封装能力有限'],
      opportunities: ['CHIPS法案支持本土封装建设', 'AI芯片封装需求增长'],
      threats: ['日月光规模和成本竞争', '台积电自做封装趋势']
    }
  },

  spil: {
    country: '台湾', region: 'Taiwan', category: '封装测试/OSAT',
    headquarters: '潭子（台中）', founded: 1984, market_cap: '（日月光旗下，已私有化）',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '日月光旗下子公司，台湾第二大OSAT，提供标准封测服务',
    description: '已被日月光收购并整合，作为日月光集团子公司运营，专注标准封装和测试服务，与日月光产能协同。',
    analysis: {
      strengths: ['日月光集团协同效应强', '封装工艺积累深厚'],
      weaknesses: ['独立品牌弱化', '自主发展空间有限'],
      opportunities: ['日月光集团AI芯片封装需求分流'],
      threats: ['品牌独立性持续下降']
    }
  },

  jcet: {
    country: '中国', region: 'China', category: '封装测试/OSAT',
    headquarters: '江阴（江苏）', founded: 1972, market_cap: '约450亿人民币',
    abf_demand_impact: 'none', ai_chip_focus: false, foundry: '',
    market_position: '中国最大OSAT，全球第三，2015年收购星科金朋后规模跃升',
    description: '中国最大封装测试企业，通过收购星科金朋进入国际市场，服务高通/博通等国际客户，是中国OSAT国际化代表。',
    analysis: {
      strengths: ['中国OSAT最大体量', '国际客户认可度高', '低成本竞争优势'],
      weaknesses: ['先进封装能力落后日月光/艾克尔', '技术升级资本需求大'],
      opportunities: ['中国芯片封装国产化需求', 'AI芯片标准封装增量'],
      threats: ['日月光/艾克尔先进封装竞争', '中国市场价格竞争']
    }
  },

  openai: {
    country: '美国', region: 'USA', category: 'AI研究/大模型',
    headquarters: '旧金山', founded: 2015, market_cap: '约3000亿美元（估值）',
    abf_demand_impact: 'high', ai_chip_focus: false, foundry: '',
    market_position: 'ChatGPT/GPT-4o全球AI市场引领者，用户超3亿，最大GPU算力采购方之一',
    description: 'ChatGPT和GPT系列大模型开发商，全球AI市场领导者，大规模采购NVIDIA GPU，是ABF需求的重要间接驱动力。',
    analysis: {
      strengths: ['全球AI品牌影响力最强', '微软独家战略支持', 'API生态已成行业标准'],
      weaknesses: ['GPU采购成本极高', '商业模式盈利路径压力'],
      opportunities: ['AGI推进驱动更大规模算力投资', 'API企业化商业化扩张'],
      threats: ['谷歌/Anthropic/Mistral竞争加剧', '监管风险', '算力成本压制利润']
    }
  },

  anthropic: {
    country: '美国', region: 'USA', category: 'AI研究/大模型',
    headquarters: '旧金山', founded: 2021, market_cap: '约600亿美元（估值）',
    abf_demand_impact: 'medium', ai_chip_focus: false, foundry: '',
    market_position: 'Claude系列大模型企业市场份额快速增长，AWS战略投资约40亿美元',
    description: 'Claude系列AI助手开发商，前OpenAI核心成员创立，亚马逊重金战略投资，专注安全可靠的大模型研究。',
    analysis: {
      strengths: ['Claude企业级AI竞争力强', 'AWS战略合作独家云', '安全AI定位差异化'],
      weaknesses: ['规模仍小于OpenAI', 'GPU采购依赖度高'],
      opportunities: ['企业AI采购市场持续爆发', '100万TPU订单驱动大量算力需求'],
      threats: ['OpenAI/谷歌竞争', '算力获取成本压力']
    }
  },

  deepseek: {
    country: '中国', region: 'China', category: 'AI研究/大模型',
    headquarters: '杭州', founded: 2023, market_cap: '未上市（幻方量化旗下）',
    abf_demand_impact: 'medium', ai_chip_focus: false, foundry: '',
    market_position: 'DeepSeek-R1以极低成本颠覆AI行业，2025年开源模型全球性能第一，重塑全球算力需求预期',
    description: '幻方量化旗下AI研究机构，R1模型以极低训练成本达到顶级性能，引发全球AI效率竞争格局重估，开源生态影响力极大。',
    analysis: {
      strengths: ['低成本高性能训练方法突破', '开源策略全球影响力巨大', '量化基金充裕算力资源支持'],
      weaknesses: ['出口管制限制GPU获取', '商业化路径尚不清晰'],
      opportunities: ['中国AI算力国产化需求推动', '低成本方法引发全球效率竞争'],
      threats: ['美国出口管制（H800封锁）', '顶级AI人才竞争激烈']
    }
  },

  meta: {
    country: '美国', region: 'USA', category: '社交媒体/AI/自研芯片',
    headquarters: '门洛帕克（加利福尼亚州）', founded: 2004, market_cap: '约1.5万亿美元',
    abf_demand_impact: 'high', ai_chip_focus: false, foundry: '',
    market_position: 'Llama开源模型主导，2025年AI资本支出600亿美元，GPU采购规模全球前三',
    description: 'Facebook/Instagram母公司，大规模自建AI基础设施，Llama系列开源模型生态主导，自研MTIA AI芯片用于推理。',
    analysis: {
      strengths: ['GPU采购和数据中心投资规模极大', 'Llama开源生态影响力强', '2025年资本支出600亿美元'],
      weaknesses: ['MTIA自研芯片仍大量依赖NVIDIA', '监管反垄断压力大'],
      opportunities: ['AI广告推荐ROI高', 'AR/VR长期战略布局'],
      threats: ['监管反垄断风险', 'TikTok等平台竞争']
    }
  },

  microsoft: {
    country: '美国', region: 'USA', category: '云计算/AI/自研芯片',
    headquarters: '雷德蒙（华盛顿州）', founded: 1975, market_cap: '约3万亿美元',
    abf_demand_impact: 'high', ai_chip_focus: false, foundry: '',
    market_position: 'OpenAI独家云合作伙伴，Azure AI增速最快，Maia 100自研AI推理芯片投入使用',
    description: 'OpenAI最大战略投资者，通过Azure云提供ChatGPT/Copilot服务，自研Maia 100 AI推理芯片降低NVIDIA依赖。',
    analysis: {
      strengths: ['OpenAI独家战略合作', 'Azure AI企业客户基础深厚', 'Copilot产品生态强'],
      weaknesses: ['OpenAI关系存在潜在依赖风险', '自研芯片尚未大规模部署'],
      opportunities: ['企业AI软件订阅渗透率持续提升', '数据中心扩张驱动供应链需求'],
      threats: ['谷歌Cloud AI竞争', 'OpenAI独立风险']
    }
  },

  amazon_aws: {
    country: '美国', region: 'USA', category: '云计算/自研AI芯片',
    headquarters: '西雅图（华盛顿州）', founded: 2006, market_cap: '（亚马逊旗下，约2万亿美元）',
    abf_demand_impact: 'high', ai_chip_focus: false, foundry: '',
    market_position: '全球云市场份额第一（约31%），Trainium2/Inferentia2自研AI芯片，战略投资Anthropic约40亿美元',
    description: '全球最大云服务商，自研Trainium（训练）和Inferentia（推理）AI芯片减少NVIDIA依赖，战略投资Anthropic。',
    analysis: {
      strengths: ['云市场份额全球第一', '自研芯片降低成本和NVIDIA依赖', 'Anthropic战略绑定'],
      weaknesses: ['AI模型能力弱于Azure和谷歌Cloud', '自研芯片第三方生态有限'],
      opportunities: ['云AI推理需求爆发', 'Trainium2量产进一步降本'],
      threats: ['微软Azure AI快速追赶', '谷歌TPU自给自足优势']
    }
  },

  bytedance: {
    country: '中国', region: 'China', category: '社交媒体/AI/云计算',
    headquarters: '北京', founded: 2012, market_cap: '约3000亿美元（估值）',
    abf_demand_impact: 'high', ai_chip_focus: false, foundry: '',
    market_position: 'TikTok/抖音母公司，豆包大模型快速成长，中国GPU采购量最大科技公司之一',
    description: '全球最大AI内容分发平台，豆包大模型竞争力强，大规模采购NVIDIA H20等AI算力，并积极布局自研芯片。',
    analysis: {
      strengths: ['中国AI算力投入最大之一', '豆包模型快速增长', '海量用户数据优势'],
      weaknesses: ['TikTok受美国监管威胁', 'GPU受出口管制限制'],
      opportunities: ['中国大模型市场份额争夺', '海外AI应用扩张'],
      threats: ['美国TikTok禁令风险', '出口管制限制先进GPU获取']
    }
  },

  alibaba: {
    country: '中国', region: 'China', category: '云计算/AI/自研芯片',
    headquarters: '杭州', founded: 2009, market_cap: '约2500亿美元',
    abf_demand_impact: 'medium', ai_chip_focus: false, foundry: '',
    market_position: '中国云计算市场份额第一（约37%），通义千问开源模型竞争力强，含光800自研AI推理芯片',
    description: '中国最大云服务商，阿里云主导国内市场，通义千问系列开源模型影响力大，含光800自研芯片用于内部推理。',
    analysis: {
      strengths: ['中国云市场份额第一', '通义千问开源生态完善', '电商AI推荐系统ROI高'],
      weaknesses: ['监管整改压力持续', '国际云市场扩张受限'],
      opportunities: ['中国AI云服务需求旺盛', '企业数字化转型持续'],
      threats: ['华为云/腾讯云竞争加剧', '监管不确定性']
    }
  },

  tencent: {
    country: '中国', region: 'China', category: '社交媒体/AI/云计算',
    headquarters: '深圳', founded: 1998, market_cap: '约3500亿美元',
    abf_demand_impact: 'medium', ai_chip_focus: false, foundry: '',
    market_position: '微信生态AI化，混元大模型持续升级，腾讯云AI服务增速快',
    description: '中国最大社交和游戏公司，混元大模型持续升级，微信AI功能深度整合，大规模采购AI算力用于推荐和大模型训练。',
    analysis: {
      strengths: ['微信生态壁垒极强', '游戏+AI+云三引擎驱动', '资本储备充裕'],
      weaknesses: ['大模型综合能力相对中等', '监管合规压力'],
      opportunities: ['微信AI原生应用落地', '游戏AI化提升体验'],
      threats: ['字节跳动竞争激烈', '监管政策风险']
    }
  },

  baidu: {
    country: '中国', region: 'China', category: '搜索/AI/自研芯片',
    headquarters: '北京', founded: 2000, market_cap: '约350亿美元',
    abf_demand_impact: 'medium', ai_chip_focus: true, foundry: 'TSMC/Samsung',
    market_position: '文心大模型最早入场，昆仑芯自研AI芯片，萝卜快跑自动驾驶商业化领先',
    description: '中国搜索引擎龙头，文心一言是国内最早大规模商用大模型，昆仑芯系列自研AI芯片减少NVIDIA依赖，自动驾驶商业化领先。',
    analysis: {
      strengths: ['国内AI大模型最早商用', '昆仑芯自研减少NVIDIA依赖', '自动驾驶萝卜快跑商业化领先'],
      weaknesses: ['搜索市场被抖音等侵蚀', '市值大幅缩水投资者信心不足'],
      opportunities: ['AI搜索重构市场格局', '自动驾驶商业化加速'],
      threats: ['字节/阿里大模型竞争激烈', 'DeepSeek技术冲击']
    }
  }
};

// ─── V1-UPDATE 只補充缺失字段 ────────────────────────────────────────────────

const V1_PATCHES = {
  nvidia: {
    headquarters: '圣克拉拉（加利福尼亚州）', founded: 1993,
    market_cap: '约3.3万亿美元',
    description: '全球AI计算绝对领导者，H100/B200 GPU主导AI训练市场，CoWoS先进封装需求推动ABF供应链变革。',
    abf_demand_impact: 'explosive', ai_chip_focus: true
  },
  amd: {
    headquarters: '圣克拉拉（加利福尼亚州）', founded: 1969,
    market_cap: '约2500亿美元',
    description: 'MI300X系列GPU快速追赶NVIDIA，CPU EPYC服务器市场份额持续提升，是ABF需求增长的第二大驱动力。',
    abf_demand_impact: 'high', ai_chip_focus: true
  },
  intel: {
    headquarters: '圣克拉拉（加利福尼亚州）', founded: 1968,
    market_cap: '约1200亿美元',
    description: '转型中的芯片巨头，英特尔代工（IFS）和AI加速卡Gaudi 3是新增长点，传统CPU份额受AMD侵蚀。',
    abf_demand_impact: 'high', ai_chip_focus: false
  },
  google_tpu: {
    market_cap: '（Alphabet旗下，约2.2万亿美元）',
    description: 'TPU v5p/v6（Trillium）是全球最高效AI训练芯片之一，完全自给自足用于谷歌自身AI服务，不对外销售。',
    abf_demand_impact: 'explosive', ai_chip_focus: true
  },
  apple: {
    headquarters: '库比蒂诺（加利福尼亚州）', founded: 1976,
    market_cap: '约3.5万亿美元',
    description: 'M系列和A系列芯片设计领先行业，Apple Intelligence推动端侧AI，是台积电3nm最大单一客户。',
    abf_demand_impact: 'high', ai_chip_focus: false
  },
  qualcomm: {
    headquarters: '圣地亚哥（加利福尼亚州）', founded: 1985,
    market_cap: '约2000亿美元',
    description: '骁龙系列移动SoC全球市占约30%，骁龙X Elite进攻AI PC市场，汽车芯片Snapdragon Ride快速增长。',
    abf_demand_impact: 'medium', ai_chip_focus: false
  },
  broadcom: {
    headquarters: '帕洛阿尔托（加利福尼亚州）', founded: 1991,
    market_cap: '约8000亿美元',
    description: '为Google/Meta/Apple提供定制AI芯片（XPU），是CoWoS和先进封装需求增长的第三大核心驱动力。',
    abf_demand_impact: 'high', ai_chip_focus: true
  }
};

// ─── 執行 patch ───────────────────────────────────────────────────────────────

let patched = 0;
let skipped = 0;

for (const [id, patch] of Object.entries(V2_DATA)) {
  if (!template.data[id]) {
    console.log(`  SKIP (not found): ${id}`);
    skipped++;
    continue;
  }
  Object.assign(template.data[id], patch);
  template.data[id].__last_updated = '2026-05-15';
  template.data[id].__updated_by = 'stage-c-patch';
  console.log(`  ✓ V2-ADD patched: ${id}`);
  patched++;
}

for (const [id, patch] of Object.entries(V1_PATCHES)) {
  if (!template.data[id]) {
    console.log(`  SKIP (not found): ${id}`);
    skipped++;
    continue;
  }
  // V1-UPDATE: only fill empty fields, don't overwrite existing values
  for (const [key, val] of Object.entries(patch)) {
    const existing = template.data[id][key];
    if (existing === '' || existing === null || existing === undefined) {
      template.data[id][key] = val;
    }
  }
  template.data[id].__last_updated = '2026-05-15';
  template.data[id].__updated_by = 'stage-c-patch';
  console.log(`  ✓ V1-UPDATE patched: ${id}`);
  patched++;
}

template.lastUpdated = '2026-05-15';
template.dataVersion = '2.0.0';
template.note = 'Stage C complete. Ready for import-companies-v2.js.';

writeFileSync(PATH, JSON.stringify(template, null, 2), 'utf8');
console.log(`\n✓ 完成：${patched} 條已更新，${skipped} 條跳過`);
console.log(`  data/companies-template.json 已寫回`);
