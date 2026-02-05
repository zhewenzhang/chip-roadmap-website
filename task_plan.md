# 芯片 Roadmap 数据库网站项目

## 🎯 目标
创建一个可部署在 GitHub Pages 的芯片公司 Roadmap 查询网站

## 📊 现有数据
- **67+ 款芯片**：已收录在 `semiconductor_roadmaps/`
- **180+ 中国公司**：`china/china_chip_companies_expanded.csv`
- **75+ 海外公司**：`global/global_chip_companies.csv`
- **27 家核心公司**：有详细 Roadmap Excel 文件

## 📋 执行计划

### Phase 1: 数据整理 [in_progress]
- [ ] 统一所有 CSV/Excel 数据为 JSON 格式
- [ ] 验证数据完整性
- [ ] 创建统一数据索引

### Phase 2: 网站开发 [pending]
- [ ] 创建 HTML/CSS/JS 静态网站
- [ ] 实现搜索功能
- [ ] 实现筛选功能（按地区、产品线、制程）
- [ ] 实现 Roadmap 时间轴可视化
- [ ] 响应式设计（移动端适配）

### Phase 3: 部署 [pending]
- [ ] 创建 GitHub 仓库
- [ ] 配置 GitHub Pages
- [ ] 测试部署

### Phase 4: 自动更新机制 [pending]
- [ ] 设计 Cron 任务自动检查更新
- [ ] 创建数据更新脚本

## 📁 文件结构
```
chip-roadmap-website/
├── index.html          # 主页
├── css/
│   └── style.css       # 样式
├── js/
│   └── app.js          # 逻辑
├── data/
│   ├── companies.json  # 公司数据
│   ├── chips.json      # 芯片数据
│   └── roadmaps.json   # Roadmap 数据
└── README.md           # 项目说明
```

## 🎨 网站功能
1. **首页**: 统计概览、最新更新
2. **公司列表**: 按地区分类，可搜索
3. **芯片搜索**: 按名称、制程、应用搜索
4. **Roadmap 时间轴**: 可视化展示
5. **详情页**: 单芯片详细信息

## 错误日志
| 错误 | 尝试 | 解决方案 |
|------|------|----------|
| - | - | - |

## 进度更新
- 2026-02-05 21:13: 项目启动
