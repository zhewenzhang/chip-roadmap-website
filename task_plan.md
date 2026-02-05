# 芯片 Roadmap 专业分析网站 - 重构计划

## 🎯 核心问题诊断

### 当前网站问题
1. ❌ 只有公司介绍，缺少 Roadmap 时间轴
2. ❌ 缺少对公司深度分析
3. ❌ 页面太"AI化"，不够专业
4. ❌ 数据展示单一

### 解决方案
1. ✅ 加入 Roadmap 时间轴可视化
2. ✅ 添加公司深度分析（市场地位、技术特点）
3. ✅ 专业设计风格（半导体行业风格）
4. ✅ 增加 ABF 载板需求分析
5. ✅ 添加竞争格局分析

## 📊 数据整合

### 数据源
| 数据 | 来源 | 用途 |
|-----|------|------|
| 67款芯片 | CHIP_Master_Database.xlsx | Roadmap 时间轴 |
| 255家公司 | CSV 文件 | 公司列表 |
| 深度分析 | TASK_COMPLETION_REPORT.md | 市场分析 |
| 竞争对手 | competitor_list.csv | 竞争格局 |

### 新增 JSON 数据结构
```json
{
  "companies": [
    {
      "id": "nvidia",
      "name_en": "NVIDIA",
      "name_cn": "英伟达",
      "country": "USA",
      "region": "Americas",
      "category": "AI加速器/GPU",
      "headquarters": "Santa Clara, CA",
      "founded": 1993,
      "market_cap": "$3T+",
      "employees": 29600,
      "abf_demand": "高",
      "market_position": "数据中心GPU市占率80%+",
      "products": [...],
      "roadmap": [...],
      "analysis": {...}
    }
  ],
  "roadmaps": [
    {
      "company": "NVIDIA",
      "timeline": [
        {"year": 2024, "product": "Blackwell B100", "process": "TSMC 4nm"},
        {"year": 2025, "product": "Blackwell B200", "process": "TSMC 4nm"},
        {"year": 2026, "product": "Rubin", "process": "TSMC 3nm"}
      ]
    }
  ],
  "market": {
    "total_companies": 255,
    "by_region": {...},
    "by_category": {...}
  }
}
```

## 📋 执行计划

### Phase 1: 数据重构 [in_progress]
- [ ] 解析 CHIP_Master_Database.xlsx 获取 67 款芯片 Roadmap
- [ ] 整合 255 家公司数据
- [ ] 添加分析字段（市场地位、技术特点）
- [ ] 创建统一 JSON 数据

### Phase 2: 专业设计 [pending]
- [ ] 半导体行业风格设计
- [ ] 深蓝色主色调（科技感）
- [ ] 清晰的数据展示
- [ ] Roadmap 时间轴组件

### Phase 3: 核心页面 [pending]
- [ ] 主页：统计概览 + 市场分析
- [ ] Roadmap 页面：时间轴可视化
- [ ] 公司页面：详情 + 分析
- [ ] 市场分析页面：竞争格局

### Phase 4: 部署 [pending]
- [ ] 更新 GitHub 仓库
- [ ] 自动部署到 Pages

## 🎨 设计规范

### 配色方案
- 主色：#0A1628 (深蓝)
- 强调色：#00D4FF (科技蓝)
- 辅助色：#7B68EE (紫色)
- 背景：#0F172A
- 卡片：#1E293B

### 字体
- 中文：思源黑体 (Source Han Sans)
- 英文：Inter

### 风格
- 简洁、专业、数据驱动
- 避免花哨动画
- 强调可读性

## 错误日志
| 错误 | 尝试 | 解决方案 |
|------|------|----------|
| 网站太AI化 | 1 | 重新设计，采用半导体行业风格 |
| 缺少Roadmap | 1 | 添加时间轴可视化组件 |
| 缺少分析 | 1 | 整合深度分析数据 |

## 进度更新
- 2026-02-05 21:37: 诊断问题，重新规划
