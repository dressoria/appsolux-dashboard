import "@/lib/security/server-only";
import { getDevSessionUser } from "./dev-session";
import { getPersistentUserFromSession } from "./persistent-user";
import {
  getAppsoluxAuthProvider,
  isClerkAuth,
  shouldTryCurrentAuth,
  shouldTrySupabaseAuth,
} from "./provider";
import { resolveAppsoluxUserFromSupabase } from "./resolve-appsolux-user-from-supabase";
import { getSessionPayload } from "./session";
import { getAppUser } from "./require-app-user";
import type { AppsoluxUser } from "@/types/user";

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown auth session error";
}

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
  } catch (error) {
    console.error("[auth] Failed to resolve persistent session user", {
      userId: session.userId,
      tenantId: session.tenantId,
      message: getSafeErrorMessage(error),
    });
    return null;
  }
}

export async function getCurrentUser(): Promise<AppsoluxUser | null> {
  const provider = getAppsoluxAuthProvider();

  if (isClerkAuth(provider)) {
    return getAppUser();
  }

  if (shouldTrySupabaseAuth(provider)) {
    const supabaseUser = await resolveAppsoluxUserFromSupabase();

    if (supabaseUser) {
      return supabaseUser;
    }
  }

  if (shouldTryCurrentAuth(provider)) {
    const realUser = await getCurrentUserFromRealSession();

    if (realUser) {
      return realUser;
    }

    return getDevSessionUser();
  }

  return null;
}

export async function requireCurrentUser(): Promise<AppsoluxUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Sesion requerida.");
  }

  return user;
}
