import { DomainError } from "../../lib/server/domain-error";

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DomainError("请求体必须是 JSON 对象");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("请求体不是有效 JSON");
  }
}

export function apiError(error: unknown): Response {
  if (error instanceof DomainError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  console.error("Unhandled Brain Care API error", error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "服务器处理失败" } },
    { status: 500 },
  );
}
