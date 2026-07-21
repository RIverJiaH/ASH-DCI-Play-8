# Brain Care Demo

脑护通 Demo 项目：用于验证“脑控选择 + AI 分层澄清 + 安全网关 + 护士端任务看板”的最小闭环。

## Demo Scope

- 患者端显示有限候选项，第一版使用键盘模拟 SSVEP 识别结果。
- 后端维护意图状态机、确认/取消逻辑、事件日志和安全规则。
- LLM API 只用于受控候选项生成和护士端摘要，不直接做医疗判断。
- 护士端展示患者需求、识别链路置信度、优先级和任务状态。
- 后续再接入 OpenBCI/SSVEP 分类结果替换键盘模拟输入。

## Project Layout

```text
frontend/   患者端和护士端页面
backend/    API、状态机、任务和日志
bci/        OpenBCI/SSVEP 接入脚本
prompts/    LLM 提示词、JSON schema 和白名单约束
rules/      安全网关规则
data/       Demo 词库、样例数据
logs/       本地运行日志，不提交
docs/       设计说明和演示脚本
```

## First Milestone

先实现无脑电版 Demo：

1. 患者端 4-6 个闪烁选项。
2. 键盘模拟脑控识别结果。
3. 多轮确认和分层追问。
4. 生成护士端任务。
5. 保存完整事件日志。
