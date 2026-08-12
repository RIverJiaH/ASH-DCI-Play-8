import { apiError, readJson } from "../_shared";
import { dciDemoStore } from "../../../lib/server/dci-demo-store";

export async function GET() {
  return Response.json(dciDemoStore.snapshot(), { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}

export async function PATCH(request: Request) {
  try {
    const body = await readJson(request);
    const result = dciDemoStore.update(body.bed, body.action, body.review);
    return Response.json({ ...dciDemoStore.snapshot(), case: result });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  return Response.json(dciDemoStore.reset());
}
