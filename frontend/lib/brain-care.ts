export type TaskStatus = "pending" | "accepted" | "review" | "blocked" | "done";
export type Priority = "high" | "medium" | "normal";
export type RiskLevel = "normal" | "attention" | "urgent";
export type ActionMode = "request_only";
export type OptionSetSource = "deepseek" | "mock_ai" | "fallback";
export type NextAction = "clarify" | "confirm_task";

export type CareOption = {
  id: string;
  intentCode: string;
  label: string;
  taskText: string;
  riskLevel: RiskLevel;
  actionMode: ActionMode;
  terminal: boolean;
  nextAction: NextAction;
  nextActionReason: string;
  riskNotice?: string;
  evidence?: string[];
  safetyRule?: string;
};

export type OptionSelectionRef = {
  optionId: string;
  optionSetId?: string;
};

export type AiOptionSet = {
  id: string;
  sessionId: string;
  bed: string;
  stage: 1 | 2;
  question: string;
  stepLabel: string;
  source: OptionSetSource;
  options: CareOption[];
  model: string;
  promptVersion: string;
  guidance?: string;
  decisionSummary: string;
  clinicalContextUsed: string[];
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
  nextAction?: NextAction;
  nextActionReason?: string;
  riskNotice?: string;
  evidence?: string[];
  safetyRule?: string;
  aiSource?: OptionSetSource;
  aiModel?: string;
  aiGuidance?: string;
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
  handlingNote?: string;
  updatedAt?: string;
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
    nextAction: "confirm_task",
    nextActionReason: "紧急求助不进入 AI 追问，直接确认并生成高优先级任务。",
  },
  {
    id: "root-basic-care",
    intentCode: "category.basic_care",
    label: "基本照护",
    taskText: "患者需要基本照护",
    riskLevel: "normal",
    actionMode: "request_only",
    terminal: false,
    nextAction: "clarify",
    nextActionReason: "需要先区分疼痛、饮水口腔或体位需求。",
  },
  {
    id: "root-environment",
    intentCode: "category.environment",
    label: "环境设备",
    taskText: "患者提出环境设备需求",
    riskLevel: "normal",
    actionMode: "request_only",
    terminal: false,
    nextAction: "clarify",
    nextActionReason: "需要确认具体环境设备和调整方向。",
  },
  {
    id: "root-communication",
    intentCode: "category.communication",
    label: "交流表达",
    taskText: "患者需要协助交流",
    riskLevel: "normal",
    actionMode: "request_only",
    terminal: false,
    nextAction: "clarify",
    nextActionReason: "需要确认呼叫护理、联系家属或表达协助。",
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
    id: "task-b02",
    bed: "B02",
    need: "患者提出饮水或口腔护理需求，存在吞咽风险，需护理人员评估",
    source: "AI引导 · 脑控确认",
    priority: "medium",
    status: "accepted",
    createdAt: "2026-07-21T14:26:19+08:00",
    steps: [
      { label: "需求分类", value: "基本照护", confidence: 0.89 },
      {
        label: "照护类型",
        value: "饮水口腔需评估",
        confidence: 0.86,
        riskLevel: "attention",
        riskNotice: "记录存在吞咽风险，不直接生成饮水动作。",
        evidence: ["吞咽风险高", "饮水前需护理评估"],
        safetyRule: "HYDRATION_REQUIRES_NURSE_ASSESSMENT",
        aiSource: "deepseek",
        aiModel: "deepseek-v4-flash",
        aiGuidance: "已根据吞咽风险，将饮水口腔需求调整为护理评估。",
      },
    ],
  },
  {
    id: "task-c03",
    bed: "C03",
    need: "患者提出体位调整需求，存在术后体位限制，需护理人员评估",
    source: "AI引导 · 脑控确认",
    priority: "medium",
    status: "done",
    createdAt: "2026-07-21T14:18:08+08:00",
    steps: [
      { label: "需求分类", value: "基本照护", confidence: 0.94 },
      {
        label: "照护类型",
        value: "体位调整需评估",
        confidence: 0.9,
        riskLevel: "attention",
        riskNotice: "记录存在术后体位限制，不直接生成具体卧位动作。",
        evidence: ["术后体位调整前需评估", "无法稳定言语表达"],
        safetyRule: "POSITION_REQUIRES_NURSE_ASSESSMENT",
        aiSource: "deepseek",
        aiModel: "deepseek-v4-flash",
        aiGuidance: "已根据术后体位限制，将体位调整需求调整为护理评估。",
      },
    ],
  },
];

export const DEFAULT_EVENTS: AuditEvent[] = [
  { id: "event-1", time: "14:29:42", title: "任务已创建", detail: "A01 · 腹部重度持续疼痛" },
  { id: "event-2", time: "14:27:03", title: "护理人员已接单", detail: "B02 · 饮水口腔需评估" },
  { id: "event-3", time: "14:25:18", title: "任务已完成", detail: "C03 · 体位调整需评估" },
];

export function cloneDemoState(): DemoState {
  return {
    tasks: DEFAULT_TASKS.map((task) => ({
      ...task,
      steps: task.steps.map((step) => ({
        ...step,
        evidence: step.evidence ? [...step.evidence] : undefined,
      })),
    })),
    events: DEFAULT_EVENTS.map((event) => ({ ...event })),
  };
}
