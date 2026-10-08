import "@/lib/security/server-only";

import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { RGB } from "pdf-lib";
import type { PDFFont } from "pdf-lib";

import type { ParsedAuthorizedSriInvoice } from "@/lib/core/sri-authorized-xml-parser";

// ── Colors (professional B&W/grey palette) ───────────────────────────────────

const C = {
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  border: rgb(0.65, 0.65, 0.65),
  borderLight: rgb(0.82, 0.82, 0.82),
  text: rgb(0.08, 0.08, 0.08),
  muted: rgb(0.35, 0.35, 0.35),
  headerBg: rgb(0.94, 0.94, 0.94),
  rowOdd: rgb(0.975, 0.975, 0.975),
  totalBg: rgb(0.15, 0.15, 0.15),
};

// ── Coordinate helpers ───────────────────────────────────────────────────────

function pdfY(H: number, fromTop: number): number {
  return H - fromTop;
}

function drawRect(
  page: PDFPage,
  H: number,
  x: number,
  fromTop: number,
  w: number,
  h: number,
  fill?: RGB,
  borderColor?: RGB,
  borderWidth = 0.5,
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
  x1: number,
  x2: number,
  fromTop: number,
  color: RGB = C.borderLight,
  thickness = 0.5,
) {
  page.drawLine({
    start: { x: x1, y: pdfY(H, fromTop) },
    end: { x: x2, y: pdfY(H, fromTop) },
    thickness,
    color,
  });
}

function drawVLine(
  page: PDFPage,
  H: number,
  x: number,
  fromTop1: number,
  fromTop2: number,
  color: RGB = C.borderLight,
  thickness = 0.5,
) {
  page.drawLine({
    start: { x, y: pdfY(H, fromTop1) },
    end: { x, y: pdfY(H, fromTop2) },
    thickness,
    color,
  });
}

function drawText(
  page: PDFPage,
  H: number,
  text: string,
  x: number,
  fromTop: number,
  size: number,
  font: PDFFont,
  color: RGB = C.text,
  maxWidth?: number,
) {
  let t = text;
  if (maxWidth !== undefined && maxWidth > 0) {
    while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) {
      t = t.slice(0, -1);
    }
    if (t.length < text.length) t = t.slice(0, -1) + "…";
  }
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
  boxX: number,
  fromTop: number,
  boxW: number,
  size: number,
  font: PDFFont,
  color: RGB = C.text,
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
  rightX: number,
  fromTop: number,
  size: number,
  font: PDFFont,
  color: RGB = C.text,
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function money(value: string): string {
  const n = parseFloat(value || "0");
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

function formatUnitPrice(value: string): string {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0.00";
  return number.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".00");
}

function safe(value: string | undefined | null): string {
  return value?.trim() || "";
}

const CODE39_DIGIT_PATTERNS: Record<string, string> = {
  "0": "101001101101",
  "1": "110100101011",
  "2": "101100101011",
  "3": "110110010101",
  "4": "101001101011",
  "5": "110100110101",
  "6": "101100110101",
  "7": "101001011011",
  "8": "110100101101",
  "9": "101100101101",
  "*": "100101101101",
};

