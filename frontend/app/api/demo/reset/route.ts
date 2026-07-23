import { brainCareStore } from "../../../../lib/server/brain-care-store";
import { bciInputStore } from "../../../../lib/server/bci-input-store";

export async function POST() {
  bciInputStore.reset();
  return Response.json(brainCareStore.reset());
}
