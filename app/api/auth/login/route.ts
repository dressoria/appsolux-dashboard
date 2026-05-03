import { NextResponse } from "next/server";
import { getLoginUserByEmail } from "@/lib/auth/persistent-user";
import { verifyPassword } from "@/lib/auth/password";
import { setAuthSession } from "@/lib/auth/session";

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

    const user = await getLoginUserByEmail(email);

    if (!user || !user.passwordHash) {
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
    }

    if (user.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_NOT_ACTIVE",
            message: "Tu usuario no esta activo.",
          },
        },
        { status: 403 }
      );
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
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
    }

    const membership = user.memberships[0];

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_ACTIVE_MEMBERSHIP",
            message: "Tu usuario no tiene una empresa activa asignada.",
          },
        },
        { status: 403 }
      );
    }

    await setAuthSession({
      userId: user.id,
      tenantId: membership.tenantId,
    });

    return NextResponse.json({
      success: true,
      data: {
        redirect_to: "/dashboard",
      },
    });
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
