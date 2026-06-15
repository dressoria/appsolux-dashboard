import "@/lib/security/server-only";

import { getLoginUserByEmail } from "@/lib/auth/persistent-user";
import { verifyPassword } from "@/lib/auth/password";
import { setAuthSession } from "@/lib/auth/session";

export type CurrentPasswordLoginResult =
  | { ok: true; redirectTo: string }
  | {
      ok: false;
      code:
        | "INVALID_LOGIN_INPUT"
        | "INVALID_CREDENTIALS"
        | "USER_NOT_ACTIVE"
        | "NO_ACTIVE_MEMBERSHIP"
        | "LOGIN_ERROR";
      message: string;
    };

export async function signInWithCurrentPassword(input: {
  email: string;
  password: string;
}): Promise<CurrentPasswordLoginResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return {
      ok: false,
      code: "INVALID_LOGIN_INPUT",
      message: "Correo y contrasena son requeridos.",
    };
  }

  try {
    const user = await getLoginUserByEmail(email);

    if (!user || !user.passwordHash) {
      return {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "Correo o contrasena incorrectos.",
      };
    }

    if (user.status !== "active") {
      return {
        ok: false,
        code: "USER_NOT_ACTIVE",
        message: "Tu usuario no esta activo.",
      };
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      return {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "Correo o contrasena incorrectos.",
      };
    }

    const membership = user.memberships[0];

    if (!membership) {
      return {
        ok: false,
        code: "NO_ACTIVE_MEMBERSHIP",
        message: "Tu usuario no tiene una empresa activa asignada.",
      };
    }

    await setAuthSession({
      userId: user.id,
      tenantId: membership.tenantId,
    });

    return {
      ok: true,
      redirectTo: "/workspace",
    };
  } catch {
    return {
      ok: false,
      code: "LOGIN_ERROR",
      message: "No pudimos iniciar sesion. Revisa la configuracion de la base central.",
    };
  }
}
