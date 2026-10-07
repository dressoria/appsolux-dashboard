import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getProforma } from "@/lib/core/lightweight-proformas";
import { getPrismaClient } from "@/lib/db/prisma";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type Context = { params: Promise<{ proformaId: string }> };
const usd = (value: unknown) => `$${Number(value).toFixed(2)}`;

export async function GET(_: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sesión requerida", { status: 401 });
  const [tenant, { proformaId }] = await Promise.all([
    getCurrentTenant(user),
    context.params,
  ]);
  const [proforma, company] = await Promise.all([
    getProforma(tenant.id, proformaId),
    getPrismaClient().tenant.findUnique({ where: { id: tenant.id } }),
  ]);
  if (!proforma) return new Response("Proforma no encontrada", { status: 404 });
  const customer = proforma.customerSnapshot as Record<string, string | null>;
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 795;
  const text = (value: string, x = 45, size = 9, isBold = false) => {
    page.drawText(value.slice(0, 100), {
      x,
      y,
      size,
      font: isBold ? bold : regular,
      color: rgb(0.1, 0.14, 0.22),
    });
  };
  text(company?.legalName ?? tenant.name, 45, 16, true);
  y -= 20;
  text(`RUC: ${company?.taxIdentificationValue ?? "—"}`);
  y -= 14;
  text(`${company?.address ?? ""} ${company?.city ?? ""}`.trim());
  page.drawText("PROFORMA", {
    x: 430,
    y: 795,
    size: 16,
    font: bold,
    color: rgb(0.12, 0.32, 0.95),
  });
  page.drawText(proforma.number, { x: 430, y: 775, size: 9, font: regular });
  y -= 34;
  page.drawLine({
    start: { x: 45, y },
    end: { x: 550, y },
    thickness: 1,
    color: rgb(0.85, 0.87, 0.9),
  });
  y -= 22;
  text(`Cliente: ${customer.name ?? "Consumidor Final"}`, 45, 10, true);
  y -= 16;
  text(`Identificación: ${customer.identification ?? "9999999999999"}`);
  y -= 14;
  text(`Dirección: ${customer.address ?? "—"}`);
  y -= 14;
  text(`Email: ${customer.email ?? "—"}   Teléfono: ${customer.phone ?? "—"}`);
  y -= 18;
  text(
    `Fecha: ${proforma.issueDate.toLocaleDateString("es-EC")}   Válida hasta: ${proforma.validUntil?.toLocaleDateString("es-EC") ?? "—"}`,
  );
  y -= 28;
  page.drawRectangle({
    x: 45,
    y: y - 4,
    width: 505,
    height: 20,
    color: rgb(0.94, 0.96, 0.99),
  });
  text("Producto", 50, 8, true);
  text("Cant.", 330, 8, true);
  text("Precio", 380, 8, true);
  text("IVA", 440, 8, true);
  text("Total", 490, 8, true);
  y -= 22;
  for (const item of proforma.items) {
    if (y < 110) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
    text(`${item.code ?? ""} ${item.productName}`.trim(), 50, 8);
    text(String(item.quantity), 335, 8);
    text(usd(item.unitPrice), 380, 8);
    text(`${item.taxRate}%`, 440, 8);
    text(usd(item.total), 490, 8);
    y -= 17;
    if (item.description) {
      text(`  ${item.description}`, 50, 7);
      y -= 13;
    }
    if (item.observation) {
      text(`  ${item.observation}`, 50, 7);
      y -= 13;
    }
  }
  y -= 8;
  page.drawLine({
    start: { x: 340, y },
    end: { x: 550, y },
    thickness: 1,
    color: rgb(0.8, 0.82, 0.86),
  });
  y -= 18;
  text(`Subtotal: ${usd(proforma.subtotal)}`, 400, 9);
  y -= 16;
  text(`Descuento: ${usd(proforma.discount)}`, 400, 9);
  y -= 16;
  text(`IVA: ${usd(proforma.tax)}`, 400, 9);
  y -= 20;
  text(`TOTAL: ${usd(proforma.total)}`, 400, 12, true);
  if (proforma.observation) {
    y -= 30;
    text(`Observación: ${proforma.observation}`, 45, 9);
  }
  page.drawText("Este documento no constituye un comprobante tributario.", {
    x: 45,
    y: 35,
    size: 8,
    font: regular,
    color: rgb(0.4, 0.44, 0.52),
  });
  return new Response(Buffer.from(await pdf.save()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${proforma.number}.pdf"`,
    },
  });
}
