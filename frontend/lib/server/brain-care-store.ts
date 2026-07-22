import {
  cloneDemoState,
  evaluateConfidence,
  expectedStepCount,
  needFromSteps,
  priorityFromSteps,
  type AuditEvent,
  type CareTask,
  type ConfidenceDecision,
  type ConfidenceStep,
  type DemoState,
  type OptionSelectionRef,
  type TaskStatus,
} from "../brain-care";
import { aiOptionStore, type ResolvedSelection } from "./ai-option-store";
import { DomainError } from "./domain-error";

type BrainInput = {
  sessionId: string;
  bed: string;
  stage: number;
  optionId: string;
  optionSetId?: string;
  confidence: number;
  confirmed?: boolean;
  selections: OptionSelectionRef[];
};

type TaskAction = "accept" | "complete" | "request_assessment" | "mark_unable" | "transfer";

class BrainCareStore {
  private state = cloneDemoState();

  snapshot(): DemoState {
    return {
      tasks: this.state.tasks.map((task) => ({
        ...task,
        steps: task.steps.map(cloneStep),
      })),
      events: this.state.events.map((event) => ({ ...event })),
    };
  }

  reset(): DemoState {
    this.state = cloneDemoState();
    aiOptionStore.reset();
    return this.snapshot();
  }

  evaluateInput(input: BrainInput): {
    decision: ConfidenceDecision;
    event?: AuditEvent;
    selection: ResolvedSelection;
  } {
    const selection = validateBrainInput(input);
    const decision = evaluateConfidence(input.confidence, input.confirmed);

    if (decision === "confirmation_required") return { decision, selection };

    const title = decision === "accepted" ? "脑控选择已确认" : "脑控输入已拒绝";
    const event = this.addEvent(
      title,
      `${selection.option.label} · 置信度 ${input.confidence.toFixed(2)}`,
    );
    return { decision, event, selection };
  }

  createTask(sessionId: string, bed: string, steps: ConfidenceStep[]): CareTask {
    const normalizedBed = validateBed(bed);
    const normalizedSteps = validateTaskSteps(sessionId, normalizedBed, steps);
    const need = needFromSteps(normalizedSteps);
    const task: CareTask = {
      id: `task-${normalizedBed.toLowerCase()}-${Date.now()}`,
      bed: normalizedBed,
      need,
      source: normalizedSteps.some((step) => step.aiSource === "deepseek")
        ? "AI引导 · 脑控确认"
        : normalizedSteps.length > 1
          ? "受控引导 · 脑控确认"
          : "脑控确认",
      priority: priorityFromSteps(normalizedSteps),
      status: "pending",
      createdAt: new Date().toISOString(),
      steps: normalizedSteps,
      updatedAt: new Date().toISOString(),
    };

    this.state.tasks = [task, ...this.state.tasks];
    this.addEvent("护理任务已创建", `${task.bed} · ${task.need}`);
    return { ...task, steps: task.steps.map(cloneStep) };
  }

  updateTask(id: string, action: TaskAction): CareTask {
    const task = this.state.tasks.find((item) => item.id === id);
    if (!task) throw new DomainError("任务不存在", 404, "TASK_NOT_FOUND");

    if (action === "transfer") {
      if (task.status === "done") {
        throw new DomainError("已完成任务不能转交", 409, "INVALID_STATUS_TRANSITION");
      }
      this.addEvent("已记录转交申请", `${task.bed} · ${task.need}`);
      return { ...task, steps: task.steps.map(cloneStep) };
    }

    const allowedStatuses: Record<Exclude<TaskAction, "transfer">, TaskStatus[]> = {
      accept: ["pending"],
      complete: ["accepted", "review"],
      request_assessment: ["accepted"],
      mark_unable: ["accepted", "review"],
    };
    if (!allowedStatuses[action].includes(task.status)) {
      throw new DomainError(
        `任务当前状态为 ${task.status}，不能执行 ${action}`,
        409,
        "INVALID_STATUS_TRANSITION",
      );
    }

    if (action === "accept") {
      task.status = "accepted";
      task.handlingNote = "护理人员已接单，等待床旁处置。";
      this.addEvent("护理人员已接单", `${task.bed} · ${task.need}`);
    } else if (action === "request_assessment") {
      task.status = "review";
      task.handlingNote = "护理人员已标记需进一步评估。";
      this.addEvent("任务转入进一步评估", `${task.bed} · ${task.need}`);
    } else if (action === "mark_unable") {
      task.status = "blocked";
      task.handlingNote = "当前暂时无法完成，等待转交或后续处理。";
      this.addEvent("任务暂时无法完成", `${task.bed} · ${task.need}`);
    } else {
      const completedAfterReview = task.status === "review";
      task.status = "done";
      task.handlingNote = completedAfterReview
        ? "护理评估与处置已完成。"
        : "护理任务已完成。";
      this.addEvent("护理任务已完成", `${task.bed} · ${task.need}`);
    }
    task.updatedAt = new Date().toISOString();
    return { ...task, steps: task.steps.map(cloneStep) };
  }

