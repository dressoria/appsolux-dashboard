import "@/lib/security/server-only";

export type NormalizedEvolutionWebhookEvent = {
  instanceName?: string;
  eventType?: string;
  remoteJid?: string;
  phone?: string;
  pushName?: string;
  text?: string;
  timestamp?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function findNestedString(
  record: Record<string, unknown>,
  path: string[]
): string | undefined {
  let current: unknown = record;

  for (const key of path) {
    if (!isObject(current)) {
      return undefined;
    }

    current = current[key];
  }

  return getString(current);
}

function getTextFromMessage(record: Record<string, unknown>) {
  return (
    findNestedString(record, ["data", "message", "conversation"]) ??
    findNestedString(record, [
      "data",
      "message",
      "extendedTextMessage",
      "text",
    ]) ??
    findNestedString(record, ["message", "conversation"]) ??
    findNestedString(record, ["message", "extendedTextMessage", "text"]) ??
    getString(record.text)
  );
}

export function normalizeEvolutionWebhookEvent(
  payload: unknown
): NormalizedEvolutionWebhookEvent {
  if (!isObject(payload)) {
    return {};
  }

  const instanceName =
    getString(payload.instance) ??
    getString(payload.instanceName) ??
    findNestedString(payload, ["data", "instance"]) ??
    findNestedString(payload, ["instance", "instanceName"]);
  const remoteJid =
    findNestedString(payload, ["data", "key", "remoteJid"]) ??
    findNestedString(payload, ["key", "remoteJid"]) ??
    getString(payload.remoteJid);
  const phone = remoteJid?.split("@")[0];

  return {
    instanceName,
    eventType:
      getString(payload.event) ??
      getString(payload.eventType) ??
      getString(payload.type),
    remoteJid,
    phone,
    pushName:
      findNestedString(payload, ["data", "pushName"]) ??
      getString(payload.pushName),
    text: getTextFromMessage(payload),
    timestamp:
      getNumber(payload.date_time) ??
      getNumber(payload.timestamp) ??
      getNumber(payload.messageTimestamp),
  };
}
