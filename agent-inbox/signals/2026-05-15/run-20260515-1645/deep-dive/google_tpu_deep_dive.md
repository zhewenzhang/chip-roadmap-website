# Google TPU 全景深度研究报告

**报告日期：** 2026年5月15日  
**分析师：** 侦察员  
**报告版本：** 1.0

---

## 一、公司概况与芯片战略

### 1.1 Google TPU 简介

Google Tensor Processing Unit（TPU）是Google自主研发的专用集成电路（ASIC），专为加速机器学习和人工智能工作负载而设计。自2015年首次部署以来，TPU已发展成为全球最成熟、部署规模最大的自研AI芯片平台之一。

TPU的核心设计理念是高效执行矩阵乘法和张量运算——这正是神经网络的基础数学运算。与通用GPU不同，TPU针对AI训练和推理工作负载进行了深度优化，在特定场景下可实现比GPU更高的能效比和成本效率。

### 1.2 战略定位

Google开发TPU的战略动机包括：

1. **降低对NVIDIA的依赖**：通过自研芯片，Google可以控制AI基础设施的核心组件，避免供应链瓶颈和定价被动
2. **成本优化**：针对Google内部大规模AI工作负载（搜索、YouTube、Gmail、Gemini等）定制优化，可实现30-50%的成本优势
3. **差异化云服务**：Google Cloud通过TPU提供独特的AI计算能力，吸引企业客户
4. **技术领先**：推动AI硬件创新，支持下一代大模型训练和推理

### 1.3 市场地位

根据TrendForce 2026年5月的数据，Google 2026年资本支出指导已上调至$180-190B，同比增长超过100%。这一投资规模仅次于AWS（$230B+），位居全球第二。Google在全球拥有约150-200个数据中心，是北美五大CSP之一。

---

## 二、产品路线图时间线

### 2.1 TPU 演进历程

| 代际 | 型号 | 发布时间 | 制程 | 关键特性 |
|------|------|----------|------|----------|
| v1 | TPU v1 | 2015 | 28nm | 首款推理专用ASIC，92 TOPS (INT8) |
| v2 | TPU v2 | 2017 | 28nm | 首款训练+推理芯片，180 TFLOPS |
| v3 | TPU v3 | 2018 | 16nm | 420 TFLOPS，液冷散热 |
| v4 | TPU v4 | 2021 | 7nm | 275 TFLOPS (BF16)，Pod可扩展至4096芯片 |
| v5e | TPU v5e | 2023 | 5nm | 成本优化型，393 TFLOPS (BF16) |
| v5p | TPU v5p | 2024 | 5nm | 高性能型，459 TFLOPS (BF16)，Pod 8960芯片 |
| v6e | TPU v6e (Trillium) | 2024.12 GA | 4nm | 4.7x性能/芯片 vs v5e，2x HBM容量 |
| v7 | TPU v7 (Ironwood) | 2025.05发布 | 3nm | 10x计算性能 vs v6e，192GB HBM，推理优化 |

### 2.2 当前主力产品

#### TPU v5p
- **状态**：量产中，大规模部署
- **性能**：459 TFLOPS (BF16)，2x FLOPS vs TPU v4
- **内存**：95GB HBM，3x内存带宽 vs TPU v4
- **互联**：ICI带宽4,800 Gbps/芯片
- **Pod规模**：最大8,960芯片
- **应用**：训练Gemini模型、Google内部大规模AI工作负载

#### TPU v6e (Trillium)
- **状态**：2024年12月GA，量产中
- **性能**：4.7x计算性能提升 vs TPU v5e
- **内存**：2x HBM容量 vs v5e
- **互联**：2x ICI带宽 vs v5e
- **应用**：Google Cloud AI服务、Gemini 2.0训练

#### TPU v7 (Ironwood)
- **状态**：2025年5月发布，预计2025年底-2026年量产
- **性能**：10x计算性能 vs TPU v6e，针对推理优化
- **内存**：192GB HBM per chip
- **架构**：SparseCore架构，针对稀疏计算优化
- **应用**：大模型推理、Gemini推理服务

### 2.3 下一代TPU预测

基于行业趋势和Google公开信息，预计：

- **TPU v7p**：2026年下半年发布，更高性能变体
- **TPU v8**：2027年，可能采用HBM4和混合键合封装
- **长期趋势**：推理专用化、稀疏计算优化、光互连集成

---

## 三、封装/ABF/供应链详情

### 3.1 封装技术

#### TPU v5p/v6e 封装
- **封装类型**：TSMC CoWoS-S (2.5D Silicon Interposer)
- **Interposer尺寸**：约75mm x 75mm
- **HBM集成**：4-high HBM3 stacks，通过microbumps连接
- **Microbump间距**：40µm
- **基板**：ABF基板，14-18层

