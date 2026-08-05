"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  DEFAULT_EVENTS,
  DEFAULT_TASKS,
  ROOT_OPTIONS,
  type AiOptionSet,
  type AuditEvent,
  type CareOption,
  type CareTask,
  type ConfidenceDecision,
  type ConfidenceStep,
  type DemoState,
  type OptionSelectionRef,
  type Priority,
  type TaskStatus,
} from "../lib/brain-care";
import { DEMO_PATIENTS } from "../lib/demo-patients";

type View = "patient" | "nurse";
type InputMode = "simulation" | "openbci";

const CONFIDENCE_BY_STEP = [0.91, 0.88, 0.93];

const SSVEP_OPTION_TARGET_COUNT = 4;
const BACK_TARGET_INDEX = 4;
const FINAL_CONFIRM_TARGET_INDEX = 0;
const FINAL_RESET_TARGET_INDEX = 1;
const DEFAULT_SSVEP_FREQUENCIES = [6, 8.57, 13.85, 15, 10] as const;
const EMPTY_OPTIONS: CareOption[] = [];

function createSessionId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `session-${timestamp}-${randomPart}`;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "待接单",
  accepted: "已接单",
  review: "需进一步评估",
  blocked: "暂时无法完成",
  done: "已完成",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "高",
  medium: "中",
  normal: "普通",
};

type PatientSelection = {
  option: CareOption;
  optionSetId?: string;
  stepLabel: string;
  confidence: number;
  confirmed: boolean;
  aiSource?: AiOptionSet["source"];
  aiModel?: string;
  aiGuidance?: string;
};

type ResolvedSelection = {
  option: CareOption;
  optionSetId?: string;
  stepLabel: string;
  aiSource?: AiOptionSet["source"];
  aiModel?: string;
  aiGuidance?: string;
};

function selectionRefs(selections: PatientSelection[]): OptionSelectionRef[] {
  return selections.map((selection) => ({
    optionId: selection.option.id,
    optionSetId: selection.optionSetId,
  }));
}

function buildSteps(selections: PatientSelection[]): ConfidenceStep[] {
  return selections.map((selection) => ({
    label: selection.stepLabel,
    value: selection.option.label,
    confidence: selection.confidence,
    confirmed: selection.confirmed,
    optionId: selection.option.id,
    optionSetId: selection.optionSetId,
    intentCode: selection.option.intentCode,
    taskText: selection.option.taskText,
    riskLevel: selection.option.riskLevel,
    actionMode: selection.option.actionMode,
    terminal: selection.option.terminal,
    nextAction: selection.option.nextAction,
    nextActionReason: selection.option.nextActionReason,
    riskNotice: selection.option.riskNotice,
    evidence: selection.option.evidence ? [...selection.option.evidence] : undefined,
    safetyRule: selection.option.safetyRule,
    aiSource: selection.aiSource,
    aiModel: selection.aiModel,
    aiGuidance: selection.aiGuidance,
  }));
}

function buildNeed(selections: PatientSelection[]) {
  const option = selections.at(-1)?.option;
  return option?.taskText || option?.label || "需要协助";
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatGeneratedTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
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
  selection: ResolvedSelection;
};

type TaskMutationResponse = DemoState & { task: CareTask };

type BciBridgeStatus = {
  connected: boolean;
  source: string;
  streamName: string;
  state: "offline" | "searching" | "streaming" | "idle" | "target";
  channels: number[];
  frequencies: number[];
  sampleRate?: number;
  lastSeenAt?: string;
  lastFrequency?: number;
  lastConfidence?: number;
  detail?: string;
};

type BciSelectionEvent = {
  id: number;
  targetIndex: number;
  confidence: number;
  frequency: number;
  rawScore: number;
  margin: number;
  stableCount: number;
  scores: number[];
  windowSeconds?: number;
  stepSeconds?: number;
  harmonics?: number;
  minScore?: number;
  minMargin?: number;
  stableRequired?: number;
  receivedAt: string;
};

type BciPollResponse = {
  cursor: number;
  status: BciBridgeStatus;
  events: BciSelectionEvent[];
};

function targetFrequency(status: BciBridgeStatus, targetIndex: number) {
  return status.frequencies[targetIndex] ?? DEFAULT_SSVEP_FREQUENCIES[targetIndex] ?? DEFAULT_SSVEP_FREQUENCIES[0];
}

function formatTargetLabel(status: BciBridgeStatus, targetIndex: number) {
  return `F${targetIndex + 1} · ${targetFrequency(status, targetIndex)} Hz`;
}

function formatBciEventDetail(event: BciSelectionEvent) {
  const stable = event.stableRequired
    ? `${event.stableCount}/${event.stableRequired}`
    : `${event.stableCount}`;
  const scores = event.scores.length
    ? ` · scores ${event.scores.map((score) => score.toFixed(2)).join("/")}`
    : "";
  return [
    `score ${event.rawScore.toFixed(2)}`,
    `margin ${event.margin.toFixed(2)}`,
    `stable ${stable}${scores}`,
  ].join(" · ");
}

