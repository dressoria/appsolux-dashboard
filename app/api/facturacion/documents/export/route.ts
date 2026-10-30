import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { loadCoreDocuments } from "@/lib/core/billing/billing-documents";
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
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const blue = "#1E52F1";
    doc.rect(0, 0, doc.page.width, 60).fill(blue);
    doc.fillColor("#ffffff").fontSize(16).text("REPORTE DE DOCUMENTOS", 40, 18, { align: "left" });
    doc.fontSize(9).text(`${profile?.legalName ?? tenant.name} · RUC: ${profile?.ruc ?? "—"}`, 40, 38, { align: "left" });
    doc.text(`Generado: ${now.toLocaleDateString("es-EC")} · Rango: ${from ?? "inicio"} a ${to ?? "actual"}`, 40, 38, { align: "right" });

    doc.fillColor("#000000");
    let y = 75;
    const cols = [40, 110, 170, 290, 400, 475, 545, 625, 700];
    const headers = ["Fecha", "Tipo", "Número", "Cliente", "Identificación", "Total", "Estado", "SRI", "Autorización"];

    function drawHeaders() {
      doc.rect(40, y - 5, doc.page.width - 80, 18).fill("#E8EDFF");
      doc.fillColor("#333333").fontSize(7).font("Helvetica-Bold");
      headers.forEach((h, i) => doc.text(h, cols[i], y, { width: (cols[i + 1] ?? doc.page.width - 40) - cols[i], lineBreak: false }));
      doc.font("Helvetica");
      y += 20;
    }

    drawHeaders();

    let totalAmount = 0;
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (y > doc.page.height - 60) {
        doc.addPage({ layout: "landscape", size: "A4", margin: 40 });
        y = 40;
        drawHeaders();
      }
      if (idx % 2 === 1) doc.rect(40, y - 3, doc.page.width - 80, 15).fill("#F9FAFB");
      doc.fillColor("#333333").fontSize(7);
      const row = [
        dateLabel(item.issuedAt),
        item.sriDocumentId ? "Factura" : "Recibo",
        item.displayNumber ?? "—",
        (item.customerName ?? "Consumidor Final").substring(0, 30),
        item.customerIdentification ?? "—",
        item.total ? `$${Number(item.total).toFixed(2)}` : "—",
        item.internalStatusLabel ?? "—",
        item.sriStatusLabel ?? "—",
        item.authorizationNumber ? item.authorizationNumber.substring(0, 20) + "..." : "—",
      ];
      row.forEach((val, i) => doc.text(val, cols[i], y, { width: (cols[i + 1] ?? doc.page.width - 40) - cols[i], lineBreak: false }));
      totalAmount += Number(item.total ?? 0);
      y += 15;
    }

    y += 10;
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text(`Documentos: ${items.length}   Total: $${totalAmount.toFixed(2)}`, 40, y);

    const pageCount = doc.bufferedPageRange();
    for (let i = 0; i < pageCount.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).font("Helvetica").fillColor("#999999")
        .text(`Página ${i + 1} de ${pageCount.count}`, 40, doc.page.height - 30, { align: "right", width: doc.page.width - 80 });
    }

    doc.end();
    await new Promise<void>((resolve) => doc.on("end", resolve));
    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(pdfBuffer, {
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
