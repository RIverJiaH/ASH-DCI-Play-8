import { brainCareStore } from "../../../../lib/server/brain-care-store";

export async function POST() {
  return Response.json(brainCareStore.reset());
}
