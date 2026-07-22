export type TaskStatus = "pending" | "accepted" | "done";
export type Priority = "high" | "medium" | "normal";
export type RiskLevel = "normal" | "attention" | "urgent";
export type ActionMode = "request_only";
export type OptionSetSource = "deepseek" | "mock_ai" | "fallback";

export type CareOption = {
  id: string;
  intentCode: string;
  label: string;
  taskText: string;
  riskLevel: RiskLevel;
  actionMode: ActionMode;
  terminal: boolean;
};

export type OptionSelectionRef = {
  optionId: string;
  optionSetId?: string;
};

export type AiOptionSet = {
  id: string;
  sessionId: string;
  stage: 1 | 2;
  question: string;
  stepLabel: string;
  source: OptionSetSource;
  options: CareOption[];
  model: string;
  promptVersion: string;
  guidance?: string;
  generatedAt: string;
  expiresAt: string;
};

export type ConfidenceStep = {
  label: string;
  value: string;
  confidence: number;
  confirmed?: boolean;
  optionId?: string;
  optionSetId?: string;
  intentCode?: string;
  taskText?: string;
  riskLevel?: RiskLevel;
  actionMode?: ActionMode;
  terminal?: boolean;
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

export const ROOT_OPTIONS: CareOption[] = [
  {
    id: "root-emergency",
    intentCode: "category.emergency",
    label: "紧急求助",
    taskText: "患者发起紧急求助",
    riskLevel: "urgent",
    actionMode: "request_only",
    terminal: true,
  },
  {
    id: "root-basic-care",
    intentCode: "category.basic_care",
    label: "基本照护",
    taskText: "患者需要基本照护",
    riskLevel: "normal",
    actionMode: "request_only",
    terminal: false,
  },
  {
    id: "root-environment",
    intentCode: "category.environment",
    label: "环境设备",
    taskText: "患者提出环境设备需求",
    riskLevel: "normal",
    actionMode: "request_only",
    terminal: false,
  },
  {
    id: "root-communication",
    intentCode: "category.communication",
    label: "交流表达",
    taskText: "患者需要协助交流",
    riskLevel: "normal",
    actionMode: "request_only",
    terminal: false,
  },
];

export function evaluateConfidence(confidence: number, confirmed = false): ConfidenceDecision {
  if (confidence < CONFIDENCE_THRESHOLDS.rejectBelow) return "rejected";
  if (confidence < CONFIDENCE_THRESHOLDS.acceptAtOrAbove && !confirmed) {
    return "confirmation_required";
  }
  return "accepted";
}

export function isEmergencyPath(steps: ConfidenceStep[]): boolean {
  return steps[0]?.intentCode === "category.emergency" || steps[0]?.value === "紧急求助";
}

export function expectedStepCount(steps: ConfidenceStep[]): number {
  const terminalIndex = steps.findIndex((step) => step.terminal);
  return terminalIndex >= 0 ? terminalIndex + 1 : 3;
}

export function needFromSteps(steps: ConfidenceStep[]): string {
  const last = steps.at(-1);
  return last?.taskText?.trim() || last?.value?.trim() || "需要协助";
}

export function priorityFromSteps(steps: ConfidenceStep[]): Priority {
  if (steps.some((step) => step.riskLevel === "urgent")) return "high";
  if (steps.some((step) => step.riskLevel === "attention")) return "medium";
  return "normal";
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

export function cloneDemoState(): DemoState {
  return {
    tasks: DEFAULT_TASKS.map((task) => ({
      ...task,
      steps: task.steps.map((step) => ({ ...step })),
    })),
    events: DEFAULT_EVENTS.map((event) => ({ ...event })),
  };
}
