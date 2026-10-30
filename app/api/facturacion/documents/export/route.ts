import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { loadCoreDocuments } from "@/lib/core/billing/billing-documents";
import { generatePdfTable } from "@/lib/core/pdf-table";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";

function dateValue(value: string | null, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}-05:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: NextRequest) {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const url = request.nextUrl;

  const format = url.searchParams.get("format") ?? "excel";
  const type = url.searchParams.get("type") ?? "all";
  const from = url.searchParams.get("from") ?? null;
  const to = url.searchParams.get("to") ?? null;
  const search = url.searchParams.get("q") ?? undefined;

  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId: tenant.id },
    select: { legalName: true, ruc: true },
  });

  const result = await loadCoreDocuments(tenant.id, {
    page: 1,
    perPage: 10000,
    type: type as "all",
    search,
    from: dateValue(from) ?? undefined,
    to: dateValue(to, true) ?? undefined,
    sort: "date",
  });

  const items = result.items;
  const now = new Date();
  const dateLabel = (v: string | null) => {
    if (!v) return "—";
    return new Date(v).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  if (format === "pdf") {
    const totalAmount = items.reduce((s, i) => s + Number(i.total ?? 0), 0);
    const pdfBytes = await generatePdfTable({
      title: "REPORTE DE DOCUMENTOS",
      subtitle: `${profile?.legalName ?? tenant.name} · RUC: ${profile?.ruc ?? "—"} · Generado: ${now.toLocaleDateString("es-EC")} · Rango: ${from ?? "inicio"} a ${to ?? "actual"} · Documentos: ${items.length} · Total: $${totalAmount.toFixed(2)}`,
      landscape: true,
      columns: [
        { header: "Fecha", key: "fecha", width: 70 },
        { header: "Tipo", key: "tipo", width: 60 },
        { header: "Número", key: "numero", width: 110 },
        { header: "Cliente", key: "cliente", width: 150 },
        { header: "Identificación", key: "identificacion", width: 90 },
        { header: "Total", key: "total", width: 70, align: "right" },
        { header: "Estado", key: "estado", width: 70 },
        { header: "SRI", key: "sri", width: 70 },
        { header: "Autorización", key: "autorizacion", width: 90 },
      ],
      rows: items.map((item) => ({
        fecha: dateLabel(item.issuedAt),
        tipo: item.sriDocumentId ? "Factura" : "Recibo",
        numero: item.displayNumber ?? "—",
        cliente: (item.customerName ?? "Consumidor Final").substring(0, 30),
        identificacion: item.customerIdentification ?? "—",
        total: item.total ? `$${Number(item.total).toFixed(2)}` : "—",
        estado: item.internalStatusLabel ?? "—",
        sri: item.sriStatusLabel ?? "—",
        autorizacion: item.authorizationNumber ? item.authorizationNumber.substring(0, 20) + "..." : "—",
      })),
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="documentos_${from ?? "all"}_${to ?? "all"}.pdf"`,
      },
    });
  }

  // Excel export
  const wb = new ExcelJS.Workbook();
  wb.creator = "Facturom";
  const ws = wb.addWorksheet("Documentos");

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 10 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E52F1" } },
    alignment: { horizontal: "center", vertical: "middle" },
  };

  const excelHeaders = ["Fecha", "Tipo", "Número", "Cliente", "Identificación", "Subtotal", "Impuestos", "Total", "Estado", "Estado SRI", "Autorización"];
  const headerRow = ws.addRow(excelHeaders);
  headerRow.eachCell((cell) => { cell.style = headerStyle; });
  ws.columns = [
    { width: 14 }, { width: 12 }, { width: 22 }, { width: 30 }, { width: 18 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 30 },
  ];

  ws.autoFilter = { from: "A1", to: `K${items.length + 1}` };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const item of items) {
    ws.addRow([
      dateLabel(item.issuedAt),
      item.sriDocumentId ? "Factura" : "Recibo",
      item.displayNumber ?? "—",
      item.customerName ?? "Consumidor Final",
      item.customerIdentification ?? "—",
      "", // subtotal not available at document level
      "",
      item.total ? Number(item.total) : 0,
      item.internalStatusLabel ?? "—",
      item.sriStatusLabel ?? "—",
      item.authorizationNumber ?? "—",
    ]);
  }

  // Summary
  const sumWs = wb.addWorksheet("Resumen");
  sumWs.addRow(["Empresa", profile?.legalName ?? tenant.name]);
  sumWs.addRow(["RUC", profile?.ruc ?? "—"]);
  sumWs.addRow(["Desde", from ?? "Todos"]);
  sumWs.addRow(["Hasta", to ?? "Todos"]);
  sumWs.addRow(["Documentos", items.length]);
  sumWs.addRow(["Total", items.reduce((s, i) => s + Number(i.total ?? 0), 0)]);
  sumWs.getColumn(1).width = 20;
  sumWs.getColumn(2).width = 40;

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="documentos_${from ?? "all"}_${to ?? "all"}.xlsx"`,
    },
  });
}
