import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { generatePdfTable } from "@/lib/core/pdf-table";

const BRAND_HEX = "1E52F1";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  const status = params.get("status");
  const type = params.get("type");
  const origin = params.get("origin");

  const prisma = getPrismaClient();
  const suppliers = await prisma.lightweightSupplier.findMany({
    where: {
      tenantId: tenant.id,
      ...(status ? { isActive: status === "active" } : {}),
      ...(type ? { supplierType: type } : {}),
      ...(origin ? { supplierOrigin: origin } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { tradeName: { contains: q, mode: "insensitive" as const } },
              { identification: { contains: q } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  const buyerIds = [
    ...new Set(
      suppliers
        .map((s) => s.assignedBuyerId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const buyerUsers =
    buyerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: buyerIds } },
          select: { id: true, name: true },
        })
      : [];
  const buyerMap = new Map(buyerUsers.map((u) => [u.id, u.name ?? "—"]));

  const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "short" });

  if (params.get("format") === "pdf") {
    const rows = suppliers.map((s) => ({
      type: s.identificationType ?? "—",
      identification: s.identification ?? "—",
      name: s.tradeName ? `${s.name}\n${s.tradeName}` : s.name,
      origin: s.supplierOrigin ?? "—",
      email: s.email ?? "—",
      phone: s.phone ?? "—",
      address: s.address ?? "—",
      location: [s.city, s.province].filter(Boolean).join(", ") || "—",
      buyer: s.assignedBuyerId
        ? (buyerMap.get(s.assignedBuyerId) ?? "—")
        : "—",
      createdAt: dateFormatter.format(s.createdAt),
      status: s.isActive ? "Activo" : "Inactivo",
    }));

    const pdfBytes = await generatePdfTable({
      title: "LISTA DE PROVEEDORES",
      subtitle: `${tenant.name} — Generado ${dateFormatter.format(new Date())}`,
      landscape: true,
      columns: [
        { header: "Tipo", key: "type", width: 55 },
        { header: "Identificación", key: "identification", width: 75 },
        { header: "Nombre / Razón social", key: "name", width: 130 },
        { header: "Origen", key: "origin", width: 50 },
        { header: "Email", key: "email", width: 100 },
        { header: "Teléfono", key: "phone", width: 65 },
        { header: "Ubicación", key: "location", width: 80 },
        { header: "Comprador", key: "buyer", width: 70 },
        { header: "Registro", key: "createdAt", width: 55 },
        { header: "Estado", key: "status", width: 40 },
      ],
      rows,
    });

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="proveedores.pdf"',
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Proveedores");
  sheet.columns = [
    { header: "Tipo", key: "type", width: 18 },
    { header: "Identificación", key: "identification", width: 20 },
    { header: "Razón social / Nombre", key: "name", width: 34 },
    { header: "Nombre comercial", key: "tradeName", width: 28 },
    { header: "Origen", key: "origin", width: 18 },
    { header: "Email", key: "email", width: 28 },
    { header: "Teléfono", key: "phone", width: 20 },
    { header: "Dirección", key: "address", width: 35 },
    { header: "Provincia", key: "province", width: 18 },
    { header: "Ciudad", key: "city", width: 18 },
    { header: "Comprador", key: "buyer", width: 22 },
    { header: "Registro", key: "createdAt", width: 16 },
    { header: "Estado", key: "status", width: 12 },
  ];

  for (const s of suppliers) {
    sheet.addRow({
      type: s.identificationType,
      identification: s.identification,
      name: s.name,
      tradeName: s.tradeName,
      origin: s.supplierOrigin,
      email: s.email,
      phone: s.phone,
      address: s.address,
      province: s.province,
      city: s.city,
      buyer: s.assignedBuyerId
        ? (buyerMap.get(s.assignedBuyerId) ?? "—")
        : "",
      createdAt: dateFormatter.format(s.createdAt),
      status: s.isActive ? "Activo" : "Inactivo",
    });
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${BRAND_HEX}` },
  };
  headerRow.alignment = { vertical: "middle" };

  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  for (let i = 2; i <= suppliers.length + 1; i++) {
    if (i % 2 === 0) {
      const row = sheet.getRow(i);
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F4FF" },
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(Buffer.from(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="proveedores.xlsx"',
    },
  });
}
