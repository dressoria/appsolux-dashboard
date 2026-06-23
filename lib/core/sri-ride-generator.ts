import "@/lib/security/server-only";

import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { RGB } from "pdf-lib";
import type { PDFFont } from "pdf-lib";

import type { ParsedAuthorizedSriInvoice } from "@/lib/core/sri-authorized-xml-parser";

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  headerBg:  rgb(0.04, 0.22, 0.47),  // SRI navy blue
  white:     rgb(1, 1, 1),
  border:    rgb(0.78, 0.80, 0.86),
  text:      rgb(0.07, 0.10, 0.14),
  muted:     rgb(0.38, 0.44, 0.52),
  red:       rgb(0.75, 0.08, 0.08),
  rowOdd:    rgb(0.96, 0.97, 0.99),
  totalBg:   rgb(0.04, 0.22, 0.47),
};

// ── Coordinate helpers ────────────────────────────────────────────────────────
//
// All layout is expressed as (fromTop, ...) where fromTop is distance in
// points from the TOP of the page. pdf-lib uses bottom-left origin, so we
// convert: pdfY = H - fromTop.

function pdfY(H: number, fromTop: number): number {
  return H - fromTop;
}

function drawRect(
  page: PDFPage,
  H: number,
  x: number, fromTop: number, w: number, h: number,
  fill?: RGB,
  borderColor?: RGB,
  borderWidth = 0.5
) {
  page.drawRectangle({
    x,
    y: pdfY(H, fromTop + h),
    width: w,
    height: h,
    color: fill,
    borderColor: borderColor ?? C.border,
    borderWidth: fill && !borderColor ? 0 : borderWidth,
  });
}

function drawLine(
  page: PDFPage,
  H: number,
  x1: number, x2: number, fromTop: number,
  color: RGB = C.border,
  thickness = 0.5
) {
  page.drawLine({
    start: { x: x1, y: pdfY(H, fromTop) },
    end:   { x: x2, y: pdfY(H, fromTop) },
    thickness,
    color,
  });
}

function drawVLine(
  page: PDFPage,
  H: number,
  x: number, fromTop1: number, fromTop2: number,
  color: RGB = C.border,
  thickness = 0.5
) {
  page.drawLine({
    start: { x, y: pdfY(H, fromTop1) },
    end:   { x, y: pdfY(H, fromTop2) },
    thickness,
    color,
  });
}

// Draw text so that the top of the glyphs aligns approximately with `fromTop`.
function drawText(
  page: PDFPage,
  H: number,
  text: string,
  x: number, fromTop: number,
  size: number,
  font: PDFFont,
  color: RGB = C.text,
  maxWidth?: number
) {
  let t = text;
  if (maxWidth !== undefined && maxWidth > 0) {
    while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) {
      t = t.slice(0, -1);
    }
    if (t.length < text.length) t = t.slice(0, -1) + "…";
  }
  // pdf-lib y = baseline. Baseline ≈ fromTop + size * 0.72 (empirical for Helvetica)
  page.drawText(t, {
    x,
    y: pdfY(H, fromTop + size * 0.72),
    size,
    font,
    color,
  });
}

function drawTextCentered(
  page: PDFPage,
  H: number,
  text: string,
  boxX: number, fromTop: number, boxW: number,
  size: number,
  font: PDFFont,
  color: RGB = C.text
) {
  const tw = font.widthOfTextAtSize(text, size);
  const x = boxX + Math.max((boxW - tw) / 2, 0);
  page.drawText(text, {
    x,
    y: pdfY(H, fromTop + size * 0.72),
    size,
    font,
    color,
  });
}

