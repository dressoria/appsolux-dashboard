import "@/lib/security/server-only";

import { isTenantAdmin } from "@/lib/auth/permissions";
import type { AppsoluxUser } from "@/types/user";

function getAllowedEmails() {
  return (process.env.APPSOLUX_INTERNAL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isInternalAdmin(user: AppsoluxUser) {
  const allowedEmails = getAllowedEmails();

  if (allowedEmails.length > 0) {
    return allowedEmails.includes(user.email.toLowerCase());
  }

  return process.env.NODE_ENV !== "production" && isTenantAdmin(user);
}

export function assertInternalAdmin(user: AppsoluxUser) {
  if (!isInternalAdmin(user)) {
    throw new Error("Admin interno requerido.");
  }
}