#### TPU v7 封装预期
- **封装类型**：TSMC CoWoS-L 或 CoWoS-S演进版
- **HBM集成**：8-high或12-high HBM3E/HBM4 stacks
- **Microbump间距**：缩小至20-30µm
- **功率**：预计500-600W per chip

### 3.2 ABF基板需求

TPU对ABF基板的需求特征：

- **层数**：14-18层（高端配置）
- **面积**：75mm x 75mm以上
- **供应商**：Ibiden（主要）、Shinko（次要）
- **关键要求**：高密度布线、低损耗、热稳定性

随着TPU向v7/v8演进，ABF基板需求将：
- 层数增加至18-22层
- 面积可能增大至100mm x 100mm
- 对低损耗材料需求增加

### 3.3 HBM配置

| 型号 | HBM代际 | 容量 | 带宽 | 供应商 |
|------|---------|------|------|--------|
| TPU v5p | HBM3 | 95GB | 2.4 TB/s | SK Hynix (主), Samsung |
| TPU v6e | HBM3E | ~190GB | ~4.8 TB/s | SK Hynix, Samsung |
| TPU v7 | HBM3E/HBM4 | 192GB | ~6.4 TB/s | SK Hynix, Samsung, Micron |

**关键供应动态：**
- SK Hynix是Google TPU的主要HBM供应商，占据约60-70%份额
- Samsung正在积极追赶，份额约20-30%
- Micron作为第三供应商，份额约10%
- HBM占AI芯片封装成本的40-50%

### 3.4 供应链全景

```
芯片设计: Google (内部设计团队)
    ↓
晶圆代工: TSMC (主要，4nm/3nm)
    ↓
HBM供应: SK Hynix (60-70%), Samsung (20-30%), Micron (10%)
    ↓
ABF基板: Ibiden (主), Shinko (次)
    ↓
封装: TSMC (CoWoS), ASE (部分后端)
    ↓
测试: TSMC, ASE, Google内部
    ↓
系统集成: Google (服务器设计、数据中心部署)
```

---

## 四、竞争格局分析

### 4.1 TPU vs NVIDIA B200/B300/GB200

| 维度 | Google TPU v7 | NVIDIA B200 | NVIDIA GB200 NVL72 |
|------|---------------|-------------|---------------------|
| 定位 | 推理优化ASIC | 通用AI GPU | 机架级AI系统 |
| 性能 | ~10x v6e | 1,800 TFLOPS (FP8) | 72 GPU NVLink域 |
| 内存 | 192GB HBM | 192GB HBM3E | 13.5TB HBM3E |
| 优势 | 成本效率、能效比 | 生态系统、CUDA | 大规模训练 |
| 劣势 | 生态封闭、灵活性低 | 成本较高 | 复杂度高 |

**关键差异：**

1. **生态系统**：NVIDIA CUDA生态系统拥有数百万开发者和数万个应用，TPU生态相对封闭
2. **灵活性**：GPU可支持多种AI框架和算法，TPU针对特定工作负载优化
3. **成本**：TPU在大规模推理场景下可实现30-50%成本优势
4. **供应**：NVIDIA供应紧张，TPU可为Google Cloud客户提供差异化算力

### 4.2 TPU vs AMD MI300X/MI400

| 维度 | Google TPU v7 | AMD MI300X | AMD MI400 (预期) |
|------|---------------|------------|------------------|
| 架构 | ASIC | APU (CPU+GPU) | APU演进 |
| 内存 | 192GB HBM | 192GB HBM3 | 288GB HBM3E |
| 优势 | 推理效率 | 通用性、内存容量 | 性能提升 |
| 市场 | Google内部+Cloud | 企业/HPC | 2026年发布 |

### 4.3 CSP自研芯片对比

| CSP | 芯片 | 状态 | 定位 |
|-----|------|------|------|
| Google | TPU | 最成熟，v7量产 | 训练+推理 |
| AWS | Trainium2/Inferentia2 | 2024量产 | 训练+推理 |
| Microsoft | Maia 100 | 2024小规模 | 推理+Copilot |
| Meta | MTIA v2 | 2024部署 | 推理 |

**Google TPU领先优势：**
- 部署规模最大（全球数百万颗TPU）
- 迭代速度最快（每12-18个月一代）
- 内部工作负载最多样化（搜索、YouTube、Gmail、Gemini）
- Cloud商业化最成熟（TPU Cloud产品线完整）

### 4.4 市场份额与客户争夺

**AI加速器市场份额（2025年估计）：**
- NVIDIA：~80-85%
- Google TPU：~8-10%
- AMD：~3-5%
- 其他（AWS/Microsoft/Intel等）：~5-7%

