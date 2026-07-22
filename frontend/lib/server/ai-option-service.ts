import type { AiOptionSet, OptionSelectionRef } from "../brain-care";
import { approvedOptionsFor } from "./approved-options";
import { aiOptionStore } from "./ai-option-store";
import { DomainError } from "./domain-error";
import { generateDeepSeekOptions } from "./deepseek-option-provider";

type GenerateOptionsInput = {
  sessionId: string;
  bed: string;
  stage: 1 | 2;
  selections: OptionSelectionRef[];
};

export async function generateAiOptionSet(input: GenerateOptionsInput): Promise<AiOptionSet> {
  if (input.stage !== 1 && input.stage !== 2) {
    throw new DomainError("动态选项只能用于第 2 或第 3 层");
  }
  if (!/^[A-Z]\d{2}$/.test(input.bed?.trim().toUpperCase() ?? "")) {
    throw new DomainError("bed 格式必须类似 A01");
  }
  if (!Array.isArray(input.selections) || input.selections.length !== input.stage) {
    throw new DomainError("selections 必须包含当前层之前的选择");
  }

  const path = aiOptionStore.resolvePath(input.sessionId, input.selections);
  if (path[0]?.option.intentCode === "category.emergency") {
    throw new DomainError("紧急求助不调用 AI，直接进入确认", 422, "EMERGENCY_BYPASSES_AI");
  }

  const parentIntentCode = path.at(-1)?.option.intentCode ?? "";
  const group = approvedOptionsFor(parentIntentCode);
  if (!group) {
    throw new DomainError("当前路径没有可用的受控选项", 422, "NO_APPROVED_OPTIONS");
  }

  const mode = process.env.AI_OPTIONS_MODE?.trim().toLowerCase();
  if (mode === "deepseek") {
    try {
      const generated = await generateDeepSeekOptions({
        bed: input.bed.trim().toUpperCase(),
        pathIntentCodes: path.map((item) => item.option.intentCode),
        question: group.question,
        options: group.options,
      });
      return aiOptionStore.create({
        sessionId: input.sessionId,
        stage: input.stage,
        pathIntentCodes: path.map((item) => item.option.intentCode),
        question: generated.question,
        stepLabel: group.stepLabel,
        source: "deepseek",
        options: generated.options,
        model: generated.model,
        promptVersion: "deepseek-options-v1",
      });
    } catch (error) {
      console.error("DeepSeek option generation failed; using approved fallback", error);
      return createApprovedFallback(input, path.map((item) => item.option.intentCode), group);
    }
  }

  const source = mode === "fallback" ? "fallback" : "mock_ai";
  const model = source === "mock_ai"
    ? process.env.AI_OPTIONS_MODEL || "mock-ai-v1"
    : "approved-fallback-v1";

  return aiOptionStore.create({
    sessionId: input.sessionId,
    stage: input.stage,
    pathIntentCodes: path.map((item) => item.option.intentCode),
    question: group.question,
    stepLabel: group.stepLabel,
    source,
    options: group.options,
    model,
    promptVersion: "ai-options-v1",
  });
}

function createApprovedFallback(
  input: GenerateOptionsInput,
  pathIntentCodes: string[],
  group: NonNullable<ReturnType<typeof approvedOptionsFor>>,
): AiOptionSet {
  return aiOptionStore.create({
    sessionId: input.sessionId,
    stage: input.stage,
    pathIntentCodes,
    question: group.question,
    stepLabel: group.stepLabel,
    source: "fallback",
    options: group.options,
    model: "approved-fallback-v1",
    promptVersion: "deepseek-options-v1",
  });
}
