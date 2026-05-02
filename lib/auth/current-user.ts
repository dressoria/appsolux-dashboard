import "@/lib/security/server-only";
import { demoUser } from "./demo-user";
import type { AppsoluxUser } from "@/types/user";

export async function getCurrentUser(): Promise<AppsoluxUser | null> {
  // TODO: Replace this demo user with real auth/session logic.
  // Development only: allows us to test multitenant flows safely.
  if (process.env.APP_ENV === "development") {
    return demoUser;
  }

  return null;
}