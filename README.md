# Brain Care Demo

“脑护通”比赛 Demo，用于验证脑控选择、分层澄清、安全判断与护理任务闭环。

## 当前版本

当前版本采用受控状态机和 Mock AI 选项服务，不直接接入真实脑电、自主 Agent 或智能设备：

1. 患者端用点击或数字键模拟 SSVEP 分类结果。
2. 第一层使用固定安全菜单；后两层由服务端根据已选路径生成 3 个审核选项，“返回上一级”作为独立导航按钮显示。
3. 每组选项生成后立即冻结，客户端只能提交服务端签发的 `optionId` 和 `optionSetId`。
4. 紧急求助绕过 AI，直接进入高优先级确认。
5. 每层选择记录置信度，低于阈值时拒绝或要求再次确认。
6. 患者确认后生成护理任务，护理端可接单、完成并查看事件记录。
7. 环境设备需求当前只生成护理请求，不会控制真实设备。

## AI 与设备开关

复制 `frontend/.env.example` 为本地环境文件后可调整配置。当前支持：

```text
AI_OPTIONS_MODE=mock       # Mock AI 受控选项
AI_OPTIONS_MODE=fallback   # 固定安全兜底
DEVICE_ADAPTER=disabled    # 设备适配器保持关闭
```

预留接口：

- `POST /api/options/generate`：生成并签发当前层选项集。
- `POST /api/device-actions`：设备动作入口；当前固定返回 `501 DEVICE_INTEGRATION_DISABLED`。
- `frontend/lib/server/devices/device-adapter.ts`：后续接入小米 IoT 或 Home Assistant 的适配器契约。

当前 Demo 的所有动作均为 `request_only`，真实设备接入前必须增加设备白名单、床位绑定、人工确认、幂等控制和审计日志。

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
