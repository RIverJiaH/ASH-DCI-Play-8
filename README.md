# Brain Care Demo

“脑护通”比赛 Demo，用于验证脑控选择、分层澄清、安全判断与护理任务闭环。

## 当前版本

第一版采用受控状态机，不直接接入真实脑电或自主 Agent：

1. 患者端用点击或数字键模拟 SSVEP 分类结果。
2. 每层选择记录置信度，低于阈值时拒绝或再次确认。
3. 患者确认后生成护理任务。
4. 护理端显示床位、需求、来源、置信度、优先级和状态。
5. 护理人员可接单、完成任务并保留事件记录。

## 项目结构

```text
frontend/   可运行的患者端与护理端 Demo
backend/    后续 API、任务与日志服务
bci/        后续 OpenBCI/SSVEP 接入
prompts/    后续受控 LLM 提示词与 JSON Schema
rules/      安全网关规则
data/       Demo 数据
logs/       本地运行日志
docs/       设计说明与演示脚本
```

## 运行前端

```bash
cd frontend
npm install
npm run dev
```
