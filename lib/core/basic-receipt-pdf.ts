import "@/lib/security/server-only";

import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { RGB } from "pdf-lib";
import type { PDFFont } from "pdf-lib";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReceiptPdfItem = {
  quantity: number;
  price: number;
  total: number;
  taxRate: number;
  discountAmount: number;
  productName: string;
};

type ReceiptPdfPayment = {
  method: string;
  amount: number;
};

export type ReceiptPdfData = {
  tenantName: string;
  saleId: string;
  createdAt: Date;
  customerName: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  items: ReceiptPdfItem[];
  payments: ReceiptPdfPayment[];
};

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  blue:   rgb(0.0, 0.25, 0.50),
  white:  rgb(1, 1, 1),
  border: rgb(0.80, 0.82, 0.87),
  text:   rgb(0.07, 0.10, 0.14),
  muted:  rgb(0.38, 0.44, 0.52),
  rowOdd: rgb(0.97, 0.98, 0.99),
  hdrBg:  rgb(0.0, 0.25, 0.50),
};

// ── Coordinate helpers ────────────────────────────────────────────────────────

function pdfY(H: number, fromTop: number): number {
  return H - fromTop;
}

function drawRect(
  page: PDFPage, H: number,
  x: number, fromTop: number, w: number, h: number,
  fill?: RGB, borderColor?: RGB, borderWidth = 0.5
) {
  page.drawRectangle({
    x, y: pdfY(H, fromTop + h), width: w, height: h,
    color: fill,
    borderColor: borderColor ?? C.border,
    borderWidth: fill && !borderColor ? 0 : borderWidth,
  });
}

function drawLine(
  page: PDFPage, H: number,
  x1: number, x2: number, fromTop: number,
  color: RGB = C.border, thickness = 0.5
) {
  page.drawLine({
    start: { x: x1, y: pdfY(H, fromTop) },
    end:   { x: x2, y: pdfY(H, fromTop) },
    thickness, color,
  });
}

function drawText(
  page: PDFPage, H: number,
  text: string, x: number, fromTop: number,
  size: number, font: PDFFont, color: RGB = C.text, maxWidth?: number
) {
  let t = text;
  if (maxWidth !== undefined && maxWidth > 0) {
    while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -1);
    if (t.length < text.length) t = t.slice(0, -1) + "…";
  }
  page.drawText(t, {
    x, y: pdfY(H, fromTop + size * 0.72),
    size, font, color,
  });
}

function drawTextRight(
  page: PDFPage, H: number,
  text: string, rightX: number, fromTop: number,
  size: number, font: PDFFont, color: RGB = C.text
) {
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: rightX - tw, y: pdfY(H, fromTop + size * 0.72),
    size, font, color,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function paymentLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
    credit: "Crédito / Fiado",
  };
  return labels[method] ?? method;
}

// ── Generator ─────────────────────────────────────────────────────────────────

