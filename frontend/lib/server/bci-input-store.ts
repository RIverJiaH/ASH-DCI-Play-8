import { DomainError } from "./domain-error";

export type BciBridgeStatus = {
  connected: boolean;
  source: string;
  streamName: string;
  state: "offline" | "searching" | "streaming" | "idle" | "target";
  channels: number[];
  frequencies: number[];
  sampleRate?: number;
  lastSeenAt?: string;
  lastFrequency?: number;
  lastConfidence?: number;
  detail?: string;
};

export type BciSelectionEvent = {
  id: number;
  targetIndex: number;
  confidence: number;
  frequency: number;
  rawScore: number;
  margin: number;
  stableCount: number;
  receivedAt: string;
};

type BciHeartbeatInput = {
  source?: unknown;
  streamName?: unknown;
  state?: unknown;
  channels?: unknown;
  frequencies?: unknown;
  sampleRate?: unknown;
  lastFrequency?: unknown;
  lastConfidence?: unknown;
  detail?: unknown;
};

type BciSelectionInput = BciHeartbeatInput & {
  targetIndex?: unknown;
  confidence?: unknown;
  frequency?: unknown;
  rawScore?: unknown;
  margin?: unknown;
  stableCount?: unknown;
};

const OFFLINE_AFTER_MS = 5_000;
const MAX_EVENTS = 32;

class BciInputStore {
  private nextId = 1;
  private events: BciSelectionEvent[] = [];
  private status: Omit<BciBridgeStatus, "connected"> = {
    source: "openbci_ssvep",
    streamName: "obci_eeg1",
    state: "offline",
    channels: [1, 3, 4],
    frequencies: [],
  };

  heartbeat(input: BciHeartbeatInput): BciBridgeStatus {
    this.updateStatus(input);
    return this.snapshot().status;
  }

  addSelection(input: BciSelectionInput): BciSelectionEvent {
    this.updateStatus({ ...input, state: "target" });

    const targetIndex = integerInRange(input.targetIndex, "targetIndex", 0, 3);
    const confidence = numberInRange(input.confidence, "confidence", 0, 1);
    const frequency = numberInRange(input.frequency, "frequency", 1, 60);
    const rawScore = numberInRange(input.rawScore, "rawScore", 0, 1);
    const margin = numberInRange(input.margin, "margin", 0, 1);
    const stableCount = integerInRange(input.stableCount, "stableCount", 1, 20);

    const event: BciSelectionEvent = {
      id: this.nextId++,
      targetIndex,
      confidence: round(confidence, 4),
      frequency: round(frequency, 3),
      rawScore: round(rawScore, 4),
      margin: round(margin, 4),
      stableCount,
      receivedAt: new Date().toISOString(),
    };

    this.status.lastFrequency = event.frequency;
    this.status.lastConfidence = event.confidence;
    this.events = [...this.events, event].slice(-MAX_EVENTS);
    return { ...event };
  }

  snapshot(after = 0): {
    cursor: number;
    status: BciBridgeStatus;
    events: BciSelectionEvent[];
  } {
    const lastSeen = this.status.lastSeenAt
      ? new Date(this.status.lastSeenAt).getTime()
      : 0;
    const connected = Date.now() - lastSeen <= OFFLINE_AFTER_MS;
    return {
      cursor: this.events.at(-1)?.id ?? 0,
      status: {
        ...this.status,
        connected,
        state: connected ? this.status.state : "offline",
        channels: [...this.status.channels],
        frequencies: [...this.status.frequencies],
      },
      events: this.events
        .filter((event) => event.id > after)
        .map((event) => ({ ...event })),
    };
  }

  reset() {
    this.nextId = 1;
    this.events = [];
    this.status = {
      source: "openbci_ssvep",
      streamName: "obci_eeg1",
      state: "offline",
      channels: [1, 3, 4],
      frequencies: [],
    };
  }

  private updateStatus(input: BciHeartbeatInput) {
    const state = optionalEnum(
      input.state,
      "state",
      ["searching", "streaming", "idle", "target"] as const,
    );
    const channels = optionalNumberList(input.channels, "channels", 1, 16, 1, 8, true);
    const frequencies = optionalNumberList(input.frequencies, "frequencies", 1, 60, 1, 4);
    const sampleRate = optionalNumber(input.sampleRate, "sampleRate", 1, 2_000);
    const lastFrequency = optionalNumber(input.lastFrequency, "lastFrequency", 1, 60);
    const lastConfidence = optionalNumber(input.lastConfidence, "lastConfidence", 0, 1);

    this.status = {
      ...this.status,
      source: optionalText(input.source, "source", 64) ?? this.status.source,
      streamName: optionalText(input.streamName, "streamName", 128) ?? this.status.streamName,
      state: state ?? this.status.state,
      channels: channels ?? this.status.channels,
      frequencies: frequencies ?? this.status.frequencies,
      sampleRate: sampleRate ?? this.status.sampleRate,
      lastFrequency: lastFrequency ?? this.status.lastFrequency,
      lastConfidence: lastConfidence ?? this.status.lastConfidence,
      detail: optionalText(input.detail, "detail", 160) ?? this.status.detail,
      lastSeenAt: new Date().toISOString(),
    };
  }
}

function optionalText(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new DomainError(`${field} 格式无效`);
  }
  return value.trim();
}

function optionalEnum<T extends readonly string[]>(
  value: unknown,
  field: string,
  values: T,
): T[number] | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !values.includes(value)) {
    throw new DomainError(`${field} 格式无效`);
  }
  return value as T[number];
}

function optionalNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
) {
  if (value === undefined || value === null) return undefined;
  return numberInRange(value, field, minimum, maximum);
}

function optionalNumberList(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  minLength: number,
  maxLength: number,
  integers = false,
) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length < minLength || value.length > maxLength) {
    throw new DomainError(`${field} 格式无效`);
  }
  return value.map((item, index) =>
    integers
      ? integerInRange(item, `${field}[${index}]`, minimum, maximum)
      : numberInRange(item, `${field}[${index}]`, minimum, maximum));
}

function numberInRange(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new DomainError(`${field} 必须在 ${minimum} 到 ${maximum} 之间`);
  }
  return value;
}

function integerInRange(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
) {
  const number = numberInRange(value, field, minimum, maximum);
  if (!Number.isInteger(number)) throw new DomainError(`${field} 必须是整数`);
  return number;
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

const globalBciStore = globalThis as typeof globalThis & {
  __brainCareBciInputStore?: BciInputStore;
};

export const bciInputStore = globalBciStore.__brainCareBciInputStore ??= new BciInputStore();
