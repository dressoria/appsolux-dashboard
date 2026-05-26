import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  createSriEstablishment,
  getSriProfile,
  listSriEstablishments,
  validateThreeDigitCode,
} from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const establishments = await listSriEstablishments(tenant.id);
  return NextResponse.json({ establishments });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const code = typeof data.code === "string" ? data.code.trim() : "";
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const address = typeof data.address === "string" ? data.address.trim() : "";

  if (!validateThreeDigitCode(code)) {
    return NextResponse.json({ error: "El codigo debe tener 3 digitos." }, { status: 422 });
  }
  if (!name) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 422 });
  if (!address) return NextResponse.json({ error: "La direccion es obligatoria." }, { status: 422 });

  // Resolve profile from tenant, never trust profileId from body
  const profile = await getSriProfile(tenant.id);
  if (!profile) {
    return NextResponse.json(
      { error: "Configura primero la empresa y RUC antes de agregar establecimientos." },
      { status: 422 }
    );
  }

  try {
    const establishment = await createSriEstablishment(tenant.id, profile.id, {
      code,
      name,
      address,
      isMain: data.isMain === true || data.isMain === "true",
    });
    return NextResponse.json({ establishment }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "El codigo ya existe en este tenant. Usa un codigo diferente." },
      { status: 409 }
    );
  }
}
