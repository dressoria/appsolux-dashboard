import "@/lib/security/server-only";
import { demoUser } from "./demo-user";
import type { AppsoluxUser } from "@/types/user";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isDemoSessionEnabled() {
  if (isProduction()) {
    return false;
  }

  const explicitValue = process.env.APPSOLUX_ENABLE_DEV_SESSION?.trim().toLowerCase();

  if (explicitValue === "true") {
    return true;
  }

  if (explicitValue === "false") {
    return false;
  }

  return (
    process.env.APP_ENV === "development" ||
    process.env.NODE_ENV === "development"
  );
}

export async function getDevSessionUser(): Promise<AppsoluxUser | null> {
  if (!isDemoSessionEnabled()) {
    return null;
  }

  return demoUser;
}