**客户争夺动态：**
- Google Cloud通过TPU差异化吸引AI客户（Anthropic、Character.AI等）
- 但企业客户仍倾向NVIDIA（CUDA兼容性、供应商锁定风险低）
- AWS Trainium2通过低价策略争夺训练市场
- Microsoft Maia主要服务内部Copilot工作负载

---

## 五、关键风险与机会

### 5.1 风险

1. **技术风险**
   - TPU架构灵活性不足，难以适应快速变化的AI算法
   - 推理专用化可能导致训练能力相对弱化
   - 对TSMC先进制程和CoWoS封装高度依赖

2. **供应链风险**
   - TSMC CoWoS产能紧张，可能限制TPU出货
   - HBM供应集中于SK Hynix，存在单一供应商风险
   - ABF基板产能可能成为瓶颈

3. **竞争风险**
   - NVIDIA B300/GB200性能大幅提升
   - AMD MI400可能在性价比上形成竞争
   - AWS Trainium2在训练场景可能分流客户

4. **市场风险**
   - AI投资回报不确定，CapEx可持续性存疑
   - 开源模型可能降低对专用硬件的需求
   - 地缘政治风险影响供应链

### 5.2 机会

1. **推理市场爆发**
   - TPU v7针对推理优化，符合市场趋势
   - 推理工作负载增长速度快于训练
   - SparseCore架构可有效支持稀疏模型

2. **Cloud差异化**
   - TPU为Google Cloud提供独特卖点
   - 吸引对成本敏感的AI客户
   - 支持Google内部AI服务降本增效

3. **技术领先**
   - 自研芯片可针对特定工作负载深度优化
   - 迭代速度快于通用GPU
   - 可整合软硬件全栈优化

4. **生态系统扩展**
   - JAX框架生态逐步成熟
   - PyTorch/XLA支持改善
   - 越来越多AI公司采用TPU

---

## 六、结论与采购建议

### 6.1 核心结论

1. **Google TPU是全球最成熟的自研AI芯片平台**，已发展至第7代，在Google内部和Cloud服务中大规模部署

2. **TPU v7 (Ironwood)标志着战略转向**：从训练为主转向推理优化，反映AI市场从训练向推理转移的趋势

3. **供应链高度依赖TSMC和SK Hynix**：先进制程、CoWoS封装、HBM三大关键组件供应集中

4. **与NVIDIA形成互补而非替代关系**：Google Cloud仍提供NVIDIA实例，TPU服务差异化客户

5. **CapEx持续高增长**：Google 2026年CapEx $180-190B，其中相当比例用于TPU部署

### 6.2 采购建议

**对于投资者：**
- 关注Google CapEx对TPU供应链的拉动效应（TSMC、SK Hynix、Ibiden等）
- TPU推理专用化趋势可能影响NVIDIA长期市场份额
- CSP自研芯片趋势值得长期跟踪

**对于采购决策者：**
- Google Cloud TPU实例适合大规模推理工作负载，成本效率优于GPU
- 训练场景仍建议优先考虑NVIDIA GPU（生态系统成熟、灵活性高）
- 需关注TPU与主流AI框架的兼容性（JAX最优，PyTorch/XLA次之）

**对于技术决策者：**
- TPU架构演进方向值得关注：推理优化、稀疏计算、光互连
- 封装技术（CoWoS、HBM4）是供应链关键瓶颈
- ABF基板需求增长将利好日本基板厂商

### 6.3 关键监测指标

1. **TPU v7量产进度**：2025年底-2026年初是否如期量产
2. **Google Cloud TPU客户增长**：是否能吸引更多AI公司
3. **HBM4集成时间线**：TPU何时采用HBM4
4. **CoWoS产能扩展**：TSMC产能是否能满足需求
5. **竞品动态**：NVIDIA B300/GB200、AMD MI400发布时间和性能

---

## 附录：数据来源

1. TrendForce - North American AI Data Center Expansion (2026-05-06)
2. SemiEngineering - HBM4 Sticks With Microbumps (2026-05-14)
3. SemiEngineering - HBM Shifts Testing Left (2026-05-13)
4. SemiEngineering - AI Accelerators Usher In New Era For IC Test (2026-05-12)
5. SemiEngineering - Chiplets Need A New Workflow (2026-05-14)
6. Google Cloud Blog - TPU v6e Trillium (2024-12)
7. Google I/O 2025 - TPU v7 Ironwood (2025-05)
8. Industry Analysis - Supply Chain Data

---

*本报告基于公开信息和行业分析编制，部分数据为估计值，仅供参考。*
