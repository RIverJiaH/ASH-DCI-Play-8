import { apiError, readJson } from "../../_shared";
import { brainCareStore, type BrainInput } from "../../../../lib/server/brain-care-store";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const input = {
      bed: body.bed,
      stage: body.stage,
      label: body.label,
      value: body.value,
      confidence: body.confidence,
      confirmed: body.confirmed,
      selections: body.selections,
    } as BrainInput;
    const result = brainCareStore.evaluateInput(input);
    return Response.json({ ...result, events: brainCareStore.snapshot().events });
  } catch (error) {
    return apiError(error);
  }
}
