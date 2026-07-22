export type TaskStatus = "pending" | "accepted" | "done";
export type Priority = "high" | "medium" | "normal";

export type ConfidenceStep = {
  label: string;
  value: string;
  confidence: number;
  confirmed?: boolean;
};

export type CareTask = {
  id: string;
  bed: string;
  need: string;
  source: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  steps: ConfidenceStep[];
};

export type AuditEvent = {
  id: string;
  time: string;
  title: string;
  detail: string;
};

export type DemoState = {
  tasks: CareTask[];
  events: AuditEvent[];
};

export type ConfidenceDecision = "rejected" | "confirmation_required" | "accepted";

export const CONFIDENCE_THRESHOLDS = {
  rejectBelow: 0.7,
  acceptAtOrAbove: 0.85,
} as const;

export function optionsFor(stage: number, selections: string[]): string[] {
  const category = selections[0];
  if (stage === 0) return ["疼痛不适", "呼吸不适", "需要饮水", "调整体位"];
  if (stage === 1) {
    return category === "疼痛不适"
      ? ["腹部", "胸部", "头部", "四肢"]
      : ["立即处理", "尽快处理", "稍后处理", "取消需求"];
  }
  if (category === "呼吸不适") return ["胸闷", "气短", "咳嗽", "其他不适"];
  if (category === "需要饮水") return ["少量饮水", "润唇", "漱口", "其他需求"];
  if (category === "调整体位") return ["抬高床头", "左侧卧", "右侧卧", "恢复平卧"];
  return ["重度持续疼痛", "中度间歇疼痛", "轻度持续疼痛", "疼痛减轻"];
}

export function stepLabelsFor(selections: string[]): string[] {
  return selections[0] === "疼痛不适"
    ? ["需求类型", "疼痛部位", "程度与性质"]
    : ["需求类型", "处理时效", "具体需求"];
}

export const DEFAULT_TASKS: CareTask[] = [
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

export const DEFAULT_EVENTS: AuditEvent[] = [
  { id: "event-1", time: "14:29:42", title: "任务已创建", detail: "A01 · 腹部重度持续疼痛" },
  { id: "event-2", time: "14:27:03", title: "护理人员已接单", detail: "B06 · 调整体位" },
  { id: "event-3", time: "14:25:18", title: "任务已完成", detail: "C12 · 少量饮水" },
];

export function evaluateConfidence(confidence: number, confirmed = false): ConfidenceDecision {
  if (confidence < CONFIDENCE_THRESHOLDS.rejectBelow) return "rejected";
  if (confidence < CONFIDENCE_THRESHOLDS.acceptAtOrAbove && !confirmed) {
    return "confirmation_required";
  }
  return "accepted";
}

export function needFromSteps(steps: ConfidenceStep[]): string {
  const values = steps.map((step) => step.value);
  if (values[0] === "疼痛不适") return `${values[1] ?? ""}${values[2] ?? ""}`;
  return values[2] || values[0] || "需要协助";
}

export function priorityFromSteps(steps: ConfidenceStep[]): Priority {
  const need = needFromSteps(steps);
  if (need.includes("重度") || steps[1]?.value === "立即处理") return "high";
  if (steps[1]?.value === "稍后处理") return "normal";
  return "medium";
}

export function cloneDemoState(): DemoState {
  return {
    tasks: DEFAULT_TASKS.map((task) => ({
      ...task,
      steps: task.steps.map((step) => ({ ...step })),
    })),
    events: DEFAULT_EVENTS.map((event) => ({ ...event })),
  };
}
