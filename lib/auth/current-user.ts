import "@/lib/security/server-only";
import type { AppsoluxUser } from "@/types/user";

export async function getCurrentUser(): Promise<AppsoluxUser | null> {
  // TODO: Replace this mock with real auth/session logic.
  return null;
}