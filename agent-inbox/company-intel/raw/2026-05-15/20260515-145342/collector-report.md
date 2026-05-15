# Collector Report - V3 - 2026-05-15

## 运行信息
- **RUN_ID**: 20260515-145342
- **RUN_DATE**: 2026-05-15
- **执行时间**: 2026-05-15 15:00 - 15:15 (UTC+8)

## 处理公司

### 1. DEEPX (迪普信科) ✅ 写入raw
- **公司ID**: deepx
- **韩文名**: 딥엑스
- **地区**: 韩国 (京畿道)
- **类别**: AI_chip (fabless)
- **数据置信度**: 0.85
- **关键发现**:
  - 2018年2月23日成立，专注边缘AI推理NPU
  - 创始人兼CEO Lokwon Kim
  - C轮融资1100亿韩元(约8043万美元)，SkyLake Equity Partners领投，估值增长8倍
  - DX-M1：5nm边缘AI加速器，仅5W功耗即超越40W GPGPU 240%性能
  - DX-M2：与三星合作开发全球首款2nm边缘生成式AI芯片
  - DX-H1 V-NPU：获CES 2026创新奖，节省80%硬件成本
  - 全球NPU专利数量超越高通/ARM/Intel/英伟达，400+专利申请
  - 50+量产项目，与百度/神州数码/现代汽车合作
  - 2026年计划KOSDAQ IPO
  - 入选《2025胡润未来独角兽：全球瞪羚企业榜》
- **SWOT**:
  - 优势：超低功耗技术领先、专利壁垒、CES/WEF多项大奖
  - 劣势：创业公司营收未公开、边缘AI竞争激烈
  - 机会：边缘AI市场增长、中国市场合作、2nm先发优势
  - 威胁：Qualcomm/NVIDIA巨头压力、三星2nm量产不确定性
- **来源数**: 4个URL (百度百科、官网、Coinunited、腾讯新闻)
- **状态**: needs_human_review=false

### 2. Shinko Electric (新光电气工業) ✅ 写入raw (enrichment)
- **公司ID**: shinko-electric
- **地区**: 日本 (长野)
- **类别**: substrate
- **数据置信度**: 0.75
- **关键发现**:
  - **重大事件：2025年6月6日从东京证券交易所Prime Market退市**（确认自IR页面）
  - 全球第三大ABF载板厂，市占率约12%
  - 2023年三菱曾考虑竞购，估值约26亿美元
  - 富士通原持股50%
  - 退市原因不透明，需人工确认
  - 产品：FC-BGA基板、coreless基板、陶瓷静电卡盘
- **不足**: 退市后信息透明度降低，缺少营收数据
- **来源数**: 4个URL (IR页面、同花顺、ALCANTA、114IC)
- **状态**: needs_human_review=true（退市原因、当前所有权、营收数据）

### 3. Zhuhai Access Semiconductor (珠海进芯半导体) ⚠️ 写入unverified
- **地区**: 中国 (珠海)
- **类别**: ABF
- **关键发现**: 3轮搜索均未找到任何实质性公开信息
- **搜索尝试**: 5个搜索词、多平台搜索
- **可能原因**: 公司规模极小/尚未正式运营/公司名称有误
- **建议**: 确认公司名称、通过行业展会/产业园区/供应链名录查找

## 数据质量总结

| 公司 | 数据完整度 | 置信度 | 来源质量 | needs_human_review |
|------|-----------|--------|----------|-------------------|
| DEEPX | 高 | 0.85 | 中 (官网+百科+媒体) | false |
| Shinko Electric | 中 | 0.75 | 弱 (退市后信息有限) | true |
| Zhuhai Access | 无 | N/A | 无 | N/A (unverified) |

## 产出文件
1. `raw/2026-05-15/20260515-145342/company-profiles.raw.jsonl` - 2家公司（DeepX新profile、Shinko Electric enriched）
2. `raw/2026-05-15/20260515-145342/source-log.raw.jsonl` - 8条来源记录
3. `unverified/2026-05-15/20260515-145342/unverified-seeds.jsonl` - 1家待验证公司
4. `raw/2026-05-15/20260515-145342/collector-report.md` - 本报告