function drawAccessKeyBarcode(
  page: PDFPage,
  accessKey: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const encoded = `*${accessKey.replace(/\D/g, "")}*`;
  const modules = [...encoded]
    .map((character) => CODE39_DIGIT_PATTERNS[character])
    .filter(Boolean)
    .join("0");
  const moduleWidth = width / modules.length;
  [...modules].forEach((module, index) => {
    if (module === "1") {
      page.drawRectangle({
        x: x + index * moduleWidth,
        y,
        width: Math.max(moduleWidth, 0.2),
        height,
        color: C.black,
      });
    }
  });
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
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

function drawLabelValue(
  page: PDFPage,
  H: number,
  label: string,
  value: string,
  x: number,
  y: number,
  fontB: PDFFont,
  fontR: PDFFont,
  maxWidth: number,
  labelSize = 7.5,
  valueSize = 7.5,
): number {
  drawText(page, H, label, x, y, labelSize, fontB, C.text);
  const labelW = fontB.widthOfTextAtSize(label, labelSize);
  drawText(page, H, value, x + labelW + 3, y, valueSize, fontR, C.text, maxWidth - labelW - 3);
  return y + valueSize + 3;
}

// ── RIDE layout constants ────────────────────────────────────────────────────

const A4W = 595.28;
const A4H = 841.89;
const ML = 28;
const MR = 28;
const UW = A4W - ML - MR;
const GAP = 8;

const TABLE_COLS = [
  { label: "No.", w: 26 },
  { label: "Código", w: 62 },
  { label: "Cant.", w: 40 },
  { label: "Descripción", w: 245 },
  { label: "Precio U.", w: 62 },
  { label: "Desc.", w: 50 },
  { label: "Total", w: 54 },
] as const;

// ── Main generator ───────────────────────────────────────────────────────────

export type RideLogoInput = {
  bytes: Uint8Array;
  mimeType: string;
};

export async function generateRidePdfFromAuthorizedXml(
  invoice: ParsedAuthorizedSriInvoice,
  logo?: RideLogoInput | null,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(
    `RIDE ${invoice.document.number || invoice.authorization.number}`,
  );
  pdfDoc.setCreator("FACTUROM COM");
  pdfDoc.setProducer("FACTUROM COM");

  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let embeddedLogo: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (logo?.bytes && logo.bytes.length > 0) {
    try {
      if (logo.mimeType === "image/png") {
        embeddedLogo = await pdfDoc.embedPng(logo.bytes);
      } else {
        embeddedLogo = await pdfDoc.embedJpg(logo.bytes);
      }
    } catch {
      // Logo embedding failed — continue without logo
    }
  }

  const colsRaw = TABLE_COLS.map((column) => column.w);
  const rawSum = colsRaw.reduce((a, b) => a + b, 0);
  const scaleF = UW / rawSum;
  const colWidths = colsRaw.map((w) => Math.round(w * scaleF));
  const wSum = colWidths.reduce((a, b) => a + b, 0);
  colWidths[colWidths.length - 1]! += UW - wSum;

  const TABLE_HEADER_H = 16;
  const TABLE_ROW_H = 16;

  let currentPage = pdfDoc.addPage([A4W, A4H]);
  const H = A4H;
  currentPage.drawRectangle({ x: 0, y: 0, width: A4W, height: A4H, color: C.white });

  let Y = 0;

  function ensureSpace(needed: number): PDFPage {
    if (Y + needed > H - 50) {
      currentPage = pdfDoc.addPage([A4W, A4H]);
      currentPage.drawRectangle({ x: 0, y: 0, width: A4W, height: A4H, color: C.white });
      Y = 22;
    }
    return currentPage;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // A. HEADER — two equal-width boxes
  // ────────────────────────────────────────────────────────────────────────────

  Y = 24;
  const headerTop = Y;
  const halfW = Math.round((UW - GAP) / 2);
  const leftW = halfW;
  const rightX = ML + halfW + GAP;
  const rightW = halfW;

  // Measure left panel content height
  const legalName = safe(invoice.emitter.legalName).toUpperCase();
  const tradeName = safe(invoice.emitter.tradeName);
  const dirMatriz = safe(invoice.emitter.dirMatriz);
  const dirEstab = safe(invoice.emitter.dirEstablecimiento);
  const obCont = safe(invoice.emitter.obligadoContabilidad);
  const rimpe = safe(invoice.emitter.contribuyenteRimpe);
  const contribEspecial = ""; // Not in parsed data — leave empty if not present
  const agente = safe(invoice.emitter.agenteRetencion);

  let leftEstimate = 10;
  const logoMaxH = 50;
  if (embeddedLogo) leftEstimate += logoMaxH + 6;
  if (legalName) leftEstimate += 14;
  if (tradeName) leftEstimate += 11;
  if (dirMatriz) leftEstimate += 10 + wrapText(dirMatriz, fontR, 7.5, leftW - 20).length * 10;
  if (dirEstab && dirEstab !== dirMatriz) leftEstimate += 10 + wrapText(dirEstab, fontR, 7.5, leftW - 20).length * 10;
  leftEstimate += 12; // contribuyente especial + contabilidad
  if (rimpe) leftEstimate += 11;
  if (agente) leftEstimate += 11;
  leftEstimate += 6;

  const rightEstimate = 170;
  const headerH = Math.max(leftEstimate, rightEstimate, 150);

  drawRect(currentPage, H, ML, headerTop, leftW, headerH, C.white, C.border, 0.8);
  drawRect(currentPage, H, rightX, headerTop, rightW, headerH, C.white, C.border, 0.8);

  // ── Left panel ──

  let lY = headerTop + 8;
  const lPad = ML + 10;
  const lInnerW = leftW - 20;

  if (embeddedLogo) {
    const origW = embeddedLogo.width;
    const origH = embeddedLogo.height;
    const maxLogoW = lInnerW * 0.5;
    const scale = Math.min(maxLogoW / origW, logoMaxH / origH, 1);
    const drawW = origW * scale;
    const drawH = origH * scale;
    const logoX = lPad;
    currentPage.drawImage(embeddedLogo, {
      x: logoX,
      y: pdfY(H, lY + drawH),
      width: drawW,
      height: drawH,
    });
    lY += drawH + 6;
  }

  if (legalName) {
    const lnLines = wrapText(legalName, fontB, 10, lInnerW);
    for (const l of lnLines) {
      drawText(currentPage, H, l, lPad, lY, 10, fontB, C.text);
      lY += 13;
    }
  }
  if (tradeName && tradeName.toUpperCase() !== legalName) {
    drawText(currentPage, H, tradeName, lPad, lY, 8, fontR, C.muted, lInnerW);
    lY += 11;
  }

  lY += 2;

  if (dirMatriz) {
    drawText(currentPage, H, "DIRECCIÓN:", lPad, lY, 7, fontB, C.text);
    lY += 9;
    const dmLines = wrapText(dirMatriz, fontR, 7.5, lInnerW);
    for (const l of dmLines) {
      drawText(currentPage, H, l, lPad, lY, 7.5, fontR, C.text);
      lY += 10;
    }
  }
  if (dirEstab && dirEstab !== dirMatriz) {
    drawText(currentPage, H, "DIR. SUCURSAL:", lPad, lY, 7, fontB, C.text);
    lY += 9;
    const deLines = wrapText(dirEstab, fontR, 7.5, lInnerW);
    for (const l of deLines) {
      drawText(currentPage, H, l, lPad, lY, 7.5, fontR, C.text);
      lY += 10;
    }
  }

  lY += 2;

  drawText(
    currentPage, H,
    `CONTRIBUYENTE ESPECIAL Nro.: ${contribEspecial || "NO"}`,
    lPad, lY, 7.5, fontR, C.text, lInnerW,
  );
  lY += 10;

  const obContLabel = (obCont.toUpperCase() === "SI" || obCont.toUpperCase() === "SÍ") ? "SI" : "NO";
  drawText(
    currentPage, H,
    `OBLIGADO A LLEVAR CONTABILIDAD: ${obContLabel}`,
    lPad, lY, 7.5, fontR, C.text, lInnerW,
  );
  lY += 10;

  if (rimpe) {
    drawText(currentPage, H, rimpe, lPad, lY, 7.5, fontR, C.text, lInnerW);
    lY += 10;
  }
  if (agente) {
    drawText(currentPage, H, `Agente de Retención Res. No. ${agente}`, lPad, lY, 7.5, fontR, C.text, lInnerW);
  }

  // ── Right panel ──

  let rY = headerTop + 10;
  const rPad = rightX + 10;
  const rInnerW = rightW - 20;

  drawTextCentered(currentPage, H, `R.U.C.: ${safe(invoice.emitter.ruc)}`, rightX, rY, rightW, 9, fontB);
  rY += 16;

  drawTextCentered(
    currentPage, H,
    safe(invoice.document.typeLabel) || "F A C T U R A",
    rightX, rY, rightW, 13, fontB,
  );
  rY += 18;

  drawTextCentered(currentPage, H, `No: ${safe(invoice.document.number)}`, rightX, rY, rightW, 9, fontB);
  rY += 14;

  drawLine(currentPage, H, rPad, rightX + rightW - 10, rY, C.border, 0.5);
  rY += 6;

  drawTextCentered(currentPage, H, "NÚMERO DE AUTORIZACIÓN", rightX, rY, rightW, 6.5, fontB, C.muted);
  rY += 9;
  const authNum = safe(invoice.authorization.number);
  const anFS = 5.5;
  const anW = fontR.widthOfTextAtSize(authNum, anFS);
  if (anW <= rInnerW) {
    drawTextCentered(currentPage, H, authNum, rightX, rY, rightW, anFS, fontR);
    rY += 8;
  } else {
    const mid = Math.ceil(authNum.length / 2);
    drawTextCentered(currentPage, H, authNum.slice(0, mid), rightX, rY, rightW, anFS, fontR);
    rY += 7;
    drawTextCentered(currentPage, H, authNum.slice(mid), rightX, rY, rightW, anFS, fontR);
    rY += 8;
  }

  rY += 2;
  drawText(currentPage, H, "FECHA Y HORA DE AUTORIZACIÓN:", rPad, rY, 6.5, fontB, C.muted, rInnerW);
  rY += 9;
  drawText(currentPage, H, safe(invoice.authorization.date), rPad, rY, 7.5, fontR, C.text, rInnerW);
  rY += 11;

  drawText(currentPage, H, `AMBIENTE: ${safe(invoice.authorization.environmentLabel)}`, rPad, rY, 7.5, fontR, C.text, rInnerW);
  rY += 10;
  drawText(currentPage, H, `EMISIÓN: ${safe(invoice.authorization.emissionLabel)}`, rPad, rY, 7.5, fontR, C.text, rInnerW);
  rY += 12;

  drawLine(currentPage, H, rPad, rightX + rightW - 10, rY, C.border, 0.5);
  rY += 5;
  drawTextCentered(currentPage, H, "CLAVE DE ACCESO", rightX, rY, rightW, 6.5, fontB, C.muted);
  rY += 9;

  const accessKey = safe(invoice.authorization.accessKey);
  if (accessKey) {
    const barW = rInnerW - 10;
    const barX = rPad + 5;
    drawAccessKeyBarcode(currentPage, accessKey, barX, pdfY(H, rY + 16), barW, 16);
    rY += 20;

    const akFS = 4.8;
    const akW = fontR.widthOfTextAtSize(accessKey, akFS);
    if (akW <= rInnerW) {
      drawTextCentered(currentPage, H, accessKey, rightX, rY, rightW, akFS, fontR, C.muted);
    } else {
      const mid = Math.ceil(accessKey.length / 2);
      drawTextCentered(currentPage, H, accessKey.slice(0, mid), rightX, rY, rightW, akFS, fontR, C.muted);
      rY += 6;
      drawTextCentered(currentPage, H, accessKey.slice(mid), rightX, rY, rightW, akFS, fontR, C.muted);
    }
  }

  Y = headerTop + headerH + 6;

  // ────────────────────────────────────────────────────────────────────────────
  // B. CUSTOMER DATA
  // ────────────────────────────────────────────────────────────────────────────

  const custPad = ML + 8;
  const custInnerW = UW - 16;
  const custHalfW = Math.floor(custInnerW / 2);

  let custH = 8;
  custH += 12; // razón social
  custH += 12; // RUC/CI
  custH += 12; // fecha + placa + guía
  custH += 12; // dirección
  custH += 8;

  drawRect(currentPage, H, ML, Y, UW, custH, C.white, C.border, 0.8);

  let cY = Y + 8;

  cY = drawLabelValue(currentPage, H, "RAZÓN SOCIAL: ", safe(invoice.customer.name), custPad, cY, fontB, fontR, custInnerW);
  cY += 1;

  cY = drawLabelValue(currentPage, H, "RUC/CI: ", safe(invoice.customer.identification), custPad, cY, fontB, fontR, custHalfW);
  cY += 1;

  const issueDate = safe(invoice.document.issueDate);
  const guia = safe(invoice.document.guideRemission);

  drawText(currentPage, H, "FECHA DE EMISIÓN: ", custPad, cY, 7.5, fontB, C.text);
  const feLabelW = fontB.widthOfTextAtSize("FECHA DE EMISIÓN: ", 7.5);
  drawText(currentPage, H, issueDate, custPad + feLabelW, cY, 7.5, fontR, C.text);

  const col2Start = custPad + custHalfW;
  drawText(currentPage, H, "PLACA: ", col2Start, cY, 7.5, fontB, C.text);
  const placaLW = fontB.widthOfTextAtSize("PLACA: ", 7.5);
  drawText(currentPage, H, "", col2Start + placaLW, cY, 7.5, fontR, C.text);

  const col3Start = col2Start + 90;
  drawText(currentPage, H, "GUÍA DE REMISIÓN: ", col3Start, cY, 7.5, fontB, C.text);
  const guiaLW = fontB.widthOfTextAtSize("GUÍA DE REMISIÓN: ", 7.5);
  drawText(currentPage, H, guia, col3Start + guiaLW, cY, 7.5, fontR, C.text);
  cY += 11;

  const dirAdditional = invoice.additionalFields.find(
    (f) => f.name.toLowerCase().includes("direc") || f.name.toLowerCase().includes("address"),
  );
  const custAddress = invoice.customer.address || dirAdditional?.value || "";
  drawLabelValue(currentPage, H, "DIRECCIÓN: ", custAddress, custPad, cY, fontB, fontR, custInnerW);

  Y += custH + 4;

  // ────────────────────────────────────────────────────────────────────────────
  // C. DETAIL TABLE
  // ────────────────────────────────────────────────────────────────────────────

  drawRect(currentPage, H, ML, Y, UW, TABLE_HEADER_H, C.headerBg, C.border, 0.5);

  const colLabels = TABLE_COLS.map((c) => c.label);
  let colX = ML;
  const colXPositions: number[] = [];

  for (let i = 0; i < colWidths.length; i++) {
    colXPositions.push(colX);
    const w = colWidths[i]!;
    drawTextCentered(currentPage, H, colLabels[i]!, colX, Y + 4, w, 6.5, fontB, C.text);
    colX += w;
  }

  for (let i = 1; i < colXPositions.length; i++) {
    drawVLine(currentPage, H, colXPositions[i]!, Y, Y + TABLE_HEADER_H, C.border, 0.3);
  }

  Y += TABLE_HEADER_H;

  function drawTableHeaderOnNewPage(pg: PDFPage) {
    drawRect(pg, H, ML, Y, UW, TABLE_HEADER_H, C.headerBg, C.border, 0.5);
    for (let i = 0; i < colWidths.length; i++) {
      drawTextCentered(pg, H, colLabels[i]!, colXPositions[i]!, Y + 4, colWidths[i]!, 6.5, fontB, C.text);
    }
    for (let i = 1; i < colXPositions.length; i++) {
      drawVLine(pg, H, colXPositions[i]!, Y, Y + TABLE_HEADER_H, C.border, 0.3);
    }
    Y += TABLE_HEADER_H;
  }

  for (let rowIdx = 0; rowIdx < invoice.details.length; rowIdx++) {
    const pg = ensureSpace(TABLE_ROW_H);
    if (Y === 22) {
      drawTableHeaderOnNewPage(pg);
    }
    const det = invoice.details[rowIdx]!;
    const bg = rowIdx % 2 === 1 ? C.rowOdd : C.white;

    drawRect(pg, H, ML, Y, UW, TABLE_ROW_H, bg);
    drawLine(pg, H, ML, ML + UW, Y + TABLE_ROW_H, C.borderLight, 0.3);

    for (let i = 1; i < colXPositions.length; i++) {
      drawVLine(pg, H, colXPositions[i]!, Y, Y + TABLE_ROW_H, C.borderLight, 0.2);
    }

    const cellY = Y + 4;
    const fs = 7;

    drawTextRight(pg, H, String(rowIdx + 1), colXPositions[0]! + colWidths[0]! - 4, cellY, fs, fontR);
    drawText(pg, H, safe(det.code), colXPositions[1]! + 3, cellY, fs, fontR, C.text, colWidths[1]! - 6);
    drawTextRight(pg, H, safe(det.quantity), colXPositions[2]! + colWidths[2]! - 4, cellY, fs, fontR);
    drawText(pg, H, safe(det.description), colXPositions[3]! + 3, cellY, fs, fontR, C.text, colWidths[3]! - 6);
    drawTextRight(pg, H, formatUnitPrice(det.unitPrice), colXPositions[4]! + colWidths[4]! - 4, cellY, fs, fontR);
    drawTextRight(pg, H, money(det.discount), colXPositions[5]! + colWidths[5]! - 4, cellY, fs, fontR);
    drawTextRight(pg, H, money(det.subtotalExcludingTax), colXPositions[6]! + colWidths[6]! - 4, cellY, fs, fontB);

    Y += TABLE_ROW_H;
  }

  // Bottom border of table
  drawLine(currentPage, H, ML, ML + UW, Y, C.border, 0.5);
  Y += 6;

  // ────────────────────────────────────────────────────────────────────────────
  // D. FOOTER: info adicional + forma de pago (60%) | totales (40%)
  // ────────────────────────────────────────────────────────────────────────────

  if (Y + 180 > H - 40) {
    currentPage = pdfDoc.addPage([A4W, A4H]);
    currentPage.drawRectangle({ x: 0, y: 0, width: A4W, height: A4H, color: C.white });
    Y = 22;
  }

  const footerTop = Y;
  const footerLeftW = Math.round(UW * 0.58);
  const footerRightX = ML + footerLeftW + GAP;
  const footerRightW = UW - footerLeftW - GAP;

  // ── Left: Info adicional ──

  let flY = footerTop;

  drawRect(currentPage, H, ML, flY, footerLeftW, 14, C.headerBg, C.border, 0.5);
  drawText(currentPage, H, "INFORMACIÓN ADICIONAL", ML + 6, flY + 3, 7, fontB, C.text);
  flY += 16;

  const fieldsToShow = invoice.additionalFields.filter(
    (f) => !f.name.toLowerCase().includes("direc") && !f.name.toLowerCase().includes("address"),
  );

  const infoBoxTop = flY;

  if (fieldsToShow.length === 0) {
    drawText(currentPage, H, "—", ML + 6, flY, 7, fontR, C.muted);
    flY += 10;
  } else {
    for (const field of fieldsToShow.slice(0, 10)) {
      const line = `${safe(field.name)}: ${safe(field.value)}`;
      drawText(currentPage, H, line, ML + 6, flY, 7, fontR, C.text, footerLeftW - 12);
      flY += 10;
    }
  }

  const infoBoxH = flY - infoBoxTop + 4;
  drawRect(currentPage, H, ML, infoBoxTop - 2, footerLeftW, infoBoxH, undefined, C.border, 0.5);
  flY += 6;

  // ── Left: Forma de pago ──

  drawRect(currentPage, H, ML, flY, footerLeftW, 14, C.headerBg, C.border, 0.5);
  drawText(currentPage, H, "FORMA DE PAGO", ML + 6, flY + 3, 7, fontB, C.text);
  flY += 16;

  const payColWidths = [30, footerLeftW - 30 - 70 - 50, 70, 50];
  const payHeaders = ["COD", "FORMA DE PAGO", "VALOR", "PLAZO"];

  drawRect(currentPage, H, ML, flY - 2, footerLeftW, 12, C.headerBg, C.borderLight, 0.3);
  let payX = ML + 4;
  for (let i = 0; i < payHeaders.length; i++) {
    drawText(currentPage, H, payHeaders[i]!, payX, flY, 6, fontB, C.muted);
    payX += payColWidths[i]!;
  }
  flY += 11;

  const payBoxTop = flY;

  if (invoice.payments.length === 0) {
    drawText(currentPage, H, "—", ML + 6, flY, 7, fontR, C.muted);
    flY += 10;
  } else {
    for (const pmt of invoice.payments) {
      payX = ML + 4;
      drawText(currentPage, H, pmt.code, payX, flY, 7, fontR, C.text);
      payX += payColWidths[0]!;
      drawText(currentPage, H, pmt.label || pmt.code, payX, flY, 7, fontR, C.text, payColWidths[1]! - 4);
      payX += payColWidths[1]!;
      drawTextRight(currentPage, H, `$${money(pmt.amount)}`, payX + payColWidths[2]! - 4, flY, 7, fontR);
      payX += payColWidths[2]!;
      drawText(currentPage, H, `${pmt.term} ${pmt.timeUnit}`, payX, flY, 7, fontR, C.text);
      flY += 10;
    }
  }

  const payBoxH = flY - payBoxTop + 4;
  drawRect(currentPage, H, ML, payBoxTop - 2, footerLeftW, payBoxH, undefined, C.border, 0.5);

  // ── Right: Totals ──

  type SummaryRow = { label: string; value: string; isTotal?: boolean };

  const summaryRows: SummaryRow[] = [
    ...invoice.totals.subtotalTaxed.map((r) => ({ label: r.label, value: r.baseAmount })),
    { label: "SUBTOTAL 0%", value: invoice.totals.subtotalZero },
    { label: "SUBTOTAL NO OBJETO DE IVA", value: invoice.totals.subtotalNoObjetoIva },
    { label: "SUBTOTAL EXENTO DE IVA", value: invoice.totals.subtotalExentoIva },
    { label: "SUBTOTAL SIN IMPUESTOS", value: invoice.totals.subtotalSinImpuestos },
    { label: "TOTAL DESCUENTO", value: invoice.totals.totalDescuento },
    { label: "ICE", value: invoice.totals.ice },
    { label: "IRBPNR", value: invoice.totals.irbpnr },
    ...invoice.totals.iva.map((r) => ({ label: r.label, value: r.value })),
    { label: "PROPINA", value: invoice.totals.propina },
    { label: "VALOR TOTAL", value: invoice.totals.importeTotal, isTotal: true },
  ];

  let frY = footerTop;
  const frLabelX = footerRightX + 6;
  const frValueX = footerRightX + footerRightW - 6;

  drawRect(currentPage, H, footerRightX, frY, footerRightW, 14, C.headerBg, C.border, 0.5);
  drawTextCentered(currentPage, H, "TOTALES", footerRightX, frY + 3, footerRightW, 7, fontB, C.text);
  frY += 16;

  for (const row of summaryRows) {
    const fs = row.isTotal ? 8.5 : 7;
    const rowH = row.isTotal ? 16 : 12;
    const f = row.isTotal ? fontB : fontR;
    const color = row.isTotal ? C.white : C.text;
    const labelColor = row.isTotal ? C.white : C.muted;

    if (row.isTotal) {
      drawRect(currentPage, H, footerRightX, frY, footerRightW, rowH, C.totalBg, C.totalBg, 0);
    } else {
      drawLine(currentPage, H, footerRightX, footerRightX + footerRightW, frY + rowH, C.borderLight, 0.3);
    }

    drawText(currentPage, H, row.label, frLabelX, frY + 2, fs, f, labelColor, footerRightW * 0.65);
    drawTextRight(currentPage, H, `$${money(row.value)}`, frValueX, frY + 2, fs, f, color);

    frY += rowH;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // E. FOOTER NOTE
  // ────────────────────────────────────────────────────────────────────────────

  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    const noteY = H - 22;
    drawLine(page, H, ML, ML + UW, noteY, C.borderLight);
    drawText(page, H, "GENERADO POR FACTUROM COM", ML, noteY + 5, 6, fontB, C.muted, UW / 2);
    drawTextRight(page, H, `Página ${index + 1} de ${pages.length}`, ML + UW, noteY + 5, 6, fontR, C.muted);
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
