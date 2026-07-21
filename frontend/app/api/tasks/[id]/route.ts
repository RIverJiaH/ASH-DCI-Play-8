import { brainCareStore, parseTaskAction } from "../../../../lib/server/brain-care-store";
import { apiError, readJson } from "../../_shared";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const [{ id }, body] = await Promise.all([context.params, readJson(request)]);
    const task = brainCareStore.updateTask(id, parseTaskAction(body.action));
    return Response.json({ task, ...brainCareStore.snapshot() });
  } catch (error) {
    return apiError(error);
  }
}
