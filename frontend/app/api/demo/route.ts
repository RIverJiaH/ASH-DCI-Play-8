import { CONFIDENCE_THRESHOLDS } from "../../../lib/brain-care";
import { brainCareStore } from "../../../lib/server/brain-care-store";

export async function GET() {
  return Response.json({
    ...brainCareStore.snapshot(),
    thresholds: CONFIDENCE_THRESHOLDS,
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
