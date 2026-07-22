import {
  ROOT_OPTIONS,
  type AiOptionSet,
  type CareOption,
  type OptionSelectionRef,
  type OptionSetSource,
} from "../brain-care";
import { DomainError } from "./domain-error";

type StoredOptionSet = AiOptionSet & { pathIntentCodes: string[] };

type CreateOptionSetInput = {
  sessionId: string;
  bed: string;
  stage: 1 | 2;
  pathIntentCodes: string[];
  question: string;
  stepLabel: string;
  source: OptionSetSource;
  options: CareOption[];
  model: string;
  promptVersion: string;
  guidance?: string;
};

export type ResolvedSelection = {
  option: CareOption;
  optionSetId?: string;
  stepLabel: string;
  aiSource?: OptionSetSource;
  aiModel?: string;
  aiGuidance?: string;
};

class AiOptionStore {
  private sets = new Map<string, StoredOptionSet>();

  reset() {
    this.sets.clear();
  }

  create(input: CreateOptionSetInput): AiOptionSet {
    validateGeneratedOptions(input.options);
    const now = new Date();
    const set: StoredOptionSet = {
      id: `options-${crypto.randomUUID()}`,
      sessionId: validateSessionId(input.sessionId),
      bed: validateBed(input.bed),
      stage: input.stage,
      question: input.question,
      stepLabel: input.stepLabel,
      source: input.source,
      options: input.options.map(cloneOption),
      model: input.model,
      promptVersion: input.promptVersion,
      guidance: input.guidance,
      generatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
      pathIntentCodes: [...input.pathIntentCodes],
    };
    this.sets.set(set.id, set);
    return publicSet(set);
  }

  resolvePath(sessionId: string, bed: string, selections: OptionSelectionRef[]): ResolvedSelection[] {
    const normalizedSessionId = validateSessionId(sessionId);
    const normalizedBed = validateBed(bed);
    if (!Array.isArray(selections) || selections.length > 3) {
      throw new DomainError("selections 必须是最多 3 层的选项引用");
    }

    const resolved: ResolvedSelection[] = [];
    selections.forEach((selection, stage) => {
      if (!selection || typeof selection.optionId !== "string") {
        throw new DomainError(`第 ${stage + 1} 层缺少 optionId`);
      }

      if (stage === 0) {
        if (selection.optionSetId) throw new DomainError("一级选项不应包含 optionSetId");
        const option = ROOT_OPTIONS.find((item) => item.id === selection.optionId);
        if (!option) throw new DomainError("一级选项不在允许范围内", 422, "INVALID_SELECTION");
        resolved.push({ option: cloneOption(option), stepLabel: "需求分类" });
        return;
      }

      const optionSetId = selection.optionSetId?.trim();
      const set = optionSetId ? this.sets.get(optionSetId) : undefined;
      if (!set) throw new DomainError(`第 ${stage + 1} 层选项凭证不存在`, 422, "OPTION_SET_NOT_FOUND");
      if (set.sessionId !== normalizedSessionId || set.bed !== normalizedBed || set.stage !== stage) {
        throw new DomainError("选项凭证与当前床位、会话或层级不匹配", 422, "OPTION_SET_MISMATCH");
      }
      if (Date.parse(set.expiresAt) <= Date.now()) {
        throw new DomainError("选项凭证已过期，请重新生成", 422, "OPTION_SET_EXPIRED");
      }
      const pathIntentCodes = resolved.map((item) => item.option.intentCode);
      if (set.pathIntentCodes.join("|") !== pathIntentCodes.join("|")) {
        throw new DomainError("选项凭证与当前选择路径不匹配", 422, "OPTION_PATH_MISMATCH");
      }
      const option = set.options.find((item) => item.id === selection.optionId);
      if (!option) throw new DomainError("选项不属于当前选项集", 422, "INVALID_SELECTION");
      resolved.push({
        option: cloneOption(option),
        optionSetId: set.id,
        stepLabel: set.stepLabel,
        aiSource: set.source,
        aiModel: set.model,
        aiGuidance: set.guidance,
      });
    });
    return resolved;
  }
}

function validateGeneratedOptions(options: CareOption[]) {
  if (!Array.isArray(options) || options.length !== 3) {
    throw new DomainError("动态选项必须固定为 3 个有效需求", 500, "INVALID_GENERATED_OPTIONS");
  }
  const labels = new Set<string>();
  const ids = new Set<string>();
  options.forEach((option) => {
    if (!option.id || !option.intentCode || !option.label || option.label.length > 12) {
      throw new DomainError("动态选项字段不完整或文案超过 12 个字符", 500, "INVALID_GENERATED_OPTIONS");
    }
    if (labels.has(option.label) || ids.has(option.id)) {
      throw new DomainError("动态选项存在重复", 500, "INVALID_GENERATED_OPTIONS");
    }
    labels.add(option.label);
    ids.add(option.id);
  });
}

function validateSessionId(value: string): string {
  const sessionId = typeof value === "string" ? value.trim() : "";
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(sessionId)) {
    throw new DomainError("sessionId 格式无效");
  }
  return sessionId;
}

function validateBed(value: string): string {
  const bed = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z]\d{2}$/.test(bed)) throw new DomainError("bed 格式必须类似 A01");
  return bed;
}

function cloneOption(option: CareOption): CareOption {
  return {
    ...option,
    evidence: option.evidence ? [...option.evidence] : undefined,
  };
}

function publicSet(set: StoredOptionSet): AiOptionSet {
  return {
    id: set.id,
    sessionId: set.sessionId,
    bed: set.bed,
    stage: set.stage,
    question: set.question,
    source: set.source,
    model: set.model,
    stepLabel: set.stepLabel,
    promptVersion: set.promptVersion,
    guidance: set.guidance,
    generatedAt: set.generatedAt,
    expiresAt: set.expiresAt,
    options: set.options.map(cloneOption),
  };
}

const globalOptionStore = globalThis as typeof globalThis & {
  __brainCareAiOptionStore?: AiOptionStore;
};

export const aiOptionStore = globalOptionStore.__brainCareAiOptionStore ??= new AiOptionStore();