  private addEvent(title: string, detail: string): AuditEvent {
    const event: AuditEvent = {
      id: `event-${crypto.randomUUID()}`,
      time: formatClock(new Date()),
      title,
      detail,
    };
    this.state.events = [event, ...this.state.events].slice(0, 12);
    return { ...event };
  }
}

function validateBrainInput(input: BrainInput): ResolvedSelection {
  const normalizedBed = validateBed(input.bed);
  if (!Number.isInteger(input.stage) || input.stage < 0 || input.stage > 2) {
    throw new DomainError("stage 必须是 0、1 或 2");
  }
  validateConfidence(input.confidence);
  if (!Array.isArray(input.selections) || input.selections.length !== input.stage) {
    throw new DomainError("selections 必须包含当前层之前的选择");
  }
  const path = aiOptionStore.resolvePath(input.sessionId, normalizedBed, [
    ...input.selections,
    { optionId: input.optionId, optionSetId: input.optionSetId },
  ]);
  return path[input.stage];
}

function validateTaskSteps(sessionId: string, bed: string, steps: ConfidenceStep[]): ConfidenceStep[] {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 3) {
    throw new DomainError("护理任务必须包含 1 到 3 层确认结果");
  }

  const refs = steps.map((step, index) => {
    if (typeof step.optionId !== "string" || !step.optionId.trim()) {
      throw new DomainError(`steps[${index}].optionId 不能为空`);
    }
    return { optionId: step.optionId, optionSetId: step.optionSetId };
  });
  const resolved = aiOptionStore.resolvePath(sessionId, bed, refs);
  if (steps.length !== expectedStepCount(stepsFromResolved(resolved))) {
    throw new DomainError("选择路径尚未完成或包含多余层级", 422, "INCOMPLETE_SELECTION_PATH");
  }

  return steps.map((step, index) => {
    validateConfidence(step.confidence);
    const decision = evaluateConfidence(step.confidence, step.confirmed);
    if (decision !== "accepted") {
      throw new DomainError(
        decision === "rejected"
          ? `第 ${index + 1} 层置信度不足`
          : `第 ${index + 1} 层需要二次确认`,
        422,
        "UNCONFIRMED_STEP",
      );
    }
    const authoritative = resolved[index];
    return {
      label: authoritative.stepLabel,
      value: authoritative.option.label,
      confidence: Number(step.confidence.toFixed(2)),
      confirmed: Boolean(step.confirmed),
      optionId: authoritative.option.id,
      optionSetId: authoritative.optionSetId,
      intentCode: authoritative.option.intentCode,
      taskText: authoritative.option.taskText,
      riskLevel: authoritative.option.riskLevel,
      actionMode: authoritative.option.actionMode,
      terminal: authoritative.option.terminal,
      nextAction: authoritative.option.nextAction,
      nextActionReason: authoritative.option.nextActionReason,
      riskNotice: authoritative.option.riskNotice,
      evidence: authoritative.option.evidence ? [...authoritative.option.evidence] : undefined,
      safetyRule: authoritative.option.safetyRule,
      aiSource: authoritative.aiSource,
      aiModel: authoritative.aiModel,
      aiGuidance: authoritative.aiGuidance,
    };
  });
}

function stepsFromResolved(resolved: ResolvedSelection[]): ConfidenceStep[] {
  return resolved.map((item) => ({
    label: item.stepLabel,
    value: item.option.label,
    confidence: 1,
    intentCode: item.option.intentCode,
    terminal: item.option.terminal,
  }));
}

function validateBed(value: string): string {
  const bed = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z]\d{2}$/.test(bed)) throw new DomainError("bed 格式必须类似 A01");
  return bed;
}

function cloneStep(step: ConfidenceStep): ConfidenceStep {
  return {
    ...step,
    evidence: step.evidence ? [...step.evidence] : undefined,
  };
}

function validateConfidence(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new DomainError("confidence 必须在 0 到 1 之间");
  }
}

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

const globalStore = globalThis as typeof globalThis & {
  __brainCareStore?: BrainCareStore;
};

export const brainCareStore = globalStore.__brainCareStore ??= new BrainCareStore();

export function parseTaskAction(value: unknown): TaskAction {
  if (
    value === "accept"
    || value === "complete"
    || value === "request_assessment"
    || value === "mark_unable"
    || value === "transfer"
  ) return value;
  throw new DomainError("action 必须是 accept、complete、request_assessment、mark_unable 或 transfer");
}

export type { BrainInput };
