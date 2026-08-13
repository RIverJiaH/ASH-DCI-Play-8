import type { DciAgentResponse } from "../dci-demo-state";
import { demoPatientForBed } from "../demo-patients";
import { DomainError } from "./domain-error";

export async function analyzeDciCase(bedValue: unknown): Promise<DciAgentResponse> {
  const bed = typeof bedValue === "string" ? bedValue.trim().toUpperCase() : "";
  const patient = demoPatientForBed(bed);
  if (!patient) throw new DomainError("演示患者不存在", 404, "DCI_CASE_NOT_FOUND");
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const mode = process.env.AI_OPTIONS_MODE?.trim().toLowerCase();

  if (apiKey && mode === "deepseek") {
    try {
      const model = process.env.AI_OPTIONS_MODEL?.trim() || "deepseek-chat";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            max_tokens: 900,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: [
                  "你是SAH-DCI风险趋势演示系统中的受控医学知识增强Agent。",
                  "风险等级已经由循证规则引擎确定，你不得改变积分或风险等级，不得诊断DCI，不得给出处方、用药或治疗决定。",
                  "只根据结构化输入组织固定五段式输出：trigger、evidence、nurseChecklist、doctorSummary、safetyBoundary。",
                  "evidence和nurseChecklist分别为2至6条简短字符串。doctorSummary应包含病程日、主要趋势、质量、积分和待医护复核方向。",
                  "safetyBoundary必须明确系统不替代医生诊断，最终判断与处置由医护人员完成。只输出JSON。",
                ].join("\n"),
              },
              {
                role: "user",
                content: JSON.stringify({
                  bed: patient.bed,
                  stageDay: patient.dci.stageDay,
                  riskScore: patient.dci.riskScore,
                  riskLabel: patient.dci.riskLabel,
                  signalQuality: patient.dci.signalQuality,
                  duration: patient.dci.abnormalDuration,
                  scoreBreakdown: patient.dci.scoreBreakdown,
                  evidence: patient.dci.evidence.map((item) => ({ title: item.title, headline: item.headline, status: item.status })),
                }),
              },
            ],
          }),
        });
        if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
        const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== "string") throw new Error("DeepSeek empty response");
        const output = validateAgentPayload(JSON.parse(content));
        return { source: "deepseek", model, generatedAt: new Date().toISOString(), ...output };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.error("DeepSeek DCI analysis failed; using controlled fallback", error);
    }
  }

  return {
    source: "controlled_fallback",
    model: "evidence-template-v1",
    generatedAt: new Date().toISOString(),
    ...patient.dci.agent,
  };
}

function validateAgentPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid agent payload");
  const item = value as Record<string, unknown>;
  const trigger = text(item.trigger, 500);
  const evidence = list(item.evidence, 2, 6, 180);
  const nurseChecklist = list(item.nurseChecklist, 2, 6, 180);
  const doctorSummary = text(item.doctorSummary, 700);
  const generatedBoundary = text(item.safetyBoundary, 300);
  const safetyBoundary = /不替代|不构成/.test(generatedBoundary)
    ? generatedBoundary
    : "本结果仅用于SAH后DCI风险趋势提示和医护复核辅助，不构成诊断、医嘱或治疗决定；最终判断与处置由医护人员完成。";
  const combined = `${trigger} ${doctorSummary} ${safetyBoundary}`;
  if (/确诊|立即用药|必须手术|自动医嘱|可以替代医生|将替代医生/.test(combined)) throw new Error("unsafe agent wording");
  return { trigger, evidence, nurseChecklist, doctorSummary, safetyBoundary };
}

function text(value: unknown, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("invalid agent text");
  return value.trim();
}

function list(value: unknown, min: number, max: number, itemMax: number) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error("invalid agent list");
  return value.map((entry) => text(entry, itemMax));
}
