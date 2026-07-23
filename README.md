# Brain Care Demo

“脑护通”比赛 Demo，用于验证脑控选择、分层澄清、安全判断与护理任务闭环。

## 当前版本

当前为 AI 临床情境辅助第三版。相比第二版，新增完整模拟病历抽屉、可见的“继续确认/确认建单”路径判断、AI/安全回退依据，以及护理端进一步评估和无法完成处置闭环。

当前版本采用受控状态机和受控 AI 选项服务，默认使用模拟输入，并提供本机 OpenBCI/SSVEP 工程联调入口；不接入自主 Agent 或智能设备：

1. 患者端可使用点击/数字键模拟，也可切换为 OpenBCI 实时输入。
2. 第一层使用固定安全菜单；后续层由服务端根据已选路径生成 3 个审核选项，“返回上一级”作为独立导航按钮显示。
3. 每组选项生成后立即冻结，客户端只能提交服务端签发的 `optionId` 和 `optionSetId`。
4. 紧急求助绕过 AI，直接进入高优先级确认。
5. 每层选择记录置信度，低于阈值时拒绝或要求再次确认。
6. 每个候选项明确显示选择后是继续确认还是进入任务确认，避免无意义延展。
7. 患者确认后生成护理任务，护理端可接单、进一步评估、标记暂时无法完成、完成或转交。
8. 环境设备需求当前只生成护理请求，不会控制真实设备。
9. OpenBCI 桥接器只提交目标编号和识别分数，不能直接创建任务或绕过服务端规则。

普通需求最多进行 3 层确认；“饮水口腔”和“调整体位”在第 2 层即可形成护理任务，具体处置由护理人员结合床旁询问和病历信息确认。

### 第三版模拟场景

- `A01 · 常规表达受限`：按普通受控引导流程生成护理需求。
- `B02 · 吞咽风险`：饮水口腔需求自动转为护理评估任务，不生成直接饮水动作。
- `C03 · 术后体位限制`：体位需求自动转为护理评估任务，不生成具体卧位动作。

安全规则先于 LLM 执行。DeepSeek 可以根据服务端提供的结构化上下文调整引导语和短标签，但不能删除风险提示、修改风险等级或绕过人工确认。

患者端“查看完整模拟病历”展示模拟诊断、表达能力、吞咽风险、饮水状态、体位限制和护理注意事项。护理端同步显示病历摘要、风险依据、安全规则、AI/回退说明和任务处置结果。所有病历均为演示数据，不代表真实医疗记录。

## AI 与设备开关

复制 `frontend/.env.example` 为本地环境文件后可调整配置。当前支持：

```text
AI_OPTIONS_MODE=mock       # Mock AI 受控选项
AI_OPTIONS_MODE=fallback   # 固定安全兜底
AI_OPTIONS_MODE=deepseek   # DeepSeek 真实 API，失败时自动使用固定安全兜底
DEVICE_ADAPTER=disabled    # 设备适配器保持关闭
```

DeepSeek 配置只写入 `frontend/.env.local`，该文件不会提交到 Git：

```text
AI_OPTIONS_MODE=deepseek
AI_OPTIONS_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=在本机填写
```

真实 AI 只能对服务端审核候选项进行排序和短文案改写，不能新增医疗意图、改变风险等级或执行设备操作。API 超时、报错或返回不合规 JSON 时，后端自动使用固定候选项。

预留接口：

- `POST /api/options/generate`：生成并签发当前层选项集。
- `POST /api/device-actions`：设备动作入口；当前固定返回 `501 DEVICE_INTEGRATION_DISABLED`。
- `frontend/lib/server/devices/device-adapter.ts`：后续接入小米 IoT 或 Home Assistant 的适配器契约。

当前 Demo 的所有动作均为 `request_only`，真实设备接入前必须增加设备白名单、床位绑定、人工确认、幂等控制和审计日志。

## OpenBCI 实时输入

当前配置对应已确认设备：

- OpenBCI `Cyton+Daisy`，16 通道。
- OpenBCI GUI 使用 `COM6`。
- LSL 数据流名称 `obci_eeg1`。
- 枕区分析通道使用 GUI 中的第 `7、8、11` 通道（1-based）。
- 默认候选频率为 `6 / 8.57 / 13.85 / 15 Hz`，仅用于今晚工程联调，正式演示前必须重新完成单频校准。

首次使用：

```text
1. 双击 setup_bci.bat，创建独立 Python 环境并安装 numpy、scipy、pylsl。
2. 双击 start_public_demo.bat，保持 Demo 黑框运行。
3. OpenBCI GUI 选择 Cyton、Serial、COM6、16 通道并启动数据流。
4. GUI 打开 Time Series 和 Networking，选择 LSL / Time Series，流名称设为 obci_eeg1。
5. 双击 start_bci_bridge.bat。
6. 患者端右侧切换到 OpenBCI，确认状态为“已连接”后再开始注视目标。
```

同一目标需要连续达到 `3` 次稳定识别才提交。提交后必须先移开视线，再次注视才能重复选择同一目标。页面仍执行原有规则：

- 识别分数低于 `0.70`：拒绝。
- `0.70`（含）到 `0.85`（不含）：要求再次注视同一目标确认。
- 不低于 `0.85`：接受当前层选择。
- 最终“确认并发送需求”保持页面人工确认，不由脑机桥接器自动执行。

桥接器只向 `http://127.0.0.1:8000/api/bci/events` 提交数据，服务端拒绝来自公网转发的脑机写入。识别日志保存在 `logs/bci/`，不提交 Git。

## 项目结构

```text
frontend/   可运行的患者端与护理端 Demo
backend/    后续 API、任务与日志服务
bci/        OpenBCI GUI LSL 接收、SSVEP CCA 分类与本地桥接
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
