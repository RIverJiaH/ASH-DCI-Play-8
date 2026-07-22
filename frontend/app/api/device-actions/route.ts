import { apiError, readJson } from "../_shared";
import { deviceAdapter } from "../../../lib/server/devices/device-adapter";
import { policyForIntent } from "../../../lib/server/devices/device-policy";
import { DomainError } from "../../../lib/server/domain-error";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const intentCode = typeof body.intentCode === "string" ? body.intentCode : "";
    const policy = policyForIntent(intentCode);
    if (deviceAdapter.name === "disabled") {
      throw new DomainError(
        "设备接入尚未启用，当前仅生成护理请求",
        501,
        "DEVICE_INTEGRATION_DISABLED",
      );
    }
    if (policy.mode !== "direct_control") {
      throw new DomainError("当前动作只允许生成护理请求", 403, "REQUEST_ONLY_ACTION");
    }
    const result = await deviceAdapter.execute({
      deviceId: body.deviceId as string,
      action: body.action as string,
      parameters: body.parameters as Record<string, string | number | boolean> | undefined,
    });
    return Response.json(result, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