const OFFLINE_BCI_STATUS: BciBridgeStatus = {
  connected: false,
  source: "openbci_ssvep",
  streamName: "obci_eeg1",
  state: "offline",
  channels: [1, 3, 4],
  frequencies: [],
};

export default function Home() {
  const [activeView, setActiveView] = useState<View>("patient");
  const [tasks, setTasks] = useState<CareTask[]>(DEFAULT_TASKS);
  const [events, setEvents] = useState<AuditEvent[]>(DEFAULT_EVENTS);
  const [selectedTaskId, setSelectedTaskId] = useState("task-a01");
  const [sessionId, setSessionId] = useState(createSessionId);
  const [patientBed, setPatientBed] = useState(DEMO_PATIENTS[0].bed);
  const [selections, setSelections] = useState<PatientSelection[]>([]);
  const [currentOptionSet, setCurrentOptionSet] = useState<AiOptionSet | null>(null);
  const [optionState, setOptionState] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [simConfidence, setSimConfidence] = useState(CONFIDENCE_BY_STEP[0]);
  const [pendingCandidate, setPendingCandidate] = useState<ResolvedSelection | null>(null);
  const [notice, setNotice] = useState("等待脑控输入");
  const [submitted, setSubmitted] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [clock, setClock] = useState("--:--");
  const [chartBed, setChartBed] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("simulation");
  const [bciStatus, setBciStatus] = useState<BciBridgeStatus>(OFFLINE_BCI_STATUS);
  const [lastBciEvent, setLastBciEvent] = useState<BciSelectionEvent | null>(null);
  const [bciEvents, setBciEvents] = useState<BciSelectionEvent[]>([]);
  const bciCursorRef = useRef(0);
  const bciPollingRef = useRef(false);

  const stage = selections.length;
  const selectedPatient = DEMO_PATIENTS.find((patient) => patient.bed === patientBed) ?? DEMO_PATIENTS[0];
  const isEmergency = selections[0]?.option.intentCode === "category.emergency";
  const isComplete = selections.at(-1)?.option.terminal === true || stage === 3;
  const options = stage === 0 ? ROOT_OPTIONS : currentOptionSet?.options ?? EMPTY_OPTIONS;
  const selectableOptions = useMemo(
    () => options.slice(0, SSVEP_OPTION_TARGET_COUNT),
    [options],
  );
  const canGoBack = stage > 0;
  const totalSteps = isComplete ? stage : 3;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  const selectedTaskPatient = selectedTask
    ? DEMO_PATIENTS.find((patient) => patient.bed === selectedTask.bed)
    : undefined;
  const chartPatient = chartBed
    ? DEMO_PATIENTS.find((patient) => patient.bed === chartBed)
    : undefined;
  const selectedClinicalStep = selectedTask
    ? [...selectedTask.steps].reverse().find((step) => step.riskNotice || step.safetyRule)
    : undefined;
  const pendingCount = tasks.filter((task) => task.status === "pending").length;
  const currentTitle = isComplete
    ? "请确认本次需求"
    : stage === 0
      ? "请选择需求分类"
      : currentOptionSet?.question || "正在生成引导选项";
  const optionSourceLabel = stage === 0
    ? "固定安全菜单"
    : !currentOptionSet
      ? "准备受控引导选项"
      : currentOptionSet.source === "deepseek"
        ? "DeepSeek AI引导 · 选项已冻结"
        : currentOptionSet.source === "mock_ai"
          ? "AI引导模拟 · 选项已冻结"
          : "安全兜底 · 选项已冻结";
  const visibleDecisionSummary = currentOptionSet?.decisionSummary
    || (selectedPatient.swallowingRisk === "high" && selections[0]?.option.intentCode === "category.basic_care"
      ? "检测到吞咽风险：饮水/进食需求直接转护理评估；疼痛需求继续追问。"
      : selectedPatient.motorFunction === "limb_disability" && selections[0]?.option.intentCode === "category.basic_care"
        ? "根据肢体失能病历：进食和体位需求转护理协助；疼痛需求继续追问。"
        : selectedPatient.positionRestriction === "postoperative_assessment" && selections[0]?.option.intentCode === "category.basic_care"
          ? "检测到术后体位限制：体位需求直接转护理评估；疼痛需求继续追问。"
          : currentOptionSet?.guidance || "已按审核白名单生成本层引导选项。");
  const visibleClinicalContext = currentOptionSet?.clinicalContextUsed?.length
    ? currentOptionSet.clinicalContextUsed
    : [selectedPatient.communication, selectedPatient.motorFunctionLabel, selectedPatient.oralIntakeLabel, selectedPatient.positionRestrictionLabel];

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
    if (!sessionId || submitted || isComplete || stage === 0) return;
    const controller = new AbortController();

    apiRequest<AiOptionSet>("/api/options/generate", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({
        sessionId,
        bed: selectedPatient.bed,
        stage,
        selections: selectionRefs(selections),
      }),
    })
      .then((optionSet) => {
        setCurrentOptionSet(optionSet);
        setOptionState("ready");
        setNotice(
          optionSet.source === "deepseek"
            ? "DeepSeek 引导选项已就绪"
            : optionSet.source === "mock_ai"
              ? "AI引导选项已就绪"
              : "已启用安全兜底选项",
        );
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setOptionState("failed");
        setNotice(`引导选项生成失败：${error.message}`);
      });

    return () => controller.abort();
  }, [isComplete, patientBed, sessionId, stage, submitted, selections, selectedPatient.bed]);

  useEffect(() => {
    const updateClock = () => setClock(formatClock(new Date()));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!chartBed) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChartBed(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [chartBed]);

  function acceptChoice(
    selection: ResolvedSelection,
    confidence: number,
    confirmed: boolean,
    nextEvents: AuditEvent[],
  ) {
    const nextStage = stage + 1;
    setSelections((current) => [...current, { ...selection, confidence, confirmed }]);
    setEvents(nextEvents);
    setPendingCandidate(null);
    setCurrentOptionSet(null);
    setOptionState("idle");
    setNotice(`已确认：${selection.option.label}`);
    if (nextStage < 3 && !selection.option.terminal) {
      setSimConfidence(CONFIDENCE_BY_STEP[nextStage]);
    }
  }

  async function selectOption(
    option: CareOption,
    confirmed = false,
    confidenceOverride?: number,
  ) {
    if (isComplete || submitted || isBusy || !sessionId) return;
    const confidence = Number((confidenceOverride ?? simConfidence).toFixed(2));

    setIsBusy(true);
    try {
      const result = await apiRequest<EvaluateResponse>("/api/brain-control/evaluate", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          bed: selectedPatient.bed,
          stage,
          optionId: option.id,
          optionSetId: stage === 0 ? undefined : currentOptionSet?.id,
          confidence,
          confirmed,
          selections: selectionRefs(selections),
        }),
      });
      setEvents(result.events);

      if (result.decision === "rejected") {
        setNotice("置信度不足，本次输入未执行");
        return;
      }
      if (result.decision === "confirmation_required") {
        setPendingCandidate(result.selection);
        setNotice("需要再次确认本次选择");
        return;
      }
      acceptChoice(result.selection, confidence, confirmed, result.events);
    } catch (error) {
      setNotice(`后端处理失败：${(error as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  }
  const selectBciOption = useEffectEvent(selectOption);

  function goBackOneLevel() {
    if (!canGoBack) return;
    setSelections((current) => current.slice(0, -1));
    setCurrentOptionSet(null);
    setOptionState("idle");
    setPendingCandidate(null);
    setNotice("已返回上一级");
    setSimConfidence(CONFIDENCE_BY_STEP[Math.max(0, stage - 1)]);
  }
  const goBackBciTarget = useEffectEvent(goBackOneLevel);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "BUTTON") return;
      if (inputMode !== "simulation") return;
      if (activeView !== "patient" || submitted || pendingCandidate || isBusy) return;
      const index = Number(event.key) - 1;
      if (isComplete) {
        if (index === FINAL_CONFIRM_TARGET_INDEX) void confirmRequest();
        if (index === FINAL_RESET_TARGET_INDEX) resetPatientFlow();
        return;
      }
      if (index === BACK_TARGET_INDEX && canGoBack) {
        goBackOneLevel();
        return;
      }
      if (index >= 0 && index < selectableOptions.length) void selectOption(selectableOptions[index]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (inputMode !== "openbci") return;
    let cancelled = false;

    async function pollBci() {
      if (cancelled || bciPollingRef.current) return;
      bciPollingRef.current = true;
      try {
        const snapshot = await apiRequest<BciPollResponse>(
          `/api/bci/events?after=${bciCursorRef.current}`,
        );
        if (cancelled) return;
        bciCursorRef.current = snapshot.cursor;
        setBciStatus(snapshot.status);

        if (snapshot.events.length > 0) {
          setBciEvents((current) => [...snapshot.events].reverse().concat(current).slice(0, 8));
        }
        const event = snapshot.events.at(-1);
        if (!event) return;
        setLastBciEvent(event);
        setSimConfidence(event.confidence);

        if (
          activeView !== "patient"
          || submitted
          || isBusy
          || optionState === "generating"
        ) {
          setNotice(`已收到 F${event.targetIndex + 1}，当前页面暂不接受选择`);
          return;
        }

        if (isComplete) {
          if (event.targetIndex === FINAL_CONFIRM_TARGET_INDEX) {
            setNotice("已收到 F1，确认发送需求");
            await confirmBciRequest();
            return;
          }
          if (event.targetIndex === FINAL_RESET_TARGET_INDEX) {
            resetBciPatientFlow();
            setNotice("已收到 F2，返回重新选择");
            return;
          }
          setNotice("最终确认页仅接受 F1 确认发送或 F2 重新选择");
          return;
        }

        if (event.targetIndex === BACK_TARGET_INDEX) {
          if (!canGoBack) {
            setNotice("F5 当前没有上一级可返回，本次输入已忽略");
            return;
          }
          goBackBciTarget();
          return;
        }

        const option = selectableOptions[event.targetIndex];
        if (!option) {
          setNotice(`F${event.targetIndex + 1} 当前没有对应候选项，本次输入已忽略`);
          return;
        }

        if (pendingCandidate) {
          if (pendingCandidate.option.id !== option.id) {
            const expectedIndex = selectableOptions.findIndex(
              (item) => item.id === pendingCandidate.option.id,
            );
            setNotice(
              expectedIndex >= 0
                ? `请再次注视 F${expectedIndex + 1} 完成确认`
                : "请再次注视原候选项完成确认",
            );
            return;
          }
          await selectBciOption(pendingCandidate.option, true, event.confidence);
          return;
        }

        await selectBciOption(option, false, event.confidence);
      } catch (error) {
        if (!cancelled) {
          setBciStatus((current) => ({ ...current, connected: false, state: "offline" }));
          setNotice(`OpenBCI 接口异常：${(error as Error).message}`);
        }
      } finally {
        bciPollingRef.current = false;
      }
    }

    void pollBci();
    const timer = window.setInterval(() => void pollBci(), 700);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    activeView,
    canGoBack,
    inputMode,
    isBusy,
    isComplete,
    optionState,
    pendingCandidate,
    selectableOptions,
    submitted,
  ]);

  async function changeInputMode(nextMode: InputMode) {
    if (nextMode === inputMode) return;
    if (nextMode === "simulation") {
      setInputMode("simulation");
      setNotice("已切换为点击 / 数字键模拟");
      return;
    }

    try {
      const snapshot = await apiRequest<BciPollResponse>("/api/bci/events");
      bciCursorRef.current = snapshot.cursor;
      setBciStatus(snapshot.status);
      setLastBciEvent(snapshot.events.at(-1) ?? null);
      setBciEvents([...snapshot.events].reverse().slice(0, 8));
      setInputMode("openbci");
      setNotice(snapshot.status.connected ? "OpenBCI 已连接，等待稳定目标" : "等待 OpenBCI 桥接器连接");
    } catch (error) {
      setNotice(`无法启用 OpenBCI：${(error as Error).message}`);
    }
  }

  async function confirmRequest() {
    if (isBusy || !isComplete || !sessionId) return;
    setIsBusy(true);
    try {
      const result = await apiRequest<TaskMutationResponse>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          bed: selectedPatient.bed,
          steps: buildSteps(selections),
        }),
      });
      setTasks(result.tasks);
      setEvents(result.events);
      setSelectedTaskId(result.task.id);
      setSubmitted(true);
      setNotice("需求已发送至护理端");
    } catch (error) {
      setNotice(`任务创建失败：${(error as Error).message}`);
    } finally {
      setIsBusy(false);
    }
  }

  function resetPatientFlow() {
    setSelections([]);
    setSessionId(createSessionId());
    setCurrentOptionSet(null);
    setOptionState("idle");
    setSimConfidence(CONFIDENCE_BY_STEP[0]);
    setPendingCandidate(null);
    setNotice("等待脑控输入");
    setSubmitted(false);
  }
  const confirmBciRequest = useEffectEvent(confirmRequest);
  const resetBciPatientFlow = useEffectEvent(resetPatientFlow);

  function changeDemoPatient(nextBed: string) {
    setPatientBed(nextBed);
    resetPatientFlow();
    const nextPatient = DEMO_PATIENTS.find((patient) => patient.bed === nextBed);
    setNotice(nextPatient ? `已切换：${nextPatient.scenarioLabel}` : "等待脑控输入");
  }

  async function mutateTask(
    task: CareTask,
    action: "accept" | "complete" | "request_assessment" | "mark_unable" | "transfer",
  ) {
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
    if (task.status === "done" || task.status === "blocked") return;
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

  const resultSteps = buildSteps(selections);
  const resultClinicalStep = [...resultSteps].reverse().find((step) => step.riskNotice || step.safetyRule);
  const overallConfidence = resultSteps.length
    ? Math.min(...resultSteps.map((item) => item.confidence))
    : 0;
  const previewPriority: Priority = resultSteps.some((step) => step.riskLevel === "urgent")
    ? "high"
    : resultSteps.some((step) => step.riskLevel === "attention")
      ? "medium"
      : "normal";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="脑护通">
          <span className="brand-mark" aria-hidden="true">脑</span>
          <div>
            <strong className="brand-name">脑护通</strong>
            <span className="brand-role">AI临床情境辅助 Demo V3</span>
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
            护理端
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
                <span className="eyebrow">床位 {selectedPatient.bed} · 脑控表达</span>
                <h1 id="patient-title">{submitted ? "需求已经送达" : currentTitle}</h1>
                <p>{submitted ? "护理端已收到完整的分层确认记录" : "注视目标或使用数字键完成当前层选择"}</p>
              </div>
              <div className="step-progress" aria-label={`当前第 ${Math.min(stage + 1, totalSteps)} 步，共 ${totalSteps} 步`}>
                {Array.from({ length: totalSteps }, (_, index) => (
                  <span
                    key={index}
                    className={index < stage ? "is-done" : index === stage && !submitted ? "is-current" : ""}
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
            </header>

            {!submitted && !isComplete && (
              <>
                <div className="option-source-row">
                  <span role="status">{optionSourceLabel}</span>
                  {stage > 0 && <small>仅从审核白名单生成，不执行设备操作</small>}
                </div>

                {stage > 0 && currentOptionSet && (
                  <section
                    className={`ai-insight-strip ${currentOptionSet.source}`}
                    aria-label="受控路径实时分析"
                  >
                    <div className="ai-insight-meta">
                      <span>
                        <i aria-hidden="true" />
                        {currentOptionSet.source === "deepseek" ? "DeepSeek 实时分析" : currentOptionSet.source === "mock_ai" ? "AI路径模拟" : "安全回退路径"}
                      </span>
                      <small>{currentOptionSet.model} · {formatGeneratedTime(currentOptionSet.generatedAt)}</small>
                    </div>
                    <div className="ai-insight-copy">
                      <strong>{visibleDecisionSummary}</strong>
                      {currentOptionSet.guidance && currentOptionSet.guidance !== visibleDecisionSummary && <p>{currentOptionSet.guidance}</p>}
                      <div className="context-tags" aria-label="本轮引用的模拟病历字段">
                        {visibleClinicalContext.map((item) => <span key={item}>{item}</span>)}
                      </div>
                    </div>
                  </section>
                )}

                {(optionState === "idle" || optionState === "generating") && stage > 0 ? (
                  <div className="option-loading" role="status">正在生成受控引导选项…</div>
                ) : (
                  <div className={`option-grid${canGoBack ? " with-back-target" : ""}`} role="group" aria-label="脑控候选项">
                    {selectableOptions.map((option, index) => {
                      const frequency = targetFrequency(bciStatus, index);
                      return (
                        <button
                          type="button"
                          className="ssvep-option"
                          key={option.id}
                          disabled={isBusy || !sessionId}
                          onClick={() => void selectOption(option)}
                        >
                          <span className="option-target-row">
                            <span className="target-label">{formatTargetLabel(bciStatus, index)}</span>
                            <span className="option-markers">
                              {option.evidence?.length ? <span className="clinical-option-marker">病历</span> : null}
                              {option.safetyRule && <span className="safety-option-marker">需评估</span>}
                              {(currentOptionSet?.source === "deepseek" || currentOptionSet?.source === "mock_ai") && <span className="ai-option-marker">AI</span>}
                            </span>
                          </span>
                          <span
                            className="ssvep-flicker"
                            style={{ animationDuration: `${1 / frequency}s` }}
                            aria-hidden="true"
                          />
                          <strong>{option.label}</strong>
                          <span className={`option-route ${option.nextAction}`}>
                            {option.nextAction === "clarify" ? "选择后继续确认" : "选择后确认建单"}
                          </span>
                          <span className="key-label">{index + 1}</span>
                        </button>
                      );
                    })}
                    {canGoBack && (
                      <button
                        type="button"
                        className="ssvep-option ssvep-back-option"
                        disabled={isBusy}
                        onClick={goBackOneLevel}
                        >
                          <span className="option-target-row">
                            <span className="target-label">{formatTargetLabel(bciStatus, BACK_TARGET_INDEX)}</span>
                            <span className="option-markers">
                              <span className="navigation-option-marker">返回</span>
                            </span>
                          </span>
                          <span
                            className="ssvep-flicker"
                            style={{ animationDuration: `${1 / targetFrequency(bciStatus, BACK_TARGET_INDEX)}s` }}
                            aria-hidden="true"
                          />
                        <strong>返回上一级</strong>
                        <span className="option-route back_target">回到上一层菜单</span>
                        <span className="key-label">{BACK_TARGET_INDEX + 1}</span>
                      </button>
                    )}
                  </div>
                )}

                {optionState === "failed" && stage > 0 && (
                  <div className="option-error" role="alert">
                    <span>本层选项生成失败，请返回上一级后重试。</span>
                    <button type="button" className="button secondary" onClick={goBackOneLevel}>返回上一级</button>
                  </div>
                )}

                {pendingCandidate && (
                  <div className="confirmation-strip" role="status">
                    <div>
                      <strong>再次确认“{pendingCandidate.option.label}”</strong>
                      <span>当前置信度 {simConfidence.toFixed(2)}</span>
                    </div>
                    <div className="inline-actions">
                      <button type="button" className="button secondary" disabled={isBusy} onClick={() => setPendingCandidate(null)}>
                        取消
                      </button>
                      <button type="button" className="button primary" disabled={isBusy} onClick={() => void selectOption(pendingCandidate.option, true)}>
                        确认本次选择
                      </button>
                    </div>
                  </div>
                )}

                <div className="selection-history" aria-label="已完成的选择">
                  {selections.length === 0 ? (
                    <span className="empty-history">尚未完成选择</span>
                  ) : selections.map((selection, index) => (
                    <span key={`${selection.option.id}-${index}`}>
                      <b>{index + 1}</b>
                      {selection.option.label}
                      <em>{selection.confidence.toFixed(2)}</em>
                    </span>
                  ))}
                </div>
              </>
            )}

            {!submitted && isComplete && (
              <div className="request-review">
                <div className="review-heading">
                  <div>
                    <span className="eyebrow">最终确认</span>
                    <h2>{buildNeed(selections)}</h2>
                  </div>
                  <span className={`priority-badge ${previewPriority}`}>优先级 {PRIORITY_LABEL[previewPriority]}</span>
                </div>
                {resultClinicalStep?.riskNotice && (
                  <div className="clinical-risk-alert" role="status">
                    <strong>安全规则已触发</strong>
                    <span>{resultClinicalStep.riskNotice}</span>
                  </div>
                )}
                <div className="route-decision-alert">
                  <span>受控路径判断</span>
                  <strong>{resultSteps.at(-1)?.nextActionReason || "当前意图已明确，进入护理任务确认。"}</strong>
                </div>
                <ConfidenceChain steps={resultSteps} />
                <div className="confidence-summary">
                  <p>整体置信度取已确认层级中的最低值，用于安全决策。</p>
                  <strong>{overallConfidence.toFixed(2)}</strong>
                </div>
                <div className="final-target-grid" role="group" aria-label="最终确认脑控目标">
                  <button
                    type="button"
                    className="ssvep-option final-confirm-option"
                    disabled={isBusy}
                    onClick={() => void confirmRequest()}
                  >
                    <span className="option-target-row">
                      <span className="target-label">{formatTargetLabel(bciStatus, FINAL_CONFIRM_TARGET_INDEX)}</span>
                      <span className="option-markers">
                        <span className="safety-option-marker">确认</span>
                      </span>
                    </span>
                    <span
                      className="ssvep-flicker"
                      style={{ animationDuration: `${1 / targetFrequency(bciStatus, FINAL_CONFIRM_TARGET_INDEX)}s` }}
                      aria-hidden="true"
                    />
                    <strong>{isBusy ? "正在发送…" : "确认并发送需求"}</strong>
                    <span className="option-route confirm_task">生成护理任务并进入护理端</span>
                    <span className="key-label">{FINAL_CONFIRM_TARGET_INDEX + 1}</span>
                  </button>
                  <button
                    type="button"
                    className="ssvep-option final-reset-option"
                    disabled={isBusy}
                    onClick={resetPatientFlow}
                  >
                    <span className="option-target-row">
                      <span className="target-label">{formatTargetLabel(bciStatus, FINAL_RESET_TARGET_INDEX)}</span>
                      <span className="option-markers">
                        <span className="navigation-option-marker">重选</span>
                      </span>
                    </span>
                    <span
                      className="ssvep-flicker"
                      style={{ animationDuration: `${1 / targetFrequency(bciStatus, FINAL_RESET_TARGET_INDEX)}s` }}
                      aria-hidden="true"
                    />
                    <strong>重新选择</strong>
                    <span className="option-route back_target">回到第一层重新选择</span>
                    <span className="key-label">{FINAL_RESET_TARGET_INDEX + 1}</span>
                  </button>
                </div>
              </div>
            )}

            {submitted && (
              <div className="success-state" role="status">
                <span className="success-mark" aria-hidden="true">✓</span>
                <h2>{buildNeed(selections)}</h2>
                <p>来源：{isEmergency ? "脑控确认" : "AI引导 · 脑控确认"} · 整体置信度 {overallConfidence.toFixed(2)}</p>
                <div className="review-actions">
                  <button type="button" className="button secondary" onClick={resetPatientFlow}>发起新需求</button>
                  <button type="button" className="button primary" onClick={() => setActiveView("nurse")}>查看护理端</button>
                </div>
              </div>
            )}
          </section>

          <aside className="signal-panel" aria-labelledby="signal-title">
            <header>
              <div>
                <span className="eyebrow">Demo 输入源</span>
                <h2 id="signal-title">{inputMode === "openbci" ? "OpenBCI 实时信号" : "模拟脑控信号"}</h2>
              </div>
              <span className={`live-status${inputMode === "openbci" && !bciStatus.connected ? " is-offline" : ""}`}>
                <i />
                {inputMode === "openbci" ? (bciStatus.connected ? "已连接" : "未连接") : "稳定"}
              </span>
            </header>

            <div className="input-mode-switch" role="group" aria-label="输入方式">
              <button
                type="button"
                className={inputMode === "simulation" ? "is-active" : ""}
                aria-pressed={inputMode === "simulation"}
                onClick={() => void changeInputMode("simulation")}
              >
                模拟输入
              </button>
              <button
                type="button"
                className={inputMode === "openbci" ? "is-active" : ""}
                aria-pressed={inputMode === "openbci"}
                onClick={() => void changeInputMode("openbci")}
              >
                OpenBCI
              </button>
            </div>

            <section className="demo-context-panel" aria-labelledby="demo-context-title">
              <label htmlFor="demo-patient">
                <span id="demo-context-title">模拟病历场景</span>
                <select
                  id="demo-patient"
                  value={selectedPatient.bed}
                  disabled={isBusy}
                  onChange={(event) => changeDemoPatient(event.target.value)}
                >
                  {DEMO_PATIENTS.map((patient) => (
                    <option key={patient.bed} value={patient.bed}>
                      {patient.bed} · {patient.scenarioLabel}
                    </option>
                  ))}
                </select>
              </label>
              <p>{selectedPatient.summary}</p>
              <div className="demo-context-facts">
                <span>肢体状态<strong>{selectedPatient.motorFunctionLabel}</strong></span>
                <span>进食状态<strong>{selectedPatient.oralIntakeLabel}</strong></span>
                <span>体位限制<strong>{selectedPatient.positionRestrictionLabel}</strong></span>
              </div>
              <button
                type="button"
                className="chart-open-button"
                onClick={() => setChartBed(selectedPatient.bed)}
              >
                查看完整模拟病历
              </button>
            </section>

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
                disabled={inputMode === "openbci"}
                onChange={(event) => setSimConfidence(Number(event.target.value))}
              />
            </label>

            <div className="threshold-list">
              <div><b className="reject" />低于 0.70<span>拒绝输入</span></div>
              <div><b className="confirm" />0.70–0.85<span>再次确认</span></div>
              <div><b className="accept" />不低于 0.85<span>正常接受</span></div>
            </div>

            <div className="signal-readout">
              <span>输入方式</span>
              <strong>{inputMode === "openbci" ? "Cyton+Daisy · LSL" : "点击 / 数字键模拟"}</strong>
              <span>通道</span>
              <strong>{inputMode === "openbci" ? bciStatus.channels.join(" / ") : "模拟目标 F1–F4"}</strong>
              {inputMode === "openbci" && (
                <>
                  <span>数据流</span>
                  <strong>{bciStatus.streamName}{bciStatus.sampleRate ? ` · ${bciStatus.sampleRate} Hz` : ""}</strong>
                  <span>最近识别</span>
                  <strong>
                    {lastBciEvent
                      ? `F${lastBciEvent.targetIndex + 1} · ${lastBciEvent.frequency} Hz · ${formatBciEventDetail(lastBciEvent)}`
                      : "尚无稳定目标"}
                  </strong>
                </>
              )}
              <span>当前状态</span><strong>{notice}</strong>
            </div>

            {inputMode === "openbci" && (
              <section className="event-preview bci-recognition-log" aria-labelledby="bci-events-title">
                <h3 id="bci-events-title">OpenBCI 识别日志</h3>
                {bciEvents.length === 0 && (
                  <div className="event-row">
                    <time>--:--</time>
                    <p><strong>暂无识别记录</strong><span>等待 OpenBCI 稳定目标</span></p>
                  </div>
                )}
                {bciEvents.slice(0, 4).map((event) => (
                  <div className="event-row" key={event.id}>
                    <time>{new Date(event.receivedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
                    <p>
                      <strong>F{event.targetIndex + 1} · {event.frequency} Hz</strong>
                      <span>{formatBciEventDetail(event)}</span>
                    </p>
                  </div>
                ))}
              </section>
            )}

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

              {selectedTaskPatient && (
                <section className="case-chart-summary" aria-labelledby="case-chart-title">
                  <div>
                    <span id="case-chart-title">模拟病历摘要</span>
                    <strong>{selectedTaskPatient.admissionSummary}</strong>
                    <small>{selectedTaskPatient.diagnoses.join(" · ")}</small>
                  </div>
                  <button type="button" onClick={() => setChartBed(selectedTaskPatient.bed)}>
                    查看病历
                  </button>
                </section>
              )}

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

              {selectedClinicalStep && (
                <section className="clinical-review-section" aria-labelledby="clinical-review-title">
                  <div className="section-heading">
                    <h3 id="clinical-review-title">风险提示与依据</h3>
                    <span>仅用于护理人员确认</span>
                  </div>
                  <div className="clinical-review-grid">
                    <div className="clinical-review-notice">
                      <span>风险提示</span>
                      <strong>{selectedClinicalStep.riskNotice}</strong>
                    </div>
                    <div>
                      <span>模拟病历依据</span>
                      <ul>
                        {selectedClinicalStep.evidence?.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <span>安全规则</span>
                      <strong>{selectedClinicalStep.safetyRule}</strong>
                    </div>
                    <div>
                      <span>AI引导依据</span>
                      <strong>{selectedClinicalStep.aiGuidance || "固定安全规则生成"}</strong>
                      {selectedClinicalStep.aiModel && <small>{selectedClinicalStep.aiModel}</small>}
                    </div>
                  </div>
                </section>
              )}

              <section className="action-section" aria-labelledby="action-title">
                <div className="section-heading">
                  <h3 id="action-title">任务处置</h3>
                  <span>所有操作写入事件记录</span>
                </div>
                <div className="action-context">
                  <div><span>患者</span><strong>床位 {selectedTask.bed}</strong></div>
                  <div><span>当前状态</span><strong>{STATUS_LABEL[selectedTask.status]}</strong></div>
                  <div><span>安全规则</span><strong>{selectedClinicalStep ? "已触发 · 人工确认" : "人工护理确认"}</strong></div>
                </div>
                {selectedTask.handlingNote && (
                  <div className={`handling-note ${selectedTask.status}`}>
                    <span>当前处置记录</span>
                    <strong>{selectedTask.handlingNote}</strong>
                  </div>
                )}
                <div className="button-row care-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={selectedTask.status === "done" || isBusy}
                    onClick={() => void mutateTask(selectedTask, "transfer")}
                  >
                    转交任务
                  </button>
                  {selectedTask.status === "accepted" && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={isBusy}
                      onClick={() => void mutateTask(selectedTask, "request_assessment")}
                    >
                      需进一步评估
                    </button>
                  )}
                  {(selectedTask.status === "accepted" || selectedTask.status === "review") && (
                    <button
                      type="button"
                      className="button secondary danger-action"
                      disabled={isBusy}
                      onClick={() => void mutateTask(selectedTask, "mark_unable")}
                    >
                      暂时无法完成
                    </button>
                  )}
                  <button
                    type="button"
                    className="button primary"
                    disabled={selectedTask.status === "done" || selectedTask.status === "blocked" || isBusy}
                    onClick={() => updateTaskStatus(selectedTask)}
                  >
                    {selectedTask.status === "pending" && `接单并前往 ${selectedTask.bed}`}
                    {selectedTask.status === "accepted" && "标记已完成"}
                    {selectedTask.status === "review" && "评估后完成"}
                    {selectedTask.status === "blocked" && "等待转交处理"}
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

      {chartPatient && (
        <div className="chart-overlay" role="presentation" onMouseDown={() => setChartBed(null)}>
          <aside
            className="chart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chart-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">仅用于功能演示 · 非真实病历</span>
                <h2 id="chart-title">床位 {chartPatient.bed} 模拟病历</h2>
                <p>{chartPatient.patientCode} · {chartPatient.age}</p>
              </div>
              <button type="button" className="chart-close" title="关闭病历" aria-label="关闭病历" onClick={() => setChartBed(null)}>×</button>
            </header>

            <section className="chart-lead">
              <span>入院与场景摘要</span>
              <strong>{chartPatient.admissionSummary}</strong>
              <p>{chartPatient.summary}</p>
            </section>

            <dl className="chart-fields">
              <div><dt>模拟诊断</dt><dd>{chartPatient.diagnoses.join("；")}</dd></div>
              <div><dt>过敏信息</dt><dd>{chartPatient.allergies}</dd></div>
              <div><dt>表达能力</dt><dd>{chartPatient.communication}</dd></div>
              <div><dt>沟通支持</dt><dd>{chartPatient.communicationSupport}</dd></div>
              <div><dt>肢体功能</dt><dd>{chartPatient.motorFunctionLabel}</dd></div>
              <div><dt>吞咽风险</dt><dd>{chartPatient.swallowingRiskLabel}</dd></div>
              <div><dt>饮水状态</dt><dd>{chartPatient.oralIntakeLabel}</dd></div>
              <div><dt>体位限制</dt><dd>{chartPatient.positionRestrictionLabel}</dd></div>
            </dl>

            <section className="chart-notes">
              <h3>护理注意事项</h3>
              <ul>{chartPatient.careNotes.map((note) => <li key={note}>{note}</li>)}</ul>
            </section>

            <footer>
              系统仅用于表达、确认和传递需求；床旁评估、判断与处置由护理人员完成。
            </footer>
          </aside>
        </div>
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
