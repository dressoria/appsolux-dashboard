import "@/lib/security/server-only";

import type { User as SupabaseAuthUser } from "@supabase/supabase-js";

import {
  getLoginUserByEmail,
  getLoginUserBySupabaseAuthUserId,
  type LoginUserRecord,
  linkUserToSupabaseAuthUserId,
  mapLoginUserToAppsoluxUser,
} from "@/lib/auth/persistent-user";
import { createSupabaseServerClient, hasSupabaseSessionCookies } from "@/lib/supabase/server";
import type { AppsoluxUser } from "@/types/user";

function normalizeEmail(email: string | null | undefined) {
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Supabase auth error";
}

function mapIfActive(user: LoginUserRecord | null) {
  if (!user || user.status !== "active") {
    return null;
  }

  return mapLoginUserToAppsoluxUser(user);
}

export async function resolveAppsoluxUserFromSupabaseIdentity(input: {
  supabaseAuthUserId: string;
  email?: string | null;
}): Promise<AppsoluxUser | null> {
  const linkedUser = await getLoginUserBySupabaseAuthUserId(input.supabaseAuthUserId);

  if (linkedUser) {
    return mapIfActive(linkedUser);
  }

  const normalizedEmail = normalizeEmail(input.email);

  if (!normalizedEmail) {
    return null;
  }

  const userByEmail = await getLoginUserByEmail(normalizedEmail);

  if (!userByEmail) {
    return null;
  }

  if (userByEmail.supabaseAuthUserId && userByEmail.supabaseAuthUserId !== input.supabaseAuthUserId) {
    console.warn("[auth] Supabase auth mapping conflict", {
      userId: userByEmail.id,
      email: normalizedEmail,
    });
    return null;
  }

  const linkedByEmail =
    userByEmail.supabaseAuthUserId === input.supabaseAuthUserId
      ? userByEmail
      : await linkUserToSupabaseAuthUserId({
          userId: userByEmail.id,
          supabaseAuthUserId: input.supabaseAuthUserId,
        });

  return mapIfActive(linkedByEmail);
}

export async function resolveAppsoluxUserFromSupabaseAuthUser(
  authUser: SupabaseAuthUser
) {
  return resolveAppsoluxUserFromSupabaseIdentity({
    supabaseAuthUserId: authUser.id,
    email: authUser.email,
  });
}

export async function resolveAppsoluxUserFromSupabase(): Promise<AppsoluxUser | null> {
  // Skip the Supabase API round-trip if there are no Supabase session cookies.
  // This prevents "Auth session missing!" noise on every request for users
  // authenticated via the current auth system.
  const hasCookies = await hasSupabaseSessionCookies();
  if (!hasCookies) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // "Auth session missing!" is the expected response when there is no active
      // Supabase session — it is not an error in dual mode.
      if (error.message !== "Auth session missing!") {
        console.warn("[auth] Failed to resolve Supabase session user", {
          message: error.message,
        });
      }
      return null;
    }

    if (!user) {
      return null;
    }

    return await resolveAppsoluxUserFromSupabaseAuthUser(user);
  } catch (error) {
    console.error("[auth] Failed to resolve Appsolux user from Supabase", {
      message: getSafeErrorMessage(error),
    });
    return null;
  }
}
