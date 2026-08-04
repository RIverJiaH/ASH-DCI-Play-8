import type { AiOptionSet, OptionSelectionRef } from "../brain-care";
import { demoPatientForBed } from "../demo-patients";
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

  const patient = demoPatientForBed(input.bed);
  if (!patient) {
    throw new DomainError("当前床位没有可用的演示病历场景", 422, "DEMO_PATIENT_NOT_FOUND");
  }

  const path = aiOptionStore.resolvePath(input.sessionId, patient.bed, input.selections);
  if (path[0]?.option.intentCode === "category.emergency") {
    throw new DomainError("紧急求助不调用 AI，直接进入确认", 422, "EMERGENCY_BYPASSES_AI");
  }

  const parentIntentCode = path.at(-1)?.option.intentCode ?? "";
  const group = approvedOptionsFor(parentIntentCode, patient);
  if (!group) {
    throw new DomainError("当前路径没有可用的受控选项", 422, "NO_APPROVED_OPTIONS");
  }

  const clinicalContextUsed = clinicalContextFor(patient, parentIntentCode);
  const decisionSummary = decisionSummaryFor(parentIntentCode, group.options, patient);

  const mode = process.env.AI_OPTIONS_MODE?.trim().toLowerCase();
  if (mode === "deepseek") {
    try {
      const generated = await generateDeepSeekOptions({
        bed: input.bed.trim().toUpperCase(),
        patient,
        pathIntentCodes: path.map((item) => item.option.intentCode),
        question: group.question,
        options: group.options,
      });
      return aiOptionStore.create({
        sessionId: input.sessionId,
        bed: patient.bed,
        stage: input.stage,
        pathIntentCodes: path.map((item) => item.option.intentCode),
        question: generated.question,
        stepLabel: group.stepLabel,
        source: "deepseek",
        options: generated.options,
        model: generated.model,
        promptVersion: "deepseek-options-v3",
        guidance: generated.guidance,
        decisionSummary,
        clinicalContextUsed,
      });
    } catch (error) {
      console.error("DeepSeek option generation failed; using approved fallback", error);
      return createApprovedFallback(
        input,
        path.map((item) => item.option.intentCode),
        group,
        decisionSummary,
        clinicalContextUsed,
      );
    }
  }

  const source = mode === "fallback" ? "fallback" : "mock_ai";
  const model = source === "mock_ai"
    ? process.env.AI_OPTIONS_MODEL || "mock-ai-v1"
    : "approved-fallback-v1";

  return aiOptionStore.create({
    sessionId: input.sessionId,
    bed: patient.bed,
    stage: input.stage,
    pathIntentCodes: path.map((item) => item.option.intentCode),
    question: group.question,
    stepLabel: group.stepLabel,
    source,
    options: group.options,
    model,
    promptVersion: "ai-options-v1",
    guidance: source === "mock_ai" ? decisionSummary : "AI服务不可用，已改用审核白名单。",
    decisionSummary,
    clinicalContextUsed,
  });
}

function createApprovedFallback(
  input: GenerateOptionsInput,
  pathIntentCodes: string[],
  group: NonNullable<ReturnType<typeof approvedOptionsFor>>,
  decisionSummary: string,
  clinicalContextUsed: string[],
): AiOptionSet {
  return aiOptionStore.create({
    sessionId: input.sessionId,
    bed: input.bed,
    stage: input.stage,
    pathIntentCodes,
    question: group.question,
    stepLabel: group.stepLabel,
    source: "fallback",
    options: group.options,
    model: "approved-fallback-v1",
    promptVersion: "deepseek-options-v1",
    guidance: "AI服务不可用，已改用审核白名单，路径判断仍由安全规则约束。",
    decisionSummary,
    clinicalContextUsed,
  });
}

function clinicalContextFor(
  patient: NonNullable<ReturnType<typeof demoPatientForBed>>,
  parentIntentCode: string,
): string[] {
  if (parentIntentCode === "category.basic_care") {
    return [
      patient.communication,
      patient.motorFunctionLabel,
      patient.swallowingRiskLabel,
      patient.oralIntakeLabel,
      patient.positionRestrictionLabel,
    ];
  }
  if (parentIntentCode === "care.pain") {
    return [
      patient.communication,
      patient.scenarioLabel,
      ...patient.diagnoses.slice(0, 2),
      patient.motorFunctionLabel,
      patient.swallowingRiskLabel,
      patient.positionRestrictionLabel,
    ];
  }
  if (parentIntentCode.startsWith("care.hydration")) {
    return [patient.communication, patient.motorFunctionLabel, patient.swallowingRiskLabel, patient.oralIntakeLabel];
  }
  if (parentIntentCode.startsWith("care.position")) {
    return [patient.communication, patient.motorFunctionLabel, patient.positionRestrictionLabel];
  }
  return [patient.communication, patient.scenarioLabel];
}

function decisionSummaryFor(
  parentIntentCode: string,
  options: NonNullable<ReturnType<typeof approvedOptionsFor>>["options"],
  patient: NonNullable<ReturnType<typeof demoPatientForBed>>,
): string {
  if (parentIntentCode === "category.basic_care" && patient.swallowingRisk === "high") {
    return "检测到吞咽风险：候选项已改为口腔湿润和吞咽安全评估，不提供直接饮水动作。";
  }
  if (parentIntentCode === "category.basic_care" && patient.motorFunction === "limb_disability") {
    return "根据肢体失能病历：饮水/进食转为协助任务，体位需求转为肢体摆位协助，疼痛需求继续追问。";
  }
  if (
    parentIntentCode === "category.basic_care"
    && patient.positionRestriction === "postoperative_assessment"
  ) {
    return "检测到术后体位限制：体位与口腔相关请求先转护理评估，避免直接生成具体动作。";
  }
  if (parentIntentCode === "care.pain" && patient.swallowingRisk === "high") {
    return "根据吞咽风险病历：疼痛追问已加入咽喉口腔不适，并保留胸痛等高优先级入口。";
  }
  if (parentIntentCode === "care.pain" && patient.motorFunction === "limb_disability") {
    return "根据肢体失能病历：疼痛追问已改为患侧肢体不适、胸痛和肩手牵拉不适。";
  }
  if (parentIntentCode === "care.pain" && patient.positionRestriction === "postoperative_assessment") {
    return "根据术后体位限制病历：疼痛追问已改为头部术区、胸痛和受压部位评估。";
  }
  const directCount = options.filter((option) => option.nextAction === "confirm_task").length;
  const clarifyCount = options.length - directCount;
  if (directCount > 0 && clarifyCount > 0) {
    return `路径判断：${directCount}项意图明确可确认建单，${clarifyCount}项需要继续追问。`;
  }
  if (directCount === options.length) return "本层候选意图均已明确，选择后进入护理任务确认。";
  return "本层候选仍需细化，选择后继续生成一层受控引导选项。";
}
