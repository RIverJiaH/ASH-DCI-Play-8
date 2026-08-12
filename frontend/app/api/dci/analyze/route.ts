import { apiError, readJson } from "../../_shared";
import { analyzeDciCase } from "../../../../lib/server/dci-agent-service";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return Response.json(await analyzeDciCase(body.bed));
  } catch (error) {
    return apiError(error);
  }
}
