import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { generatePdfTable } from "@/lib/core/pdf-table";

const BRAND_HEX = "1E52F1";

function resolveUserNames(
  ids: (string | null)[],
  users: { id: string; name: string | null }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const user of users) {
    map.set(user.id, user.name ?? "—");
  }
  return map;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  const type = params.get("type");
  const status = params.get("status");
  const origin = params.get("origin");
  const province = params.get("province");
  const city = params.get("city");
  const date = params.get("date");
  const dayStart = date ? new Date(`${date}T00:00:00`) : null;
  const dayEnd = dayStart ? new Date(dayStart.getTime() + 86400000) : null;

  const prisma = getPrismaClient();
  const customers = await prisma.lightweightCustomer.findMany({
    where: {
      tenantId: tenant.id,
      ...(type ? { identificationType: type as never } : {}),
      ...(status ? { isActive: status === "active" } : {}),
      ...(origin ? { customerOrigin: origin } : {}),
      ...(province ? { province } : {}),
      ...(city ? { city } : {}),
      ...(dayStart && dayEnd
        ? { createdAt: { gte: dayStart, lt: dayEnd } }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { tradeName: { contains: q, mode: "insensitive" as const } },
              { identification: { contains: q } },
              { email: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  const sellerIds = [
    ...new Set(
      customers
        .map((c) => c.assignedSellerId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const sellerUsers =
    sellerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: sellerIds } },
          select: { id: true, name: true },
        })
      : [];
  const sellerMap = resolveUserNames(sellerIds, sellerUsers);

  const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "short" });

  if (params.get("format") === "pdf") {
    const rows = customers.map((c) => ({
      type: c.identificationType ?? "—",
      identification: c.identification ?? "—",
      name: c.tradeName ? `${c.name}\n${c.tradeName}` : c.name,
      origin: c.customerOrigin ?? "—",
      email: c.email ?? "—",
      phone: c.phone ?? "—",
      address: c.address ?? "—",
      createdAt: dateFormatter.format(c.createdAt),
      location: [c.city, c.province].filter(Boolean).join(", ") || "—",
      seller: c.assignedSellerId
        ? (sellerMap.get(c.assignedSellerId) ?? "—")
        : "—",
      status: c.isActive ? "Activo" : "Inactivo",
    }));

    const pdfBytes = await generatePdfTable({
      title: "LISTA DE CLIENTES",
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
        { header: "Vendedor", key: "seller", width: 70 },
        { header: "Registro", key: "createdAt", width: 55 },
        { header: "Estado", key: "status", width: 40 },
      ],
      rows,
    });

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="clientes.pdf"',
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Clientes");
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
    { header: "Vendedor", key: "seller", width: 22 },
    { header: "Registro", key: "createdAt", width: 16 },
    { header: "Estado", key: "status", width: 12 },
  ];

  for (const c of customers) {
    sheet.addRow({
      type: c.identificationType,
      identification: c.identification,
      name: c.name,
      tradeName: c.tradeName,
      origin: c.customerOrigin,
      email: c.email,
      phone: c.phone,
      address: c.address,
      province: c.province,
      city: c.city,
      seller: c.assignedSellerId
        ? (sellerMap.get(c.assignedSellerId) ?? "—")
        : "",
      createdAt: dateFormatter.format(c.createdAt),
      status: c.isActive ? "Activo" : "Inactivo",
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

  for (let i = 2; i <= customers.length + 1; i++) {
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
      "Content-Disposition": 'attachment; filename="clientes.xlsx"',
    },
  });
}
