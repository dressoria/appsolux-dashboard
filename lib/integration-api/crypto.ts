import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function generateApiKey() {
  const keyPrefix = `ftm_${randomBytes(9).toString("hex")}`;
  const secret = `${keyPrefix}_${randomBytes(32).toString("hex")}`;
  return { secret, keyPrefix, keyHash: digest(secret) };
}
export function validApiKey(value: string) { return /^ftm_[a-f0-9]{18}_[a-f0-9]{64}$/.test(value); }
export function matchesHash(value: string, hash: string) {
  return /^[a-f0-9]{64}$/.test(hash) && timingSafeEqual(Buffer.from(digest(value), "hex"), Buffer.from(hash, "hex"));
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
