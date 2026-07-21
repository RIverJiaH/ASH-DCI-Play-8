"use client";

import { useEffect, useMemo, useState } from "react";

type View = "patient" | "nurse";
type TaskStatus = "pending" | "accepted" | "done";
type Priority = "high" | "medium" | "normal";

type ConfidenceStep = {
  label: string;
  value: string;
  confidence: number;
};

type CareTask = {
  id: string;
  bed: string;
  need: string;
  source: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  steps: ConfidenceStep[];
};

type AuditEvent = {
  id: string;
  time: string;
  title: string;
  detail: string;
};

const CONFIDENCE_BY_STEP = [0.91, 0.88, 0.93];

const DEFAULT_TASKS: CareTask[] = [
  {
    id: "task-a01",
    bed: "A01",
    need: "腹部重度持续疼痛",
    source: "脑控确认",
    priority: "high",
    status: "pending",
    createdAt: "2026-07-21T14:29:42+08:00",
    steps: [
      { label: "需求类型", value: "疼痛不适", confidence: 0.91 },
      { label: "疼痛部位", value: "腹部", confidence: 0.88 },
      { label: "程度与性质", value: "重度持续疼痛", confidence: 0.93 },
    ],
  },
  {
    id: "task-b06",
    bed: "B06",
    need: "需要协助调整卧位",
    source: "脑控确认",
    priority: "medium",
    status: "accepted",
    createdAt: "2026-07-21T14:26:19+08:00",
    steps: [
      { label: "需求类型", value: "调整体位", confidence: 0.89 },
      { label: "处理时效", value: "尽快处理", confidence: 0.86 },
      { label: "具体需求", value: "抬高床头", confidence: 0.9 },
    ],
  },
  {
    id: "task-c12",
    bed: "C12",
    need: "需要少量饮水",
    source: "脑控确认",
    priority: "normal",
    status: "done",
    createdAt: "2026-07-21T14:18:08+08:00",
    steps: [
      { label: "需求类型", value: "需要饮水", confidence: 0.94 },
      { label: "处理时效", value: "稍后处理", confidence: 0.9 },
      { label: "具体需求", value: "少量饮水", confidence: 0.92 },
    ],
  },
];

const DEFAULT_EVENTS: AuditEvent[] = [
  {
    id: "event-1",
    time: "14:29:42",
    title: "任务已创建",
    detail: "A01 · 腹部重度持续疼痛",
  },
  {
    id: "event-2",
    time: "14:27:03",
    title: "护士已接单",
    detail: "B06 · 调整体位",
  },
  {
    id: "event-3",
    time: "14:25:18",
    title: "任务已完成",
    detail: "C12 · 少量饮水",
  },
];

const FREQUENCY_LABELS = ["目标 F1", "目标 F2", "目标 F3", "目标 F4"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "待接单",
  accepted: "已接单",
  done: "已完成",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "高",
  medium: "中",
  normal: "普通",
};

function optionsFor(stage: number, selections: string[]) {
  const category = selections[0];

  if (stage === 0) {
    return ["疼痛不适", "呼吸不适", "需要饮水", "调整体位"];
  }

  if (stage === 1) {
    return category === "疼痛不适"
      ? ["腹部", "胸部", "头部", "四肢"]
      : ["立即处理", "尽快处理", "稍后处理", "取消需求"];
  }

  if (category === "呼吸不适") {
    return ["胸闷", "气短", "咳嗽", "其他不适"];
  }
  if (category === "需要饮水") {
    return ["少量饮水", "润唇", "漱口", "其他需求"];
  }
  if (category === "调整体位") {
    return ["抬高床头", "左侧卧", "右侧卧", "恢复平卧"];
  }
  return ["重度持续疼痛", "中度间歇疼痛", "轻度持续疼痛", "疼痛减轻"];
}

function stageTitle(stage: number, selections: string[]) {
  if (stage === 0) return "请选择需求类型";
  if (stage === 1) {
    return selections[0] === "疼痛不适" ? "疼痛位于哪里？" : "需要多快处理？";
  }
  return selections[0] === "疼痛不适" ? "疼痛程度和性质？" : "请进一步确认需求";
}

