# Collector Report - 2026-05-15

## 运行信息
- **RUN_ID**: 20260515-120819
- **RUN_DATE**: 2026-05-15
- **执行时间**: 2026-05-15 12:10 - 12:20 (UTC+8)

## 处理公司

### 1. AT&S (Austria Technologie & Systemtechnik AG) ✅ 写入raw
- **公司ID**: ats
- **中文名**: 奥特斯
- **地区**: 欧洲 (奥地利)
- **类别**: IC基板/ABF载板
- **数据置信度**: 0.75
- **关键发现**:
  - 欧洲最大IC基板厂，1987年成立于奥地利莱奥本
  - 全球生产基地：奥地利(Leoben/Fehring)、印度(Nanjangud)、中国(上海/重庆)、马来西亚(Kulim)
  - 全球约13,000名员工
  - 上海工厂：HDI PCB和mSAP，服务移动设备和IC基板客户
  - 重庆工厂（2011年成立）：先进半导体封装基板和模组产品
  - 深耕中国市场20余年
- **不足**: 缺少营收数据、精确市占率、ABF收入细分
- **来源数**: 3个URL + 1个已有来源
- **状态**: needs_human_review=true

### 2. Nan Ya PCB (南亚电路板) ✅ 写入raw
- **公司ID**: nan-ya-pcb
- **中文名**: 南亚电路板
- **地区**: 台湾
- **类别**: ABF载板
- **数据置信度**: 0.85
- **关键发现**:
  - 全球前三大ABF载板供应商，台塑集团旗下
  - 1997年从南亚塑胶电路板事业部独立
  - 股票代码：8046.TW
  - 母公司南亚塑胶持股约60.97%
  - 2026年1-4月累计营收156.28亿新台币（约33.6亿人民币），年增34%
  - 台湾2个生产基地（锦兴厂、树林厂），江苏昆山1个生产基地
  - 昆山工厂投资10亿美元，员工5000+人
  - 近期事件：母公司拟减持套现约37.5亿人民币
- **不足**: 缺少精确2026年市占率、ABF收入细分
- **来源数**: 3个URL + 1个已有来源
- **状态**: needs_human_review=true

### 3. Zhuhai Access Semiconductor (珠海进芯半导体) ⚠️ 写入unverified
- **公司ID**: zhuhai-access-semiconductor
- **中文名**: 珠海进芯半导体（未确认）
- **地区**: 中国（珠海）
- **类别**: ABF载板
- **数据置信度**: 极低
- **问题**: 
  - Bing/百度搜索均未找到该公司实质性信息
  - 搜索结果返回珠海旅游信息或Microsoft Access软件相关内容
  - 公司可能规模较小、未公开披露信息，或名称有误
- **来源数**: 0
- **状态**: needs_human_review=true，写入unverified目录

## 数据质量说明
- AT&S和Nan Ya PCB的基本信息来源可靠（官网、CNPP品牌网、IC&PCB联盟、百度百科等）
- 两家公司均缺少精确的2026年ABF载板市占率数据，建议人工补充
- Zhuhai Access Semiconductor信息严重不足，需要人工确认公司是否存在/名称是否正确
- 搜索工具限制：网络环境受限，Google/Baidu搜索被屏蔽，Bing搜索对特殊字符（如AT&S中的&）处理不佳

## 产出文件
1. `raw/2026-05-15/company-profiles.raw.jsonl` - 2家公司（AT&S、Nan Ya PCB）
2. `raw/2026-05-15/source-log.raw.jsonl` - 8条来源记录
3. `unverified/2026-05-15/unverified-seeds.jsonl` - 1家公司（Zhuhai Access Semiconductor）
4. `raw/2026-05-15/collector-report.md` - 本报告
