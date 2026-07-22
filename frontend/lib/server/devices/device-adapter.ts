export type DeviceCommand = {
  deviceId: string;
  action: string;
  parameters?: Record<string, string | number | boolean>;
};

export type DeviceActionResult = {
  commandId: string;
  status: "accepted" | "completed" | "failed";
  deviceState?: Record<string, unknown>;
};

export interface DeviceAdapter {
  readonly name: string;
  execute(command: DeviceCommand): Promise<DeviceActionResult>;
}

export class DisabledDeviceAdapter implements DeviceAdapter {
  readonly name = "disabled";

  async execute(): Promise<DeviceActionResult> {
    throw new Error("设备接入尚未启用");
  }
}

export const deviceAdapter: DeviceAdapter = new DisabledDeviceAdapter();