function buildNeed(selections: string[]) {
  if (selections[0] === "疼痛不适") {
    return `${selections[1]}${selections[2]}`;
  }
  return selections[2] || selections[0] || "需要协助";
}

function buildSteps(selections: string[], confidences: number[]): ConfidenceStep[] {
  const painFlow = selections[0] === "疼痛不适";
  const labels = painFlow
    ? ["需求类型", "疼痛部位", "程度与性质"]
    : ["需求类型", "处理时效", "具体需求"];

  return selections.map((value, index) => ({
    label: labels[index],
    value,
    confidence: confidences[index],
  }));
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function nowTime() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("patient");
  const [tasks, setTasks] = useState<CareTask[]>(DEFAULT_TASKS);
  const [events, setEvents] = useState<AuditEvent[]>(DEFAULT_EVENTS);
  const [hydrated, setHydrated] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("task-a01");
  const [selections, setSelections] = useState<string[]>([]);
  const [confidences, setConfidences] = useState<number[]>([]);
  const [simConfidence, setSimConfidence] = useState(CONFIDENCE_BY_STEP[0]);
  const [pendingCandidate, setPendingCandidate] = useState<string | null>(null);
  const [notice, setNotice] = useState("等待脑控输入");
  const [submitted, setSubmitted] = useState(false);
  const [clock, setClock] = useState("--:--");

  const stage = selections.length;
  const options = useMemo(() => optionsFor(stage, selections), [stage, selections]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  const pendingCount = tasks.filter((task) => task.status === "pending").length;

  useEffect(() => {
    const storedTasks = window.localStorage.getItem("brain-care-tasks");
    const storedEvents = window.localStorage.getItem("brain-care-events");
    if (storedTasks) setTasks(JSON.parse(storedTasks) as CareTask[]);
    if (storedEvents) setEvents(JSON.parse(storedEvents) as AuditEvent[]);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("brain-care-tasks", JSON.stringify(tasks));
    window.localStorage.setItem("brain-care-events", JSON.stringify(events));
  }, [events, hydrated, tasks]);

  useEffect(() => {
    const updateClock = () => setClock(formatClock(new Date()));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function recordEvent(title: string, detail: string) {
    setEvents((current) => [
      { id: `event-${Date.now()}`, time: nowTime(), title, detail },
      ...current,
    ].slice(0, 12));
  }

  function acceptChoice(value: string, confidence: number) {
    const nextStage = stage + 1;
    setSelections((current) => [...current, value]);
    setConfidences((current) => [...current, confidence]);
    setPendingCandidate(null);
    setNotice(`已确认：${value}`);
    recordEvent("脑控选择已确认", `${value} · 置信度 ${confidence.toFixed(2)}`);
    if (nextStage < 3) setSimConfidence(CONFIDENCE_BY_STEP[nextStage]);
  }

  function selectOption(value: string) {
    if (stage >= 3 || submitted) return;
    const confidence = Number(simConfidence.toFixed(2));

    if (confidence < 0.7) {
      setNotice("置信度不足，本次输入未执行");
      recordEvent("脑控输入已拒绝", `${value} · 置信度 ${confidence.toFixed(2)}`);
      return;
    }
    if (confidence < 0.85) {
      setPendingCandidate(value);
      setNotice("需要再次确认本次选择");
      return;
    }
    acceptChoice(value, confidence);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "BUTTON") return;
      if (activeView !== "patient" || stage >= 3 || submitted || pendingCandidate) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < options.length) selectOption(options[index]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function confirmRequest() {
    const steps = buildSteps(selections, confidences);
    const need = buildNeed(selections);
    const priority: Priority = need.includes("重度") || selections[1] === "立即处理" ? "high" : "medium";
    const task: CareTask = {
      id: "task-a01",
      bed: "A01",
      need,
      source: "脑控确认",
      priority,
      status: "pending",
      createdAt: new Date().toISOString(),
      steps,
    };

    setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
    setSelectedTaskId(task.id);
    setSubmitted(true);
    setNotice("需求已发送至护士站");
    recordEvent("护理任务已创建", `A01 · ${need}`);
  }

  function resetPatientFlow() {
    setSelections([]);
    setConfidences([]);
    setSimConfidence(CONFIDENCE_BY_STEP[0]);
    setPendingCandidate(null);
    setNotice("等待脑控输入");
    setSubmitted(false);
  }

  function updateTaskStatus(task: CareTask) {
    const nextStatus: TaskStatus = task.status === "pending" ? "accepted" : "done";
    setTasks((current) => current.map((item) => (
      item.id === task.id ? { ...item, status: nextStatus } : item
    )));
    recordEvent(
      nextStatus === "accepted" ? "护士已接单" : "护理任务已完成",
      `${task.bed} · ${task.need}`,
    );
  }

  function resetDemoData() {
    setTasks(DEFAULT_TASKS);
    setEvents(DEFAULT_EVENTS);
    setSelectedTaskId("task-a01");
    resetPatientFlow();
  }

  const resultSteps = buildSteps(selections, confidences);
  const overallConfidence = resultSteps.length
    ? Math.min(...resultSteps.map((item) => item.confidence))
    : 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="脑护通">
          <span className="brand-mark" aria-hidden="true">脑</span>
          <div>
            <strong className="brand-name">脑护通</strong>
            <span className="brand-role">受控照护交互 Demo</span>
          </div>
        </div>

        <nav className="view-switcher" aria-label="切换演示端">
          <button
            type="button"
            className={activeView === "patient" ? "is-active" : ""}
            aria-pressed={activeView === "patient"}
            onClick={() => setActiveView("patient")}
          >
            患者端
          </button>
          <button
            type="button"
            className={activeView === "nurse" ? "is-active" : ""}
            aria-pressed={activeView === "nurse"}
            onClick={() => setActiveView("nurse")}
          >
            护士端
            {pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}
          </button>
        </nav>

        <div className="ward-clock">
          <span>神经内科三区</span>
          <time>{clock}</time>
        </div>
      </header>

      {activeView === "patient" ? (
        <main className="patient-layout">
          <section className="patient-workspace" aria-labelledby="patient-title">
            <header className="surface-header patient-header">
              <div>
                <span className="eyebrow">床位 A01 · 脑控表达</span>
                <h1 id="patient-title">{submitted ? "需求已经送达" : stageTitle(stage, selections)}</h1>
                <p>{submitted ? "护士站已收到完整的分层确认记录" : "注视目标或使用数字键完成当前层选择"}</p>
              </div>
              <div className="step-progress" aria-label={`当前第 ${Math.min(stage + 1, 3)} 步，共 3 步`}>
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className={index < stage ? "is-done" : index === stage && !submitted ? "is-current" : ""}
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
            </header>

            {!submitted && stage < 3 && (
              <>
                <div className="option-grid" role="group" aria-label="脑控候选项">
                  {options.map((option, index) => (
                    <button
                      type="button"
                      className="ssvep-option"
                      key={option}
                      onClick={() => selectOption(option)}
                    >
                      <span className="target-label">{FREQUENCY_LABELS[index]}</span>
                      <strong>{option}</strong>
                      <span className="key-label">{index + 1}</span>
                    </button>
                  ))}
                </div>

                {pendingCandidate && (
                  <div className="confirmation-strip" role="status">
                    <div>
                      <strong>再次确认“{pendingCandidate}”</strong>
                      <span>当前置信度 {simConfidence.toFixed(2)}</span>
                    </div>
                    <div className="inline-actions">
                      <button type="button" className="button secondary" onClick={() => setPendingCandidate(null)}>
                        取消
                      </button>
                      <button type="button" className="button primary" onClick={() => acceptChoice(pendingCandidate, simConfidence)}>
                        确认本次选择
                      </button>
                    </div>
                  </div>
                )}

                <div className="selection-history" aria-label="已完成的选择">
                  {selections.length === 0 ? (
                    <span className="empty-history">尚未完成选择</span>
                  ) : selections.map((selection, index) => (
                    <span key={`${selection}-${index}`}>
                      <b>{index + 1}</b>
                      {selection}
                      <em>{confidences[index].toFixed(2)}</em>
                    </span>
                  ))}
                </div>
              </>
            )}

            {!submitted && stage === 3 && (
              <div className="request-review">
                <div className="review-heading">
                  <div>
                    <span className="eyebrow">最终确认</span>
                    <h2>{buildNeed(selections)}</h2>
                  </div>
                  <span className="priority-badge high">优先级 高</span>
                </div>
                <ConfidenceChain steps={resultSteps} />
                <div className="confidence-summary">
                  <p>整体置信度取三层中的最低值，用于安全决策。</p>
                  <strong>{overallConfidence.toFixed(2)}</strong>
                </div>
                <div className="review-actions">
                  <button type="button" className="button secondary" onClick={resetPatientFlow}>重新选择</button>
                  <button type="button" className="button primary" onClick={confirmRequest}>确认并发送需求</button>
                </div>
              </div>
            )}

            {submitted && (
              <div className="success-state" role="status">
                <span className="success-mark" aria-hidden="true">✓</span>
                <h2>{buildNeed(selections)}</h2>
                <p>来源：脑控确认 · 整体置信度 {overallConfidence.toFixed(2)}</p>
                <div className="review-actions">
                  <button type="button" className="button secondary" onClick={resetPatientFlow}>发起新需求</button>
                  <button type="button" className="button primary" onClick={() => setActiveView("nurse")}>查看护士端</button>
                </div>
              </div>
            )}
          </section>

          <aside className="signal-panel" aria-labelledby="signal-title">
            <header>
              <div>
                <span className="eyebrow">Demo 输入源</span>
                <h2 id="signal-title">模拟脑控信号</h2>
              </div>
              <span className="live-status"><i />稳定</span>
            </header>

            <label className="confidence-control" htmlFor="confidence">
              <span>
                当前置信度
                <strong>{simConfidence.toFixed(2)}</strong>
              </span>
              <input
                id="confidence"
                type="range"
                min="0.55"
                max="0.99"
                step="0.01"
                value={simConfidence}
                onChange={(event) => setSimConfidence(Number(event.target.value))}
              />
            </label>

            <div className="threshold-list">
              <div><b className="reject" />低于 0.70<span>拒绝输入</span></div>
              <div><b className="confirm" />0.70–0.85<span>再次确认</span></div>
              <div><b className="accept" />不低于 0.85<span>正常接受</span></div>
            </div>

            <div className="signal-readout">
              <span>输入方式</span><strong>点击 / 数字键模拟</strong>
              <span>真实接口</span><strong>SSVEP 分类器预留</strong>
              <span>当前状态</span><strong>{notice}</strong>
            </div>

            <section className="event-preview" aria-labelledby="patient-events-title">
              <h3 id="patient-events-title">最近事件</h3>
              {events.slice(0, 4).map((event) => (
                <div className="event-row" key={event.id}>
                  <time>{event.time}</time>
                  <p><strong>{event.title}</strong><span>{event.detail}</span></p>
                </div>
              ))}
            </section>
          </aside>
        </main>
      ) : (
        <main className="command-center">
          <section className="work-surface" aria-labelledby="queue-title">
            <header className="surface-header">
              <div>
                <span className="eyebrow">实时护理任务</span>
                <h1 id="queue-title">任务队列</h1>
                <p>按临床优先级与等待状态排列</p>
              </div>
              <span className="count-badge">{pendingCount} 项待接单</span>
            </header>

            <div className="task-list" role="list" aria-label="护理任务列表">
              {tasks.map((task) => (
                <button
                  type="button"
                  className={`task-card ${task.id === selectedTask?.id ? "selected" : ""}`}
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  role="listitem"
                >
                  <span className="bed-block">
                    <span>床位</span>
                    <strong>{task.bed}</strong>
                  </span>
                  <span className="task-copy">
                    <strong>{task.need}</strong>
                    <span>
                      来源 {task.source} · 置信度 {task.steps.map((step) => step.confidence.toFixed(2)).join(" / ")}
                    </span>
                  </span>
                  <span className="task-state">
                    <span className={`priority-badge ${task.priority}`}>优先级 {PRIORITY_LABEL[task.priority]}</span>
                    <span className={`status-badge ${task.status}`}>{STATUS_LABEL[task.status]}</span>
                  </span>
                </button>
              ))}
            </div>

            <button type="button" className="reset-button" onClick={resetDemoData}>恢复演示数据</button>
          </section>

          {selectedTask && (
            <section className="work-surface trace-surface" aria-labelledby="trace-title">
              <header className="surface-header">
                <div>
                  <span className="eyebrow">脑控意图追踪</span>
                  <h2 id="trace-title">患者需求详情</h2>
                  <p>逐层选择、确认与状态操作记录</p>
                </div>
                <span className={`status-badge ${selectedTask.status}`}>{STATUS_LABEL[selectedTask.status]}</span>
              </header>

              <section className="case-heading" aria-labelledby="case-title">
                <div>
                  <strong className="case-bed">{selectedTask.bed}</strong>
                  <h2 id="case-title">{selectedTask.need}</h2>
                </div>
                <span className={`priority-badge ${selectedTask.priority}`}>优先级 {PRIORITY_LABEL[selectedTask.priority]}</span>
                <span className="source-badge">来源：{selectedTask.source}</span>
              </section>

              <section className="trace-section" aria-labelledby="chain-title">
                <div className="section-heading">
                  <h3 id="chain-title">意图确认链</h3>
                  <span>{selectedTask.steps.length} 步均已确认</span>
                </div>
                <ConfidenceChain steps={selectedTask.steps} />
                <div className="confidence-summary">
                  <p>整体可靠度按最低层置信度计算，不代表医学诊断结论。</p>
                  <strong>{Math.min(...selectedTask.steps.map((step) => step.confidence)).toFixed(2)}</strong>
                </div>
              </section>

              <section className="action-section" aria-labelledby="action-title">
                <div className="section-heading">
                  <h3 id="action-title">任务处置</h3>
                  <span>所有操作写入事件记录</span>
                </div>
                <div className="action-context">
                  <div><span>患者</span><strong>床位 {selectedTask.bed}</strong></div>
                  <div><span>当前状态</span><strong>{STATUS_LABEL[selectedTask.status]}</strong></div>
                  <div><span>安全规则</span><strong>人工护理确认</strong></div>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => recordEvent("已记录转交申请", `${selectedTask.bed} · ${selectedTask.need}`)}
                  >
                    转交任务
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    disabled={selectedTask.status === "done"}
                    onClick={() => updateTaskStatus(selectedTask)}
                  >
                    {selectedTask.status === "pending" && `接单并前往 ${selectedTask.bed}`}
                    {selectedTask.status === "accepted" && "标记已完成"}
                    {selectedTask.status === "done" && "任务已完成"}
                  </button>
                </div>
              </section>

              <section className="audit-log" aria-labelledby="audit-title">
                <div className="section-heading">
                  <h3 id="audit-title">事件记录</h3>
                  <span>最近 {Math.min(events.length, 5)} 条</span>
                </div>
                {events.slice(0, 5).map((event) => (
                  <div className="event-row" key={event.id}>
                    <time>{event.time}</time>
                    <p><strong>{event.title}</strong><span>{event.detail}</span></p>
                  </div>
                ))}
              </section>
            </section>
          )}
        </main>
      )}
    </div>
  );
}

function ConfidenceChain({ steps }: { steps: ConfidenceStep[] }) {
  return (
    <ol className="confidence-chain" aria-label="脑控意图分层确认结果">
      {steps.map((step, index) => (
        <li className="confidence-step" key={`${step.label}-${index}`}>
          <span className="step-index">第 {index + 1} 层 · {step.label}</span>
          <strong className="step-value">{step.value}</strong>
          <span className="confidence-value">
            <span>置信度</span>
            <strong>{step.confidence.toFixed(2)}</strong>
          </span>
        </li>
      ))}
    </ol>
  );
}
