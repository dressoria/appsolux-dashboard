import "@/lib/security/server-only";

import { isTenantAdmin } from "@/lib/auth/permissions";
import type { AppsoluxUser } from "@/types/user";

const bootstrapInternalAdminEmails = ["131studio.ec@gmail.com"];

function getAllowedEmails() {
  return (process.env.APPSOLUX_INTERNAL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isInternalAdmin(user: AppsoluxUser) {
  const normalizedEmail = user.email.trim().toLowerCase();
  const allowedEmails = getAllowedEmails();
  const isTenantLevelAdmin = isTenantAdmin(user);

  if (allowedEmails.includes(normalizedEmail)) {
    return true;
  }

  if (
    bootstrapInternalAdminEmails.includes(normalizedEmail) &&
    isTenantLevelAdmin
  ) {
    return true;
  }

  return process.env.NODE_ENV !== "production" && isTenantLevelAdmin;
}

export function assertInternalAdmin(user: AppsoluxUser) {
  if (!isInternalAdmin(user)) {
    throw new Error("Admin interno requerido.");
  }
}
