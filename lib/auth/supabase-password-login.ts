import "@/lib/security/server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { resolveAppsoluxUserFromSupabaseAuthUser } from "@/lib/auth/resolve-appsolux-user-from-supabase";
import { setAuthSession } from "@/lib/auth/session";

export type SupabasePasswordLoginResult =
  | { ok: true; redirectTo: string }
  | {
      ok: false;
      code:
        | "SUPABASE_NOT_CONFIGURED"
        | "INVALID_LOGIN_INPUT"
        | "INVALID_CREDENTIALS"
        | "NO_INTERNAL_USER"
        | "LOGIN_ERROR";
      message: string;
    };

export async function signInWithSupabasePassword(input: {
  email: string;
  password: string;
}): Promise<SupabasePasswordLoginResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return {
      ok: false,
      code: "INVALID_LOGIN_INPUT",
      message: "Correo y contrasena son requeridos.",
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: "SUPABASE_NOT_CONFIGURED",
      message: "Supabase Auth no esta configurado.",
    };
  }

  const supabase = await createSupabaseServerClient({ writable: true });

  if (!supabase) {
    return {
      ok: false,
      code: "SUPABASE_NOT_CONFIGURED",
      message: "Supabase Auth no esta configurado.",
    };
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !user) {
      return {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "Correo o contrasena incorrectos.",
      };
    }

    const appsoluxUser = await resolveAppsoluxUserFromSupabaseAuthUser(user);

    if (!appsoluxUser) {
      await supabase.auth.signOut();

      return {
        ok: false,
        code: "NO_INTERNAL_USER",
        message: "Tu usuario de Supabase no esta vinculado a una cuenta interna valida.",
      };
    }

    if (!appsoluxUser.tenant?.id) {
      console.info("[auth] Supabase login resolved user without tenant", {
        userId: appsoluxUser.id,
        email: appsoluxUser.email.includes("@")
          ? `${appsoluxUser.email.slice(0, 2)}***@${appsoluxUser.email.split("@")[1]}`
          : "unknown",
        redirectTo: "/onboarding",
      });

      return {
        ok: true,
        redirectTo: "/onboarding",
      };
    }

    await setAuthSession({
      userId: appsoluxUser.id,
      tenantId: appsoluxUser.tenant.id,
    });

    return {
      ok: true,
      redirectTo: "/workspace",
    };
  } catch (error) {
    console.error("[auth] Supabase password login failed", {
      message: error instanceof Error ? error.message : "Unknown Supabase login error",
    });

    return {
      ok: false,
      code: "LOGIN_ERROR",
      message: "No pudimos iniciar sesion con Supabase Auth.",
    };
  }
}
