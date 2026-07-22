import type { CareOption } from "../brain-care";

type GenerateDeepSeekOptionsInput = {
  bed: string;
  pathIntentCodes: string[];
  question: string;
  options: CareOption[];
};

type DeepSeekPayload = {
  question?: unknown;
  options?: unknown;
};

type DeepSeekOption = {
  id?: unknown;
  label?: unknown;
};

export async function generateDeepSeekOptions(
  input: GenerateDeepSeekOptionsInput,
): Promise<{ question: string; options: CareOption[]; model: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");

  const model = process.env.AI_OPTIONS_MODEL?.trim() || "deepseek-v4-flash";
  const endpoint = deepSeekEndpoint(process.env.DEEPSEEK_BASE_URL);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "你是住院患者脑控表达 Demo 的受控选项编辑器。",
              "只能使用用户提供的候选 id，不得新增、删除或修改医疗意图。",
              "可以调整三个候选项的顺序，并将 label 改写为清晰、无歧义、最多 12 个汉字的短语。",
              "不得给出诊断、治疗建议、药物建议或设备执行指令，不得生成返回或取消选项。",
              "只输出 json，格式为：{\"question\":\"一句简短引导语\",\"options\":[{\"id\":\"候选id\",\"label\":\"短标签\"}]}。",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              bed: input.bed,
              selectedPath: input.pathIntentCodes,
              defaultQuestion: input.question,
              candidates: input.options.map((option) => ({
                id: option.id,
                label: option.label,
                intentCode: option.intentCode,
              })),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek request failed with status ${response.status}`);
    }

    const result = await response.json() as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("DeepSeek returned empty content");
    }

    return {
      ...validatePayload(JSON.parse(content), input.question, input.options),
      model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function deepSeekEndpoint(baseUrlValue: string | undefined): string {
  const baseUrl = new URL(baseUrlValue?.trim() || "https://api.deepseek.com");
  if (baseUrl.protocol !== "https:" || baseUrl.hostname !== "api.deepseek.com") {
    throw new Error("DEEPSEEK_BASE_URL must use https://api.deepseek.com");
  }
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, "")}/chat/completions`;
  return baseUrl.toString();
}

function validatePayload(
  value: unknown,
  defaultQuestion: string,
  approvedOptions: CareOption[],
): { question: string; options: CareOption[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("DeepSeek response is not a JSON object");
  }

  const payload = value as DeepSeekPayload;
  const question = normalizeQuestion(payload.question, defaultQuestion);
  if (!Array.isArray(payload.options) || payload.options.length !== approvedOptions.length) {
    throw new Error("DeepSeek returned an invalid option count");
  }

  const approvedById = new Map(approvedOptions.map((option) => [option.id, option]));
  const seen = new Set<string>();
  const options = payload.options.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("DeepSeek returned an invalid option");
    }
    const generated = value as DeepSeekOption;
    const id = typeof generated.id === "string" ? generated.id.trim() : "";
    const label = typeof generated.label === "string" ? generated.label.trim() : "";
    const approved = approvedById.get(id);
    if (!approved || seen.has(id)) throw new Error("DeepSeek used an unapproved option id");
    if (!label || label.length > 12 || /返回|取消|执行|诊断|用药/.test(label)) {
      throw new Error("DeepSeek returned an unsafe option label");
    }
    seen.add(id);
    return { ...approved, label };
  });

  if (seen.size !== approvedOptions.length) {
    throw new Error("DeepSeek did not return every approved option");
  }
  return { question, options };
}

function normalizeQuestion(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const question = value.trim();
  if (!question || question.length > 30 || /诊断|用药|执行/.test(question)) return fallback;
  return question;
}
