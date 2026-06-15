import { NextResponse } from "next/server";

import { signInWithCurrentPassword } from "@/lib/auth/current-password-login";
import {
  getAppsoluxAuthProvider,
  shouldTryCurrentAuth,
  shouldTrySupabaseAuth,
} from "@/lib/auth/provider";
import { signInWithSupabasePassword } from "@/lib/auth/supabase-password-login";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = getStringField(body, "email").toLowerCase();
    const password = getStringField(body, "password");

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_LOGIN_INPUT",
            message: "Correo y contrasena son requeridos.",
          },
        },
        { status: 400 }
      );
    }

    const provider = getAppsoluxAuthProvider();

    if (shouldTrySupabaseAuth(provider)) {
      const supabaseResult = await signInWithSupabasePassword({
        email,
        password,
      });

      if (supabaseResult.ok) {
        return NextResponse.json({
          success: true,
          data: {
            redirect_to: supabaseResult.redirectTo,
          },
        });
      }
    }

    if (shouldTryCurrentAuth(provider)) {
      const currentResult = await signInWithCurrentPassword({
        email,
        password,
      });

      if (currentResult.ok) {
        return NextResponse.json({
          success: true,
          data: {
            redirect_to: currentResult.redirectTo,
          },
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: currentResult.code,
            message: currentResult.message,
          },
        },
        {
          status:
            currentResult.code === "INVALID_LOGIN_INPUT"
              ? 400
              : currentResult.code === "USER_NOT_ACTIVE" ||
                  currentResult.code === "NO_ACTIVE_MEMBERSHIP"
                ? 403
                : currentResult.code === "INVALID_CREDENTIALS"
                  ? 401
                  : 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Correo o contrasena incorrectos.",
        },
      },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "LOGIN_ERROR",
          message: "No pudimos iniciar sesion. Revisa la configuracion de la base central.",
        },
      },
      { status: 500 }
    );
  }
}
