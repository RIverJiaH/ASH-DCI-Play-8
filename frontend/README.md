# 脑护通前端 Demo

患者端与护理端运行在同一个页面，通过顶部切换器展示完整闭环。

## 已实现

- 两到三层脑控选择模拟与逐层置信度记录
- 低置信度拒绝和二次确认
- 患者最终确认并生成护理任务
- 护理任务队列、意图链路、接单和完成
- 本地事件日志和浏览器状态保存
- 桌面与移动端响应式布局

## 本地运行

```bash
npm install
npm run dev
```

构建与测试：

```bash
npm run build
npm test
```

当前版本默认使用点击或数字键模拟脑控输入，也可切换到 OpenBCI 实时模式或 DSTF 前额重构研究模式。OpenBCI 模式由项目根目录的 `bci/openbci_lsl_bridge.py` 接收 OpenBCI GUI LSL 数据；DSTF 研究模式由 `bci/dstf_research_bridge.py` 发送论文路线的模拟重构事件。两种桥接器稳定识别后都通过本机 `/api/bci/events` 队列交给页面，再复用相同的选择与置信度校验接口。

DSTF 研究模式只用于演示 `前额EEG -> 枕叶样SSVEP重构 -> CCA识别` 的工程接口，不代表真实论文源码、真实前额 EEG 识别或临床验证。
