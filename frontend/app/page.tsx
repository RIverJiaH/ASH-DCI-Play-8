"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_EVENTS,
  DEFAULT_TASKS,
  optionsFor,
  stepLabelsFor,
  type AuditEvent,
  type CareTask,
  type ConfidenceDecision,
  type ConfidenceStep,
  type DemoState,
  type Priority,
  type TaskStatus,
} from "../lib/brain-care";

type View = "patient" | "nurse";

const CONFIDENCE_BY_STEP = [0.91, 0.88, 0.93];

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

function buildSteps(
  selections: string[],
  confidences: number[],
  confirmations: boolean[] = [],
): ConfidenceStep[] {
  const labels = stepLabelsFor(selections);

  return selections.map((value, index) => ({
    label: labels[index],
    value,
    confidence: confidences[index],
    confirmed: confirmations[index] ?? confidences[index] >= 0.85,
  }));
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json() as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || `请求失败（${response.status}）`);
  }
  return payload;
}

type EvaluateResponse = {
  decision: ConfidenceDecision;
  events: AuditEvent[];
};

type TaskMutationResponse = DemoState & { task: CareTask };

export default function Home() {
  const [activeView, setActiveView] = useState<View>("patient");
  const [tasks, setTasks] = useState<CareTask[]>(DEFAULT_TASKS);
  const [events, setEvents] = useState<AuditEvent[]>(DEFAULT_EVENTS);
  const [selectedTaskId, setSelectedTaskId] = useState("task-a01");
  const [selections, setSelections] = useState<string[]>([]);
  const [confidences, setConfidences] = useState<number[]>([]);
  const [confirmations, setConfirmations] = useState<boolean[]>([]);
  const [simConfidence, setSimConfidence] = useState(CONFIDENCE_BY_STEP[0]);
  const [pendingCandidate, setPendingCandidate] = useState<string | null>(null);
  const [notice, setNotice] = useState("等待脑控输入");
  const [submitted, setSubmitted] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [clock, setClock] = useState("--:--");

  const stage = selections.length;
  const options = useMemo(() => optionsFor(stage, selections), [stage, selections]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  const pendingCount = tasks.filter((task) => task.status === "pending").length;

  useEffect(() => {
    let cancelled = false;
    apiRequest<DemoState>("/api/demo")
      .then((state) => {
        if (cancelled) return;
        setTasks(state.tasks);
        setEvents(state.events);
        if (state.tasks.length > 0) setSelectedTaskId(state.tasks[0].id);
      })
      .catch((error: Error) => {
        if (!cancelled) setNotice(`后端连接失败：${error.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const updateClock = () => setClock(formatClock(new Date()));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function acceptChoice(
    value: string,
    confidence: number,
    confirmed: boolean,
    nextEvents: AuditEvent[],
  ) {
    const nextStage = stage + 1;
    setSelections((current) => [...current, value]);
    setConfidences((current) => [...current, confidence]);
    setConfirmations((current) => [...current, confirmed]);
    setEvents(nextEvents);
    setPendingCandidate(null);
    setNotice(`已确认：${value}`);
    if (nextStage < 3) setSimConfidence(CONFIDENCE_BY_STEP[nextStage]);
  }

  async function selectOption(value: string, confirmed = false) {
    if (stage >= 3 || submitted || isBusy) return;
    const confidence = Number(simConfidence.toFixed(2));
    const step = buildSteps(
      [...selections, value],
      [...confidences, confidence],
      [...confirmations, confirmed],
    )[stage];

    setIsBusy(true);
    try {
      const result = await apiRequest<EvaluateResponse>("/api/brain-control/evaluate", {
        method: "POST",
        body: JSON.stringify({
          bed: "A01",
          stage,
          label: step.label,
          value,
          confidence,
          confirmed,
          selections,
        }),
      });
      setEvents(result.events);

      if (result.decision === "rejected") {
        setNotice("置信度不足，本次输入未执行");
        return;
      }
      if (result.decision === "confirmation_required") {
        setPendingCandidate(value);
        setNotice("需要再次确认本次选择");
        return;
      }
      acceptChoice(value, confidence, confirmed, result.events);
    } catch (error) {
      setNotice(`后端处理失败：${(error as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "BUTTON") return;
      if (activeView !== "patient" || stage >= 3 || submitted || pendingCandidate || isBusy) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < options.length) void selectOption(options[index]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function confirmRequest() {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const result = await apiRequest<TaskMutationResponse>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          bed: "A01",
          steps: buildSteps(selections, confidences, confirmations),
        }),
      });
      setTasks(result.tasks);
      setEvents(result.events);
      setSelectedTaskId(result.task.id);
      setSubmitted(true);
      setNotice("需求已发送至护士站");
    } catch (error) {
      setNotice(`任务创建失败：${(error as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  }

  function resetPatientFlow() {
    setSelections([]);
    setConfidences([]);
    setConfirmations([]);
    setSimConfidence(CONFIDENCE_BY_STEP[0]);
    setPendingCandidate(null);
    setNotice("等待脑控输入");
    setSubmitted(false);
  }

  async function mutateTask(task: CareTask, action: "accept" | "complete" | "transfer") {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const result = await apiRequest<TaskMutationResponse>(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setTasks(result.tasks);
      setEvents(result.events);
      setSelectedTaskId(result.task.id);
    } catch (error) {
      setNotice(`任务操作失败：${(error as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  }

  function updateTaskStatus(task: CareTask) {
    if (task.status === "done") return;
    void mutateTask(task, task.status === "pending" ? "accept" : "complete");
  }

  async function resetDemoData() {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const state = await apiRequest<DemoState>("/api/demo/reset", {
        method: "POST",
        body: "{}",
      });
      setTasks(state.tasks);
      setEvents(state.events);
      setSelectedTaskId(state.tasks[0]?.id ?? "");
      resetPatientFlow();
    } catch (error) {
      setNotice(`重置失败：${(error as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  }

  const resultSteps = buildSteps(selections, confidences, confirmations);
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
                      disabled={isBusy}
                      onClick={() => void selectOption(option)}
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
                      <button type="button" className="button secondary" disabled={isBusy} onClick={() => setPendingCandidate(null)}>
                        取消
                      </button>
                      <button type="button" className="button primary" disabled={isBusy} onClick={() => void selectOption(pendingCandidate, true)}>
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
                  <button type="button" className="button primary" disabled={isBusy} onClick={() => void confirmRequest()}>
                    {isBusy ? "正在发送…" : "确认并发送需求"}
                  </button>
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

            <button type="button" className="reset-button" disabled={isBusy} onClick={() => void resetDemoData()}>恢复演示数据</button>
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
                    disabled={isBusy}
                    onClick={() => void mutateTask(selectedTask, "transfer")}
                  >
                    转交任务
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    disabled={selectedTask.status === "done" || isBusy}
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
