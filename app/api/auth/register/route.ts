import { NextResponse } from "next/server";
import { registerTenantViaN8n } from "@/lib/api/n8n/provision";
import type { N8nRegisterPayload } from "@/types/n8n";

function validateRegisterPayload(body: unknown): N8nRegisterPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const data = body as Partial<N8nRegisterPayload>;

  if (!data.name || typeof data.name !== "string") {
    throw new Error("Name is required");
  }

  if (!data.email || typeof data.email !== "string") {
    throw new Error("Email is required");
  }

  if (!data.company || typeof data.company !== "string") {
    throw new Error("Company is required");
  }

  return {
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    company: data.company.trim(),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = validateRegisterPayload(body);

    const result = await registerTenantViaN8n(payload);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "N8N_REGISTER_FAILED",
            message: result.error ?? "Registration failed",
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.user,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected registration error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "REGISTER_ERROR",
          message,
        },
      },
      { status: 400 }
    );
  }
}