export type DevicePolicy = {
  mode: "request_only" | "direct_control";
  requiresHumanApproval: boolean;
};

export function policyForIntent(intentCode: string): DevicePolicy {
  if (intentCode.startsWith("environment.")) {
    return { mode: "request_only", requiresHumanApproval: true };
  }
  return { mode: "request_only", requiresHumanApproval: true };
}
