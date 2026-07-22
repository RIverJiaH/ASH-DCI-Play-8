import {
  cloneDemoState,
  evaluateConfidence,
  needFromSteps,
  optionsFor,
  priorityFromSteps,
  stepLabelsFor,
  type AuditEvent,
  type CareTask,
  type ConfidenceDecision,
  type ConfidenceStep,
  type DemoState,
  type TaskStatus,
} from "../brain-care";

export class DomainError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}

type BrainInput = {
  bed: string;
  stage: number;
  label: string;
  value: string;
  confidence: number;
  confirmed?: boolean;
  selections: string[];
};

type TaskAction = "accept" | "complete" | "transfer";

class BrainCareStore {
  private state = cloneDemoState();

  snapshot(): DemoState {
    return {
      tasks: this.state.tasks.map((task) => ({
        ...task,
        steps: task.steps.map((step) => ({ ...step })),
      })),
      events: this.state.events.map((event) => ({ ...event })),
    };
  }

  reset(): DemoState {
    this.state = cloneDemoState();
    return this.snapshot();
  }

  evaluateInput(input: BrainInput): { decision: ConfidenceDecision; event?: AuditEvent } {
    validateBrainInput(input);
    const decision = evaluateConfidence(input.confidence, input.confirmed);

    if (decision === "confirmation_required") return { decision };

    const title = decision === "accepted" ? "脑控选择已确认" : "脑控输入已拒绝";
    const event = this.addEvent(title, `${input.value} · 置信度 ${input.confidence.toFixed(2)}`);
    return { decision, event };
  }

  createTask(bed: string, steps: ConfidenceStep[]): CareTask {
    const normalizedBed = validateBed(bed);
    const normalizedSteps = validateTaskSteps(steps);
    const need = needFromSteps(normalizedSteps);
    const task: CareTask = {
      id: `task-${normalizedBed.toLowerCase()}-${Date.now()}`,
      bed: normalizedBed,
      need,
      source: "脑控确认",
      priority: priorityFromSteps(normalizedSteps),
      status: "pending",
      createdAt: new Date().toISOString(),
      steps: normalizedSteps,
    };

    this.state.tasks = [task, ...this.state.tasks];
    this.addEvent("护理任务已创建", `${task.bed} · ${task.need}`);
    return { ...task, steps: task.steps.map((step) => ({ ...step })) };
  }

  updateTask(id: string, action: TaskAction): CareTask {
    const task = this.state.tasks.find((item) => item.id === id);
    if (!task) throw new DomainError("任务不存在", 404, "TASK_NOT_FOUND");

    if (action === "transfer") {
      this.addEvent("已记录转交申请", `${task.bed} · ${task.need}`);
      return { ...task, steps: task.steps.map((step) => ({ ...step })) };
    }

    const expectedStatus: TaskStatus = action === "accept" ? "pending" : "accepted";
    const nextStatus: TaskStatus = action === "accept" ? "accepted" : "done";
    if (task.status !== expectedStatus) {
      throw new DomainError(
        `任务当前状态为 ${task.status}，不能执行 ${action}`,
        409,
        "INVALID_STATUS_TRANSITION",
      );
    }

    task.status = nextStatus;
    this.addEvent(
      nextStatus === "accepted" ? "护理人员已接单" : "护理任务已完成",
      `${task.bed} · ${task.need}`,
    );
    return { ...task, steps: task.steps.map((step) => ({ ...step })) };
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

function validateBrainInput(input: BrainInput) {
  validateBed(input.bed);
  if (!Number.isInteger(input.stage) || input.stage < 0 || input.stage > 2) {
    throw new DomainError("stage 必须是 0、1 或 2");
  }
  validateText(input.label, "label");
  validateText(input.value, "value");
  validateConfidence(input.confidence);
  if (!Array.isArray(input.selections) || input.selections.length !== input.stage) {
    throw new DomainError("selections 必须包含当前层之前的选择");
  }
  validateSelectionPath([...input.selections, input.value]);
  const expectedLabel = stepLabelsFor([...input.selections, input.value])[input.stage];
  if (input.label !== expectedLabel) {
    throw new DomainError(`第 ${input.stage + 1} 层标签必须是 ${expectedLabel}`);
  }
}

function validateTaskSteps(steps: ConfidenceStep[]): ConfidenceStep[] {
  if (!Array.isArray(steps) || steps.length !== 3) {
    throw new DomainError("护理任务必须包含 3 层确认结果");
  }

  const normalized = steps.map((step, index) => {
    validateText(step.label, `steps[${index}].label`);
    validateText(step.value, `steps[${index}].value`);
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

    return {
      label: step.label.trim(),
      value: step.value.trim(),
      confidence: Number(step.confidence.toFixed(2)),
      confirmed: Boolean(step.confirmed),
    };
  });
  validateSelectionPath(normalized.map((step) => step.value));
  const expectedLabels = stepLabelsFor(normalized.map((step) => step.value));
  normalized.forEach((step, index) => {
    if (step.label !== expectedLabels[index]) {
      throw new DomainError(`第 ${index + 1} 层标签必须是 ${expectedLabels[index]}`);
    }
  });
  return normalized;
}

function validateSelectionPath(values: string[]) {
  values.forEach((value, index) => {
    const options = optionsFor(index, values.slice(0, index));
    if (!options.includes(value)) {
      throw new DomainError(`第 ${index + 1} 层选项不在允许范围内`, 422, "INVALID_SELECTION");
    }
  });
}

function validateBed(value: string): string {
  const bed = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z]\d{2}$/.test(bed)) throw new DomainError("bed 格式必须类似 A01");
  return bed;
}

function validateText(value: string, field: string) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80) {
    throw new DomainError(`${field} 必须是 1 到 80 个字符`);
  }
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
  if (value === "accept" || value === "complete" || value === "transfer") return value;
  throw new DomainError("action 必须是 accept、complete 或 transfer");
}

export type { BrainInput };
