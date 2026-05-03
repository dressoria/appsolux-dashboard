import "@/lib/security/server-only";
import { getDevSessionUser } from "./dev-session";
import type { AppsoluxUser } from "@/types/user";

async function getCurrentUserFromRealSession(): Promise<AppsoluxUser | null> {
  // Auth adapter placeholder.
  // Fase 14 can replace this with Auth.js, Supabase, Clerk or a first-party DB.
  return null;
}

export async function getCurrentUser(): Promise<AppsoluxUser | null> {
  const realUser = await getCurrentUserFromRealSession();

  if (realUser) {
    return realUser;
  }

  return getDevSessionUser();
}

export async function requireCurrentUser(): Promise<AppsoluxUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Sesion requerida.");
  }

  return user;
}
