import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextRequest } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

type Context = { params: Promise<{ orderId: string }> };
const usd = (v: unknown) => `$${Number(v).toFixed(2)}`;
const BLUE = rgb(0.12, 0.32, 0.95);

export async function GET(_: NextRequest, context: Context) {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const { orderId } = await context.params;

  const [order, company] = await Promise.all([
    prisma.salesOrder.findFirst({
      where: { id: orderId, tenantId: tenant.id },
      include: {
        customer: { select: { name: true, identification: true, email: true, phone: true, address: true } },
        items: { include: { product: { select: { name: true, primaryCode: true } } } },
      },
    }),
    prisma.tenant.findUnique({ where: { id: tenant.id } }),
  ]);

  if (!order) return new Response("Orden no encontrada", { status: 404 });

  const snapshot = (order.customerSnapshot ?? {}) as Record<string, string | null>;
  const customerName = order.customer?.name ?? snapshot.name ?? "Consumidor Final";
  const customerIdent = order.customer?.identification ?? snapshot.identification ?? "—";

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 795;

  const text = (value: string, x = 45, size = 9, isBold = false) => {
    page.drawText(value.slice(0, 120), { x, y, size, font: isBold ? bold : regular, color: rgb(0.1, 0.14, 0.22) });
  };

  // Header
  text(company?.legalName ?? tenant.name, 45, 16, true);
  y -= 20;
  text(`RUC: ${company?.taxIdentificationValue ?? "—"}`);
  y -= 14;
  text(`${company?.address ?? ""} ${company?.city ?? ""}`.trim());

  page.drawText("ORDEN DE VENTA", { x: 390, y: 795, size: 14, font: bold, color: BLUE });
  page.drawText(`OV-${String(order.number).padStart(6, "0")}`, { x: 390, y: 775, size: 10, font: regular });

  const STATUS_LABELS: Record<string, string> = { DRAFT: "Borrador", CONFIRMED: "Confirmada", CONVERTED: "Facturada", CANCELLED: "Cancelada" };
  page.drawText(`Estado: ${STATUS_LABELS[order.status] ?? order.status}`, { x: 390, y: 760, size: 9, font: regular });

  y -= 34;
  page.drawLine({ start: { x: 45, y }, end: { x: 550, y }, thickness: 1, color: rgb(0.85, 0.87, 0.9) });
  y -= 22;

  text(`Cliente: ${customerName}`, 45, 10, true);
  y -= 16;
  text(`Identificación: ${customerIdent}`);
  y -= 14;
  text(`Dirección: ${snapshot.address ?? order.customer?.address ?? "—"}`);
  y -= 18;
  const issueStr = order.issueDate.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
  const expectedStr = order.expectedDate ? order.expectedDate.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  text(`Fecha: ${issueStr}   Entrega esperada: ${expectedStr}`);
  y -= 14;
  if (order.sellerName) { text(`Vendedor: ${order.sellerName}`); y -= 14; }

  y -= 14;
  // Item table header
  page.drawRectangle({ x: 45, y: y - 4, width: 505, height: 20, color: rgb(0.94, 0.96, 0.99) });
  text("Producto", 50, 8, true);
  text("Cant.", 330, 8, true);
  text("Precio", 380, 8, true);
  text("IVA", 440, 8, true);
  text("Total", 490, 8, true);
  y -= 22;

  for (const item of order.items) {
    if (y < 110) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
    const name = item.product?.name ?? item.productName;
    const code = item.product?.primaryCode ?? item.code ?? "";
    text(`${code} ${name}`.trim(), 50, 8);
    text(String(Number(item.quantity)), 335, 8);
    text(usd(item.unitPrice), 380, 8);
    text(`${Number(item.taxRate)}%`, 440, 8);
    text(usd(item.total), 490, 8);
    y -= 17;
    if (item.description) {
      text(`  ${item.description}`, 50, 7);
      y -= 13;
    }
  }

  y -= 8;
  page.drawLine({ start: { x: 340, y }, end: { x: 550, y }, thickness: 1, color: rgb(0.8, 0.82, 0.86) });
  y -= 18;
  text(`Subtotal: ${usd(order.subtotal)}`, 400, 9);
  y -= 16;
  text(`Descuento: ${usd(order.discount)}`, 400, 9);
  y -= 16;
  text(`IVA: ${usd(order.tax)}`, 400, 9);
  y -= 20;
  text(`TOTAL: ${usd(order.total)}`, 400, 12, true);

  if (order.observation) {
    y -= 30;
    text(`Observación: ${order.observation}`, 45, 9);
  }

  page.drawText("Este documento no constituye un comprobante tributario.", {
    x: 45, y: 35, size: 8, font: regular, color: rgb(0.4, 0.44, 0.52),
  });

  const orderNum = `OV-${String(order.number).padStart(6, "0")}`;
  return new Response(Buffer.from(await pdf.save()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${orderNum}.pdf"`,
    },
  });
}
