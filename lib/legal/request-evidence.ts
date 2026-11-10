import "@/lib/security/server-only";
import { isIP } from "node:net";
export function legalTechnicalEvidence(headers: Headers) {
  const days = Number(process.env.LEGAL_TECHNICAL_RETENTION_DAYS);
  if (!Number.isSafeInteger(days) || days <= 0 || days > 365) return undefined;
  const name = process.env.LEGAL_TRUSTED_CLIENT_IP_HEADER?.toLowerCase();
  const candidate = name && ["x-real-ip", "x-forwarded-for"].includes(name) ? headers.get(name)?.split(",")[0]?.trim() : undefined;
  return { ip: candidate && isIP(candidate) ? candidate : undefined, userAgent: headers.get("user-agent")?.slice(0, 200) };
}
