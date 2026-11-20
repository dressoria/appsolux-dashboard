import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { getFacturomAccess } from "@/lib/core/facturom-access";
import { getInvoiceJournal } from "@/lib/core/invoice-journal";

export async function GET(_request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  // Reuse the existing ERP read permission and product access policy, without changing plans.
  if (!hasPermission(user, "erp:read") || !getFacturomAccess().accounting) {
    return NextResponse.json({ message: "Tu acceso actual no permite consultar información contable." }, { status: 403 });
  }
  try {
    const { saleId } = await params;
    const entry = await getInvoiceJournal(tenant.id, saleId);
    if (entry === undefined) return NextResponse.json({ message: "Factura no encontrada." }, { status: 404 });
    return NextResponse.json({ entry }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "No se pudo consultar el asiento de esta factura." }, { status: 500 });
  }
}
