import type { OptionSelectionRef } from "../../../../lib/brain-care";
import { generateAiOptionSet } from "../../../../lib/server/ai-option-service";
import { apiError, readJson } from "../../_shared";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const optionSet = await generateAiOptionSet({
      sessionId: body.sessionId as string,
      bed: body.bed as string,
      stage: body.stage as 1 | 2,
      selections: body.selections as OptionSelectionRef[],
    });
    return Response.json(optionSet, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
