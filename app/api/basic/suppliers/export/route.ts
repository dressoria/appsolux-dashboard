import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  supplierExportRow,
  supplierPdfLine,
} from "@/lib/core/lightweight-supplier-utils";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  const status = params.get("status");
  const type = params.get("type");
  const suppliers = await getPrismaClient().lightweightSupplier.findMany({
    where: {
      tenantId: tenant.id,
      ...(status ? { isActive: status === "active" } : {}),
      ...(type ? { supplierType: type } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { tradeName: { contains: q, mode: "insensitive" } },
              { identification: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
  if (params.get("format") === "pdf") {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([842, 595]);
    let y = 555;
    page.drawText("Proveedores", {
      x: 35,
      y,
      size: 16,
      font: bold,
      color: rgb(0.12, 0.32, 0.95),
    });
    y -= 28;
    suppliers.forEach((supplier, index) => {
      if (y < 35) {
        page = pdf.addPage([842, 595]);
        y = 555;
      }
      page.drawText(supplierPdfLine(index, supplier).slice(0, 145), {
        x: 35,
        y,
        size: 8,
        font,
      });
      y -= 16;
    });
    return new Response(Buffer.from(await pdf.save()), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=proveedores.pdf",
      },
    });
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Proveedores");
  sheet.columns = [
    { header: "Identificación", key: "identification", width: 20 },
    { header: "Razón social / Nombre", key: "name", width: 34 },
    { header: "Nombre comercial", key: "tradeName", width: 28 },
    { header: "Email", key: "email", width: 28 },
    { header: "Teléfono", key: "phone", width: 20 },
    { header: "Provincia", key: "province", width: 18 },
    { header: "Ciudad", key: "city", width: 18 },
    { header: "Registro", key: "createdAt", width: 16 },
    { header: "Estado", key: "status", width: 12 },
  ];
  suppliers.forEach((supplier) => sheet.addRow(supplierExportRow(supplier)));
  sheet.getRow(1).font = { bold: true };
  return new Response(Buffer.from(await workbook.xlsx.writeBuffer()), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=proveedores.xlsx",
    },
  });
}
