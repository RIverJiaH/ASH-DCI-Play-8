# 脑护通 OpenBCI 接入操作说明

适用设备：OpenBCI Cyton+Daisy（16 通道），Windows 串口 COM6。

本功能用于工程 Demo 联调，不用于诊断、治疗或真实临床处置。首次测试建议由熟悉 OpenBCI 的人员操作；对闪烁刺激敏感、有光敏性癫痫风险或身体不适者不要参与。

## 一、软件已配置

- LSL 流名称：`obci_eeg1`
- 分析通道：GUI 第 `1、3、4` 通道（1-based）
- 默认频率：`6 / 8.57 / 13.85 / 15 / 10 Hz`，F1-F4 为业务选项，F5 为返回上一级
- Demo 本机地址：`http://127.0.0.1:8000/`
- 桥接接口：`http://127.0.0.1:8000/api/bci/events`

Python 环境和 `numpy / scipy / pylsl` 已在 `bci/.venv` 中安装完成。

## 二、今晚启动顺序

1. 先插入 Cyton USB Dongle，确认 Dongle 开关在 `GPIO 6`。
2. 再给 Cyton+Daisy 接电池并拨到 `PC`。
3. 打开 OpenBCI GUI。
4. 选择 `LIVE (from Cyton)`、`Serial (from Dongle)`、`COM6`、`16 channels`。
5. 点击 `START SYSTEM`，连接成功后点击 `Start Data Stream`。
6. 检查 16 路 Time Series 波形；先完成阻抗检查，再退出阻抗模式开始正常采集。
7. 确认 O1、Oz、O2 实际对应 GUI 第 `1、3、4` 通道。
8. GUI 保持 `Time Series` 窗口打开。
9. 打开 `Networking` Widget，选择 `LSL` 和 `Time Series`，流名称设置为 `obci_eeg1` 并启动。
10. 双击项目根目录的 `start_public_demo.bat`。
11. 双击项目根目录的 `start_bci_bridge.bat`。
12. 浏览器打开 `http://127.0.0.1:8000/`，患者端右侧选择 `OpenBCI`。
13. 页面显示“已连接”、数据流 `obci_eeg1 · 125 Hz`、通道 `1 / 3 / 4` 后再开始测试。

## 三、选择操作

1. 注视目标前先看向屏幕空白区域 2 秒。
2. 注视一个闪烁目标约 3 至 5 秒。
3. 接收器连续识别同一目标 3 次后才提交。
4. 提交后先移开视线，再次注视才能重复选择同一目标。
5. 分数低于 `0.70` 时页面拒绝输入。
6. 分数在 `0.70` 到 `0.85` 之间时，再次注视同一目标完成确认。
7. 分数不低于 `0.85` 时接受当前层选择。
8. 最终“确认并发送需求”仍由页面人工点击，不由桥接器自动执行。

## 四、成功标志

### OpenBCI GUI

- 显示 16 路持续更新的波形。
- O1、Oz、O2 不是平线或饱和状态。
- 设备状态没有持续丢包或断开。

### 桥接器黑框

- 出现 `Found stream: name=obci_eeg1`。
- 显示 `channels=16` 和约 `125 Hz` 采样率。
- 持续输出 `F1` 至 `F5`、`score`、`margin` 和稳定次数。
- 稳定识别时输出 `SEND`。

### 脑护通页面

- OpenBCI 状态显示“已连接”。
- 四个业务候选项显示对应 Hz 并开始闪烁；进入二级后，“返回上一级”也作为 F5 闪烁块显示。
- “最近识别”显示目标、频率和识别分数。
- 合格输入进入原有置信度判断，不会直接创建护理任务。

## 五、常见问题

### 页面显示未连接

依次检查：

1. `start_public_demo.bat` 黑框是否仍在运行。
2. `start_bci_bridge.bat` 是否找到 `obci_eeg1`。
3. OpenBCI GUI 的 Networking 是否已经启动 LSL Time Series。
4. LSL 流名称是否完全等于 `obci_eeg1`。

### 桥接器一直显示 Searching

- 确认 OpenBCI GUI 已点击 `Start Data Stream`。
- 保持 GUI 的 Time Series Widget 打开。
- 停止并重新启动 Networking 中的 LSL。
- 再关闭并重新打开 `start_bci_bridge.bat`。

### 目标一直识别错误

- 重新核对第 `1、3、4` 通道确实对应 O1、Oz、O2。
- 检查参考电极和 BIAS/GND。
- 降低环境交流电干扰，避免电极线晃动和面部肌肉动作。
- 逐个频率单独测试，不要立刻用四频结果控制页面。
- 当前四个默认频率尚未完成本次佩戴条件下的重新校准，不能把历史配置当作最终配置。

### 同一个目标不能连续选择

这是防重复触发机制。完成一次选择后先看向空白区域，等黑框出现低分或非稳定状态，再重新注视目标。
