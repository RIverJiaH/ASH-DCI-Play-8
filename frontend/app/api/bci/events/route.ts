import { apiError, readJson } from "../../_shared";
import { bciInputStore } from "../../../../lib/server/bci-input-store";
import { DomainError } from "../../../../lib/server/domain-error";

export async function GET(request: Request) {
  try {
    const afterValue = new URL(request.url).searchParams.get("after") ?? "0";
    const after = Number(afterValue);
    if (!Number.isInteger(after) || after < 0) {
      throw new DomainError("after 必须是非负整数");
    }
    return Response.json(bciInputStore.snapshot(after));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertLocalBridge(request);
    const body = await readJson(request);
    const type = body.type;
    if (type === "heartbeat") {
      return Response.json({ status: bciInputStore.heartbeat(body) });
    }
    if (type === "selection") {
      return Response.json(
        { event: bciInputStore.addSelection(body), status: bciInputStore.snapshot().status },
        { status: 201 },
      );
    }
    throw new DomainError("type 必须是 heartbeat 或 selection");
  } catch (error) {
    return apiError(error);
  }
}

function assertLocalBridge(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const isLoopback = hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "[::1]"
    || hostname === "::1";
  if (!isLoopback || forwardedFor) {
    throw new DomainError("脑机事件只允许本机桥接器提交", 403, "BCI_LOCAL_ONLY");
  }
}
