import "@/lib/security/server-only";
import { getDevSessionUser } from "./dev-session";
import { getPersistentUserFromSession } from "./persistent-user";
import { getSessionPayload } from "./session";
import type { AppsoluxUser } from "@/types/user";

async function getCurrentUserFromRealSession(): Promise<AppsoluxUser | null> {
  const session = await getSessionPayload();

  if (!session) {
    return null;
  }

  try {
    return await getPersistentUserFromSession({
      userId: session.userId,
      tenantId: session.tenantId,
    });
  } catch {
    return null;
  }
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
