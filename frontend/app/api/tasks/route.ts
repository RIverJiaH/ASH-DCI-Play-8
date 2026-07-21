import type { ConfidenceStep } from "../../../lib/brain-care";
import { brainCareStore } from "../../../lib/server/brain-care-store";
import { apiError, readJson } from "../_shared";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const task = brainCareStore.createTask(
      body.bed as string,
      body.steps as ConfidenceStep[],
    );
    return Response.json(
      { task, ...brainCareStore.snapshot() },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
