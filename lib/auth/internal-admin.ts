import "@/lib/security/server-only";

import type { AppsoluxUser } from "@/types/user";

function getAllowedEmails() {
  return (process.env.APPSOLUX_INTERNAL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isInternalAdmin(user: AppsoluxUser) {
  const normalizedEmail = user.email.trim().toLowerCase();
  const allowedEmails = getAllowedEmails();
  return allowedEmails.includes(normalizedEmail);
}

export function assertInternalAdmin(user: AppsoluxUser) {
  if (!isInternalAdmin(user)) {
    throw new Error("Admin interno requerido.");
  }
}