export async function generateBasicReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Recibo ${data.saleId}`);
  pdfDoc.setCreator("Appsolux");

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const W = page.getWidth();
  const H = page.getHeight();

  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ML = 40;
  const UW = W - ML * 2;
  const shortId = data.saleId.slice(-8);
  const paid = data.payments.reduce((s, p) => s + p.amount, 0);
  const pending = Math.max(data.total - paid, 0);

  let Y = 42;

  // ── Header ──

  drawText(page, H, data.tenantName, ML, Y, 18, fontB, C.blue, UW);
  Y += 24;

  drawText(page, H, "Recibo interno", ML, Y, 11, fontB, C.text);
  Y += 14;
  drawText(page, H, `Recibo #${shortId}`, ML, Y, 8.5, fontR, C.muted);
  Y += 11;
  drawText(page, H, `Fecha: ${data.createdAt.toLocaleString("es-EC", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })}`, ML, Y, 8.5, fontR, C.muted);
  Y += 16;

  // ── Customer card ──

  const cardH = 52;
  drawRect(page, H, ML, Y, UW, cardH, rgb(0.97, 0.98, 1.0), C.border);
  const half = Math.floor(UW / 2);

  drawText(page, H, "Cliente", ML + 12, Y + 10, 8, fontB, C.blue);
  drawText(page, H, data.customerName, ML + 12, Y + 22, 9, fontR, C.text, half - 16);

  drawText(page, H, "Estado", ML + half + 12, Y + 10, 8, fontB, C.blue);
  drawText(page, H, `${data.status} · ${data.paymentStatus}`, ML + half + 12, Y + 22, 8.5, fontR, C.text, half - 16);

  if (data.payments.length > 0) {
    const pmtStr = data.payments.map(p => `${paymentLabel(p.method)} ${money(p.amount)}`).join("  ·  ");
    drawText(page, H, pmtStr, ML + 12, Y + 38, 7.5, fontR, C.muted, UW - 24);
  }

  Y += cardH + 16;

  // ── Table ──

  const colW = [220, 48, 80, 58, 90];
  const colX = [ML, ML + 220, ML + 268, ML + 348, ML + 406];
  const hdrH = 18;

  drawRect(page, H, ML, Y, UW, hdrH, C.hdrBg, C.hdrBg, 0);
  const headers = ["Producto", "Cant.", "P. Unit.", "IVA", "Total"];
  for (let i = 0; i < headers.length; i++) {
    const align = i === 0 ? "left" : "right";
    if (align === "left") {
      drawText(page, H, headers[i]!, colX[i]! + 4, Y + 4, 8, fontB, C.white);
    } else {
      drawTextRight(page, H, headers[i]!, colX[i]! + colW[i]! - 4, Y + 4, 8, fontB, C.white);
    }
  }
  Y += hdrH;

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]!;
    const hasDiscount = item.discountAmount > 0;
    const rowH = hasDiscount ? 28 : 20;
    const bg = i % 2 === 1 ? C.rowOdd : C.white;

    drawRect(page, H, ML, Y, UW, rowH, bg, C.border);

    drawText(page, H, item.productName, colX[0]! + 4, Y + 5, 8.5, fontB, C.text, colW[0]! - 8);
    if (hasDiscount) {
      drawText(page, H, `Desc. ${money(item.discountAmount)}`, colX[0]! + 4, Y + 16, 7, fontR, C.muted, colW[0]! - 8);
    }

    drawTextRight(page, H, String(item.quantity), colX[1]! + colW[1]! - 4, Y + 5, 8, fontR, C.text);
    drawTextRight(page, H, money(item.price), colX[2]! + colW[2]! - 4, Y + 5, 8, fontR, C.muted);
    drawTextRight(page, H, item.taxRate > 0 ? `${item.taxRate}%` : "—", colX[3]! + colW[3]! - 4, Y + 5, 8, fontR, C.muted);
    drawTextRight(page, H, money(item.total), colX[4]! + colW[4]! - 4, Y + 5, 8, fontR, C.text);

    Y += rowH;
  }

  Y += 12;

  // ── Totals ──

  const sumX = ML + UW - 210;
  const valX = ML + UW - 4;

  const hasIva = data.taxTotal > 0;
  const hasDisc = data.discountTotal > 0;

  if (hasDisc || hasIva) {
    drawText(page, H, "Subtotal", sumX, Y, 9, fontR, C.muted, 100);
    drawTextRight(page, H, money(data.subtotal), valX, Y, 9, fontR, C.muted);
    Y += 12;
  }
  if (hasDisc) {
    drawText(page, H, "Descuento", sumX, Y, 9, fontR, C.muted, 100);
    drawTextRight(page, H, `-${money(data.discountTotal)}`, valX, Y, 9, fontR, C.muted);
    Y += 12;
  }
  if (hasIva) {
    drawText(page, H, "IVA", sumX, Y, 9, fontR, C.muted, 100);
    drawTextRight(page, H, money(data.taxTotal), valX, Y, 9, fontR, C.muted);
    Y += 12;
  }

  drawLine(page, H, sumX, ML + UW, Y, C.border);
  Y += 5;
  drawText(page, H, "TOTAL", sumX, Y, 11, fontB, C.text, 100);
  drawTextRight(page, H, money(data.total), valX, Y, 11, fontB, C.text);
  Y += 15;

  drawText(page, H, `Pagado: ${money(paid)}`, sumX, Y, 9, fontR, C.muted, 100);
  Y += 12;

  if (pending > 0) {
    drawText(page, H, `Saldo pendiente: ${money(pending)}`, sumX, Y, 9, fontB, rgb(0.63, 0.32, 0.05), 150);
    Y += 12;
  }

  // ── Footer note ──

  drawLine(page, H, ML, ML + UW, H - 42, C.border);
  drawText(page, H, "Recibo interno generado por Appsolux. No corresponde a un comprobante tributario SRI.",
    ML, H - 36, 7, fontR, C.muted, UW);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
