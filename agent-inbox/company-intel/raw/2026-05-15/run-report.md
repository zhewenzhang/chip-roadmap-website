# Run Report — 2026-05-15 V2

## 本次处理
- 总处理：3 家公司
- 成功写入 raw：3 家（Unimicron、Ibiden、Shinko Electric）
- 进入 unverified：0 家

## 数据质量
| 公司 | 置信度 | 缺失字段 | 需人工复核 |
|------|--------|----------|-----------|
| Unimicron | 0.85 | founded_exact, revenue | ✅ |
| Ibiden | 0.85 | revenue, exact_market_share_2026 | ✅ |
| Shinko Electric | 0.75 | revenue, exact_market_share_2026, founded_exact | ✅ |

## 遇到的问题
1. **V1 子 agent 失败**：任务太大（20家公司），搜索被限流，超时无产出
2. **V2 子 agent 失败**：模型不会用 web_fetch 工具，只会 exec curl，全部失败
3. **web_fetch 被封锁**：DNS 解析到内网 IP，无法直接访问外部网页
4. **解决方案**：使用火山引擎 byted-web-search 联网搜索脚本，成功获取数据

## 下一批建议处理
1. **AT&S**（欧洲最大IC基板厂）
2. **Nan Ya PCB**（台灣ABF載板供應商）
3. **Zhuhai Access Semiconductor**（中國ABF載板突破者）

## 备注
- 所有数据均基于联网搜索获取的公开来源
- 每家公司至少 2-3 个来源
- 建议人工复核后再进入 reviewed 目录
