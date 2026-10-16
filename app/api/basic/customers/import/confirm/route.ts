import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { processImportRows, type CustomerImportRow, type ImportPreviewRow } from "@/lib/core/customer-import";
import { validateCustomerIdentification, normalizeCustomerIdentification } from "@/lib/core/customer-fiscal";
import { getPrismaClient } from "@/lib/db/prisma";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getLimit } from "@/lib/core/plans";
import { isUnlimitedCommercialVolume } from "@/lib/core/billing-access-policy";
import { requireTenantOperationalAccess } from "@/lib/core/tenant-operational-access";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
    const tenant = await getCurrentTenant(user);
    await requireTenantOperationalAccess(tenant.id);

    const body = (await request.json()) as { rows?: ImportPreviewRow[] };
    const submitted = body.rows;
    if (!Array.isArray(submitted) || submitted.length === 0)
      return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });

    const selected = submitted.filter((r) => r.selectedForImport && r.status !== "EXCLUDED" && r.status !== "SKIP_EXISTING" && r.status !== "SKIP_DUPLICATE_FILE");
    if (selected.length === 0)
      return NextResponse.json({ message: "No hay filas seleccionadas para importar." }, { status: 400 });

    const prisma = getPrismaClient();

    const existingRecords = await prisma.lightweightCustomer.findMany({
      where: { tenantId: tenant.id, identification: { not: null } },
      select: { identification: true },
    });
    const existingSet = new Set(existingRecords.flatMap((item) => (item.identification ? [item.identification] : [])));

    const rawRows: CustomerImportRow[] = selected.map((r) => r.data);
    const revalidated = processImportRows(rawRows, existingSet);

    const hasBlockingErrors = revalidated.rows.some((r) => r.status === "NEEDS_REVIEW");
    if (hasBlockingErrors) {
      const errorRows = revalidated.rows
        .filter((r) => r.status === "NEEDS_REVIEW")
        .map((r) => ({ rowNumber: r.rowNumber, issues: r.issues }));
      return NextResponse.json({ message: "Algunas filas tienen errores que deben corregirse.", errorRows }, { status: 422 });
    }

    const toImport = revalidated.rows.filter((r) => r.status === "READY");
    if (toImport.length === 0)
      return NextResponse.json({
        ok: true,
        imported: 0,
        skippedExisting: revalidated.counts.skipExisting,
        skippedDuplicateFile: revalidated.counts.skipDuplicateFile,
        failed: 0,
      });

    if (!isUnlimitedCommercialVolume("customers")) {
      const currentCount = await prisma.lightweightCustomer.count({ where: { tenantId: tenant.id } });
      const limit = await getLimit(tenant.id, "customers");
      if (currentCount + toImport.length > limit) {
        return NextResponse.json({
          message: `El plan permite ${limit} clientes. Actualmente tienes ${currentCount} y quieres importar ${toImport.length}. Reduce la cantidad o actualiza tu plan.`,
        }, { status: 400 });
      }
    }

    const createData = toImport.map((row) => {
      const d = row.data;
      const type = d.identificationType as "RUC" | "CEDULA" | "PASSPORT" | "FOREIGN_ID";
      let identification: string | null = null;
      try {
        identification = normalizeCustomerIdentification(type, validateCustomerIdentification(type, d.identification));
      } catch {
        identification = d.identification || null;
      }

      return {
        tenantId: tenant.id,
        name: d.name,
        tradeName: d.tradeName || undefined,
        email: d.email || undefined,
        phone: d.phone || undefined,
        address: d.address || undefined,
        country: d.country || "Ecuador",
        province: d.province || undefined,
        city: d.city || undefined,
        parish: d.parish || undefined,
        sector: d.sector || undefined,
        zone: d.zone || undefined,
        customerType: d.customerType || undefined,
        customerOrigin: d.customerOrigin || undefined,
        groupName: d.groupName || undefined,
        notes: d.notes || undefined,
        identificationType: type,
        identification,
      };
    });

    let imported = 0;
    let skippedExisting = revalidated.counts.skipExisting;

    await prisma.$transaction(async (tx) => {
      for (const data of createData) {
        if (data.identification) {
          const exists = await tx.lightweightCustomer.findFirst({
            where: { tenantId: tenant.id, identification: data.identification },
            select: { id: true },
          });
          if (exists) {
            skippedExisting++;
            continue;
          }
        }
        await tx.lightweightCustomer.create({ data });
        imported++;
      }
    });

    return NextResponse.json({
      ok: true,
      imported,
      skippedExisting,
      skippedDuplicateFile: revalidated.counts.skipDuplicateFile,
      failed: 0,
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "No se pudo importar." }, { status: 400 });
  }
}