function drawTextRight(
  page: PDFPage,
  H: number,
  text: string,
  rightX: number, fromTop: number,
  size: number,
  font: PDFFont,
  color: RGB = C.text
) {
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: rightX - tw,
    y: pdfY(H, fromTop + size * 0.72),
    size,
    font,
    color,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function money(value: string): string {
  const n = parseFloat(value || "0");
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

function safe(value: string | undefined | null): string {
  return value?.trim() || "";
}

// Wraps `text` into lines that each fit within `maxWidth` at `size` pt.
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // If single word is too long, truncate it
      let w = word;
      while (w.length > 1 && font.widthOfTextAtSize(w, size) > maxWidth) {
        w = w.slice(0, -1);
      }
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

// ── RIDE layout constants ─────────────────────────────────────────────────────

const A4W = 595.28;
const A4H = 841.89;
const ML = 18; // left margin
const MR = 18; // right margin
const UW = A4W - ML - MR; // usable width ~559pt

// Column widths for the detail table (total must equal UW ≈ 559)
const TABLE_COLS = [
  { label: "Cód. Principal",  w: 60 },
  { label: "Cód. Aux.",       w: 44 },
  { label: "Cant.",           w: 30 },
  { label: "Descripción",     w: 140 },
  { label: "Det. Adicional",  w: 60 },
  { label: "P. Unitario",     w: 56 },
  { label: "Subsidio",        w: 38 },
  { label: "P.s/Subsidio",    w: 52 },
  { label: "Descuento",       w: 42 },
  { label: "P. Total",        w: 59 },
] as const;
// Total: 60+44+30+140+60+56+38+52+42+59 = 581... let me recalculate to exactly UW

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateRidePdfFromAuthorizedXml(
  invoice: ParsedAuthorizedSriInvoice
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`RIDE ${invoice.document.number || invoice.authorization.number}`);
  pdfDoc.setCreator("Appsolux");
  pdfDoc.setProducer("Appsolux - SRI Ecuador");

  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Recalculate table column widths to exactly fit UW
  const colsRaw = [58, 43, 29, 138, 58, 55, 37, 51, 41, 59]; // raw widths
  const rawSum = colsRaw.reduce((a, b) => a + b, 0);
  const scaleF = UW / rawSum;
  const colWidths = colsRaw.map((w) => Math.round(w * scaleF));
  // Fix rounding drift on last column
  const wSum = colWidths.reduce((a, b) => a + b, 0);
  colWidths[colWidths.length - 1]! += UW - wSum;

  const TABLE_HEADER_H = 17;
  const TABLE_ROW_H = 18;

  let currentPage = pdfDoc.addPage([A4W, A4H]);
  const H = A4H;

  // Track vertical cursor (fromTop)
  let Y = 0;

  function ensureSpace(needed: number): PDFPage {
    if (Y + needed > H - 55) {
      currentPage = pdfDoc.addPage([A4W, A4H]);
      Y = 20;
    }
    return currentPage;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // A. HEADER: two-column panel
  // ──────────────────────────────────────────────────────────────────────────

  Y = 18;
  const headerTop = Y;
  const leftW = Math.round(UW * 0.60);  // ~335
  const rightX = ML + leftW + 4;
  const rightW = UW - leftW - 4;        // ~220

  // Measure left panel content to determine header height
  const leftContentLines: Array<[string, PDFFont, number]> = [];

  leftContentLines.push(["NO TIENE LOGO", fontB, 7]); // placeholder

  const legalName = safe(invoice.emitter.legalName).toUpperCase();
  const tradeName = safe(invoice.emitter.tradeName);
  const dirMatriz = safe(invoice.emitter.dirMatriz);
  const dirEstab = safe(invoice.emitter.dirEstablecimiento);
  const obCont = safe(invoice.emitter.obligadoContabilidad);
  const rimpe = safe(invoice.emitter.contribuyenteRimpe);
  const agente = safe(invoice.emitter.agenteRetencion);

  if (legalName) leftContentLines.push([legalName, fontB, 8.5]);
  if (tradeName) leftContentLines.push([tradeName, fontR, 7]);
  if (dirMatriz) {
    leftContentLines.push(["Dirección Matriz:", fontB, 6]);
    const dmLines = wrapText(dirMatriz, fontR, 6.5, leftW - 18);
    dmLines.forEach(l => leftContentLines.push([l, fontR, 6.5]));
  }
  if (dirEstab && dirEstab !== dirMatriz) {
    leftContentLines.push(["Dir. Establecimiento:", fontB, 6]);
    const deLines = wrapText(dirEstab, fontR, 6.5, leftW - 18);
    deLines.forEach(l => leftContentLines.push([l, fontR, 6.5]));
  }
  if (obCont) {
    const label = obCont.toUpperCase() === "SI" || obCont.toUpperCase() === "SÍ" ? "SÍ" : "NO";
    leftContentLines.push([`OBLIGADO A LLEVAR CONTABILIDAD: ${label}`, fontR, 6.5]);
  }
  if (rimpe) leftContentLines.push([rimpe, fontR, 6.5]);
  if (agente) leftContentLines.push([`Agente de Retención Res. No. ${agente}`, fontR, 6.5]);

  // Estimate left panel height
  let leftH = 10;
  for (const [, , fs] of leftContentLines) leftH += fs + 3;
  leftH += 8;

  // Right panel content
  const authNum = safe(invoice.authorization.number);
  const accessKey = safe(invoice.authorization.accessKey);
  const rightH = 135; // fixed: RUC, FACTURA, No., divider, auth num, date/env/emission, divider, clave

  const headerH = Math.max(leftH, rightH, 125);

  // Draw boxes
  drawRect(currentPage, H, ML, headerTop, leftW, headerH, C.white, C.border);
  drawRect(currentPage, H, rightX, headerTop, rightW, headerH, C.white, C.border);

  // ── Left panel ──

  let lY = headerTop + 8;

  // "NO TIENE LOGO" in red
  drawText(currentPage, H, "NO TIENE LOGO", ML + 8, lY, 7, fontB, C.red, leftW - 16);
  lY += 10;
  drawLine(currentPage, H, ML + 8, ML + leftW - 8, lY, C.border);
  lY += 5;

  if (legalName) {
    const lnLines = wrapText(legalName, fontB, 8.5, leftW - 16);
    for (const l of lnLines) { drawText(currentPage, H, l, ML + 8, lY, 8.5, fontB, C.text); lY += 11; }
  }
  if (tradeName) {
    drawText(currentPage, H, tradeName, ML + 8, lY, 7, fontR, C.text, leftW - 16);
    lY += 10;
  }
  if (dirMatriz) {
    drawText(currentPage, H, "Dirección Matriz:", ML + 8, lY, 6, fontB, C.muted);
    lY += 8;
    const dmLines = wrapText(dirMatriz, fontR, 6.5, leftW - 16);
    for (const l of dmLines) { drawText(currentPage, H, l, ML + 8, lY, 6.5, fontR, C.text); lY += 9; }
  }
  if (dirEstab && dirEstab !== dirMatriz) {
    drawText(currentPage, H, "Dir. Establecimiento:", ML + 8, lY, 6, fontB, C.muted);
    lY += 8;
    const deLines = wrapText(dirEstab, fontR, 6.5, leftW - 16);
    for (const l of deLines) { drawText(currentPage, H, l, ML + 8, lY, 6.5, fontR, C.text); lY += 9; }
  }
  if (obCont) {
    const label = obCont.toUpperCase() === "SI" || obCont.toUpperCase() === "SÍ" ? "SÍ" : "NO";
    drawText(currentPage, H, `Obligado a llevar contabilidad: ${label}`, ML + 8, lY, 6.5, fontR, C.text, leftW - 16);
    lY += 9;
  }
  if (rimpe) { drawText(currentPage, H, rimpe, ML + 8, lY, 6.5, fontR, C.text, leftW - 16); lY += 9; }
  if (agente) { drawText(currentPage, H, `Agente de Retención Res. No. ${agente}`, ML + 8, lY, 6.5, fontR, C.text, leftW - 16); }

  // ── Right panel ──

  let rY = headerTop + 8;
  const rInnerX = rightX + 6;
  const rInnerW = rightW - 12;

  drawTextCentered(currentPage, H, `R.U.C.: ${safe(invoice.emitter.ruc)}`, rightX, rY, rightW, 7.5, fontB);
  rY += 12;
  drawTextCentered(currentPage, H, safe(invoice.document.typeLabel) || "FACTURA", rightX, rY, rightW, 11, fontB);
  rY += 15;
  drawTextCentered(currentPage, H, `No. ${safe(invoice.document.number)}`, rightX, rY, rightW, 8, fontB);
  rY += 13;
  drawLine(currentPage, H, rInnerX, rightX + rightW - 6, rY, C.border);
  rY += 5;

  // Auth number
  drawTextCentered(currentPage, H, "NÚMERO DE AUTORIZACIÓN", rightX, rY, rightW, 6, fontB, C.muted);
  rY += 9;
  // Auth number may be 49 chars — use small font + wrap at midpoint
  const anFS = authNum.length > 20 ? 5.5 : 7;
  const anW = fontR.widthOfTextAtSize(authNum, anFS);
  if (anW <= rInnerW) {
    drawTextCentered(currentPage, H, authNum, rightX, rY, rightW, anFS, fontR);
    rY += anFS + 4;
  } else {
    const mid = Math.ceil(authNum.length / 2);
    drawTextCentered(currentPage, H, authNum.slice(0, mid), rightX, rY, rightW, anFS, fontR);
    rY += anFS + 2;
    drawTextCentered(currentPage, H, authNum.slice(mid), rightX, rY, rightW, anFS, fontR);
    rY += anFS + 3;
  }

  drawLine(currentPage, H, rInnerX, rightX + rightW - 6, rY, C.border);
  rY += 5;
  drawText(currentPage, H, `Fecha y hora de autorización:`, rInnerX, rY, 5.5, fontB, C.muted, rInnerW);
  rY += 8;
  drawText(currentPage, H, safe(invoice.authorization.date), rInnerX, rY, 6.5, fontR, C.text, rInnerW);
  rY += 9;
  drawText(currentPage, H, `Ambiente: ${safe(invoice.authorization.environmentLabel)}`, rInnerX, rY, 6.5, fontR, C.text, rInnerW);
  rY += 9;
  drawText(currentPage, H, `Emisión: ${safe(invoice.authorization.emissionLabel)}`, rInnerX, rY, 6.5, fontR, C.text, rInnerW);
  rY += 11;

  // Clave de acceso
  drawLine(currentPage, H, rInnerX, rightX + rightW - 6, rY, C.border);
  rY += 5;
  drawTextCentered(currentPage, H, "CLAVE DE ACCESO", rightX, rY, rightW, 5.5, fontB, C.muted);
  rY += 8;
  if (accessKey) {
    const akFS = 5;
    const akW = fontR.widthOfTextAtSize(accessKey, akFS);
    if (akW <= rInnerW) {
      drawTextCentered(currentPage, H, accessKey, rightX, rY, rightW, akFS, fontR);
    } else {
      const mid = Math.ceil(accessKey.length / 2);
      drawTextCentered(currentPage, H, accessKey.slice(0, mid), rightX, rY, rightW, akFS, fontR);
      rY += 7;
      drawTextCentered(currentPage, H, accessKey.slice(mid), rightX, rY, rightW, akFS, fontR);
    }
  }

  // Advance Y past header
  Y = headerTop + headerH + 4;

  // ──────────────────────────────────────────────────────────────────────────
  // B. CUSTOMER DATA
  // ──────────────────────────────────────────────────────────────────────────

  const customerH = 42;
  drawRect(currentPage, H, ML, Y, UW, customerH, C.white, C.border);

  const halfW = Math.floor(UW / 2);
  const col2X = ML + halfW + 2;

  let cY = Y + 7;
  drawText(currentPage, H, "Razón Social / Nombres y Apellidos:", ML + 6, cY, 5.5, fontB, C.muted);
  drawText(currentPage, H, "Identificación:", col2X + 6, cY, 5.5, fontB, C.muted);
  cY += 8;
  drawText(currentPage, H, safe(invoice.customer.name), ML + 6, cY, 7.5, fontB, C.text, halfW - 12);
  drawText(currentPage, H, safe(invoice.customer.identification), col2X + 6, cY, 7.5, fontR, C.text, halfW - 12);
  cY += 11;

  const issueDate = safe(invoice.document.issueDate);
  const guia = safe(invoice.document.guideRemission);
  const dirAdditional = invoice.additionalFields.find(
    f => f.name.toLowerCase().includes("direc") || f.name.toLowerCase().includes("address")
  );

  drawText(currentPage, H, `Fecha: ${issueDate}`, ML + 6, cY, 6.5, fontR, C.text, halfW - 12);
  if (guia) {
    drawText(currentPage, H, `Guía de Remisión: ${guia}`, col2X + 6, cY, 6.5, fontR, C.text, halfW - 12);
  } else if (dirAdditional) {
    drawText(currentPage, H, `Dirección: ${dirAdditional.value}`, col2X + 6, cY, 6.5, fontR, C.text, halfW - 12);
  }

  Y += customerH + 3;

  // ──────────────────────────────────────────────────────────────────────────
  // C. DETAIL TABLE
  // ──────────────────────────────────────────────────────────────────────────

  // Header row
  drawRect(currentPage, H, ML, Y, UW, TABLE_HEADER_H, C.headerBg, C.headerBg, 0);

  const colLabels = TABLE_COLS.map(c => c.label);
  let colX = ML;
  const colXPositions: number[] = [];

  for (let i = 0; i < colWidths.length; i++) {
    colXPositions.push(colX);
    const w = colWidths[i]!;
    drawTextCentered(currentPage, H, colLabels[i]!, colX, Y + 4, w, 5.5, fontB, C.white);
    colX += w;
  }

  // Vertical dividers in header
  for (let i = 1; i < colXPositions.length; i++) {
    drawVLine(currentPage, H, colXPositions[i]!, Y, Y + TABLE_HEADER_H, C.white, 0.4);
  }

  Y += TABLE_HEADER_H;

  // Data rows
  for (let rowIdx = 0; rowIdx < invoice.details.length; rowIdx++) {
    const pg = ensureSpace(TABLE_ROW_H);
    const det = invoice.details[rowIdx]!;
    const bg = rowIdx % 2 === 1 ? C.rowOdd : C.white;

    drawRect(pg, H, ML, Y, UW, TABLE_ROW_H, bg, C.border);

    // Vertical col dividers
    for (let i = 1; i < colXPositions.length; i++) {
      drawVLine(pg, H, colXPositions[i]!, Y, Y + TABLE_ROW_H, C.border, 0.3);
    }

    const cellY = Y + 5;
    const fs = 6.5;

    // Col 0: Cod. Principal
    drawText(pg, H, safe(det.code), colXPositions[0]! + 3, cellY, fs, fontR, C.text, colWidths[0]! - 6);
    // Col 1: Cod. Aux.
    drawText(pg, H, safe(det.auxiliaryCode), colXPositions[1]! + 3, cellY, fs, fontR, C.muted, colWidths[1]! - 6);
    // Col 2: Cantidad (right-aligned)
    drawTextRight(pg, H, safe(det.quantity), colXPositions[2]! + colWidths[2]! - 3, cellY, fs, fontR);
    // Col 3: Descripción
    drawText(pg, H, safe(det.description), colXPositions[3]! + 3, cellY, fs, fontR, C.text, colWidths[3]! - 6);
    // Col 4: Det. Adicional (join multiple fields with "; ")
    const detAdd = det.detailAdditional.map(d => `${d.name}: ${d.value}`).join("; ");
    drawText(pg, H, detAdd, colXPositions[4]! + 3, cellY, fs, fontR, C.muted, colWidths[4]! - 6);
    // Col 5: P. Unitario
    drawTextRight(pg, H, money(det.unitPrice), colXPositions[5]! + colWidths[5]! - 3, cellY, fs, fontR);
    // Col 6: Subsidio
    drawTextRight(pg, H, money(det.subsidio), colXPositions[6]! + colWidths[6]! - 3, cellY, fs, fontR, C.muted);
    // Col 7: P. s/ Subsidio
    drawTextRight(pg, H, money(det.precioSinSubsidio), colXPositions[7]! + colWidths[7]! - 3, cellY, fs, fontR);
    // Col 8: Descuento
    drawTextRight(pg, H, money(det.discount), colXPositions[8]! + colWidths[8]! - 3, cellY, fs, fontR);
    // Col 9: Precio Total
    drawTextRight(pg, H, money(det.subtotalExcludingTax), colXPositions[9]! + colWidths[9]! - 3, cellY, fs, fontB);

    Y += TABLE_ROW_H;
  }

  Y += 6;

  // ──────────────────────────────────────────────────────────────────────────
  // D. FOOTER: info adicional + forma de pago | totales
  // ──────────────────────────────────────────────────────────────────────────

  // Ensure minimum space for footer (estimate: ~160pt)
  if (Y + 160 > H - 35) {
    currentPage = pdfDoc.addPage([A4W, A4H]);
    Y = 18;
  }

  const footerTop = Y;
  const footerLeftW = Math.round(UW * 0.56); // ~313pt
  const footerRightX = ML + footerLeftW + 4;
  const footerRightW = UW - footerLeftW - 4;  // ~242pt

  // ── Left side ──

  let flY = footerTop;

  // Info adicional
  drawText(currentPage, H, "INFORMACIÓN ADICIONAL", ML + 5, flY, 6.5, fontB, C.text);
  flY += 10;

  const fieldsToShow = invoice.additionalFields.filter(
    f => !f.name.toLowerCase().includes("direc") && !f.name.toLowerCase().includes("address")
  );

  if (fieldsToShow.length === 0) {
    drawText(currentPage, H, "—", ML + 5, flY, 6.5, fontR, C.muted);
    flY += 10;
  } else {
    for (const field of fieldsToShow.slice(0, 8)) {
      const line = `${safe(field.name)}: ${safe(field.value)}`;
      drawText(currentPage, H, line, ML + 5, flY, 6.5, fontR, C.text, footerLeftW - 10);
      flY += 9;
    }
  }

  flY += 5;
  drawText(currentPage, H, "FORMA DE PAGO", ML + 5, flY, 6.5, fontB, C.text);
  flY += 10;

  if (invoice.payments.length === 0) {
    drawText(currentPage, H, "—", ML + 5, flY, 6.5, fontR, C.muted);
    flY += 10;
  } else {
    for (const pmt of invoice.payments) {
      const pmtLabel = pmt.label || pmt.code;
      const pmtAmt = pmt.amount && pmt.amount !== "0.00" ? ` — $${money(pmt.amount)}` : "";
      drawText(currentPage, H, `${pmtLabel}${pmtAmt}`, ML + 5, flY, 6.5, fontR, C.text, footerLeftW - 10);
      flY += 9;
    }
  }

  // ── Right side: Totals table ──

  type SummaryRow = { label: string; value: string; isTotal?: boolean; skip?: boolean };

  const summaryRows: SummaryRow[] = [
    // Subtotales por tarifa (e.g. SUBTOTAL 15%)
    ...invoice.totals.subtotalTaxed.map(r => ({ label: r.label, value: r.baseAmount })),
    { label: "SUBTOTAL 0%",                 value: invoice.totals.subtotalZero },
    { label: "SUBTOTAL NO OBJETO DE IVA",   value: invoice.totals.subtotalNoObjetoIva },
    { label: "SUBTOTAL EXENTO DE IVA",      value: invoice.totals.subtotalExentoIva },
    { label: "SUBTOTAL SIN IMPUESTOS",      value: invoice.totals.subtotalSinImpuestos },
    { label: "TOTAL DESCUENTO",             value: invoice.totals.totalDescuento },
    { label: "ICE",                         value: invoice.totals.ice },
    { label: "IRBPNR",                      value: invoice.totals.irbpnr },
    // IVA rows (e.g. IVA 15%)
    ...invoice.totals.iva.map(r => ({ label: r.label, value: r.value })),
    { label: "PROPINA",                     value: invoice.totals.propina },
    { label: "VALOR TOTAL",                 value: invoice.totals.importeTotal, isTotal: true },
  ];

  let frY = footerTop;
  const frLabelX = footerRightX + 4;
  const frValueX = footerRightX + footerRightW - 4;

  for (const row of summaryRows) {
    const fs = row.isTotal ? 8 : 7;
    const rowH = row.isTotal ? 13 : 11;
    const f = row.isTotal ? fontB : fontR;
    const color = row.isTotal ? C.white : C.text;
    const labelColor = row.isTotal ? C.white : C.muted;

    if (row.isTotal) {
      drawRect(currentPage, H, footerRightX, frY, footerRightW, rowH, C.totalBg, C.totalBg, 0);
    } else {
      drawLine(currentPage, H, footerRightX, footerRightX + footerRightW, frY + rowH, C.border);
    }

    drawText(currentPage, H, row.label, frLabelX, frY + 2, fs, f, labelColor, footerRightW * 0.70);
    drawTextRight(currentPage, H, `$${money(row.value)}`, frValueX, frY + 2, fs, f, color);

    frY += rowH;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // E. FOOTER NOTE
  // ──────────────────────────────────────────────────────────────────────────

  const noteY = H - 20;
  drawLine(currentPage, H, ML, ML + UW, noteY, C.border);
  drawText(
    currentPage, H,
    "Representación impresa del comprobante electrónico autorizado por el Servicio de Rentas Internas.",
    ML, noteY + 5, 6, fontR, C.muted, UW
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
