import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getTenantMemberships } from "@/lib/core/memberships";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const memberships = await getTenantMemberships(tenant.id);
  const members = memberships
    .filter((m) => m.status === "active" && m.user.status === "active")
    .map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
    }));
  return NextResponse.json({ ok: true, members });
}
