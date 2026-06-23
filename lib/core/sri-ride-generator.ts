import "@/lib/security/server-only";

import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import { applyPdfKitFont } from "@/lib/core/pdfkit-fonts";

// ── Tipos de entrada ──────────────────────────────────────────────────────────

export type RideEmitter = {
  legalName: string;
  tradeName: string | null;
  ruc: string;
  dirMatriz: string | null;
  contribuyenteRimpe: string | null;
  accountingRequired: boolean;
};

export type RideCustomer = {
  name: string;
  identification: string | null;
  email: string | null;
};

export type RideLine = {
  itemCode: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
};

export type RideData = {
  environment: "TEST" | "PRODUCTION";
  documentType: string;
  establishmentCode: string;
  issuePointCode: string;
  sequentialNumber: number;
  accessKey: string;
  authorizationNumber: string;
  authorizedAt: Date;
  issuedAt: Date;
  emitter: RideEmitter;
  customer: RideCustomer;
  lines: RideLine[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function money(n: number): string {
  return n.toFixed(2);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Guayaquil",
  });
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Guayaquil",
  });
}

function docTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    INVOICE: "FACTURA",
    CREDIT_NOTE: "NOTA DE CRÉDITO",
    DEBIT_NOTE: "NOTA DE DÉBITO",
    WITHHOLDING: "COMPROBANTE DE RETENCIÓN",
    DELIVERY_NOTE: "GUÍA DE REMISIÓN",
  };
  return labels[type] ?? type;
}

function displayNumber(estab: string, pto: string, seq: number): string {
  return `${estab.padStart(3, "0")}-${pto.padStart(3, "0")}-${String(seq).padStart(9, "0")}`;
}

// ── Generación del PDF ────────────────────────────────────────────────────────

const BLUE = "#0052CC";
const GRAY_DARK = "#1A1A2E";
const GRAY_MED = "#4A4A68";
const GRAY_LIGHT = "#F5F7FA";
const BORDER = "#D0D5DD";

export async function generateRidePdf(data: RideData): Promise<Buffer> {
  const qrPng = await QRCode.toBuffer(data.accessKey, {
    width: 100,
    margin: 1,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 36, bottom: 36, left: 40, right: 40 },
      info: {
        Title: `RIDE - ${docTypeLabel(data.documentType)} ${displayNumber(data.establishmentCode, data.issuePointCode, data.sequentialNumber)}`,
        Author: data.emitter.legalName,
        Creator: "Appsolux / Bionvers",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width - 80; // usable width
    const leftX = 40;

    // ── Cabecera ────────────────────────────────────────────────────────────

    // Bloque izquierdo: datos del emisor
    doc
      .rect(leftX, 36, pageW * 0.62, 120)
      .fillColor(GRAY_LIGHT)
      .fill()
      .stroke(BORDER);

    doc
      .fillColor(BLUE)
      .fontSize(11)
      ;
    applyPdfKitFont(doc, "bold");
    doc
      .text(data.emitter.legalName.toUpperCase(), leftX + 8, 44, {
        width: pageW * 0.62 - 16,
      });

    if (data.emitter.tradeName) {
      doc
        .fillColor(GRAY_MED)
        .fontSize(8)
        ;
      applyPdfKitFont(doc);
      doc.text(data.emitter.tradeName.toUpperCase(), leftX + 8, doc.y + 2, {
          width: pageW * 0.62 - 16,
        });
    }

    doc
      .fillColor(GRAY_DARK)
      .fontSize(8)
      ;
    applyPdfKitFont(doc);
    doc
      .text(`RUC: ${data.emitter.ruc}`, leftX + 8, doc.y + 4)
      .text(
        `Dirección Matriz: ${data.emitter.dirMatriz ?? "—"}`,
        leftX + 8,
        doc.y + 2,
        { width: pageW * 0.62 - 16 }
      );

    if (data.emitter.contribuyenteRimpe) {
      doc
        .fontSize(7.5)
        .text(data.emitter.contribuyenteRimpe, leftX + 8, doc.y + 2, {
          width: pageW * 0.62 - 16,
        });
    }

    doc
      .fontSize(8)
      .text(
        `Obligado a llevar contabilidad: ${data.emitter.accountingRequired ? "SI" : "NO"}`,
        leftX + 8,
        doc.y + 2
      );

    // Bloque derecho: tipo documento + número + ambiente
    const rightX = leftX + pageW * 0.62 + 8;
    const rightW = pageW * 0.38 - 8;

    doc
      .rect(rightX, 36, rightW, 120)
      .fillColor(BLUE)
      .fill()
      .stroke(BORDER);

    doc
      .fillColor("#FFFFFF")
      .fontSize(9)
      ;
    applyPdfKitFont(doc, "bold");
    doc.text(docTypeLabel(data.documentType), rightX + 4, 46, {
        width: rightW - 8,
        align: "center",
      });

    doc
      .fontSize(12)
      ;
    applyPdfKitFont(doc, "bold");
    doc.text(
        displayNumber(data.establishmentCode, data.issuePointCode, data.sequentialNumber),
        rightX + 4,
        doc.y + 4,
        { width: rightW - 8, align: "center" }
      );

    doc
      .fontSize(7.5)
      ;
    applyPdfKitFont(doc);
    doc.text(
        data.environment === "TEST" ? "AMBIENTE: PRUEBAS" : "AMBIENTE: PRODUCCIÓN",
        rightX + 4,
        doc.y + 6,
        { width: rightW - 8, align: "center" }
      )
      .text("EMISIÓN NORMAL", rightX + 4, doc.y + 2, {
        width: rightW - 8,
        align: "center",
      });

    // ── Clave de acceso + QR ────────────────────────────────────────────────

    const claveY = 166;

    doc
      .rect(leftX, claveY, pageW, 44)
      .fillColor(GRAY_LIGHT)
      .fill()
      .stroke(BORDER);

    doc
      .fillColor(GRAY_MED)
      .fontSize(7)
      ;
    applyPdfKitFont(doc, "bold");
    doc.text("CLAVE DE ACCESO", leftX + 8, claveY + 6);

    doc
      .fillColor(GRAY_DARK)
      .fontSize(7.5)
      ;
    applyPdfKitFont(doc);
    doc.text(data.accessKey, leftX + 8, claveY + 16, { width: pageW - 120 });

    // QR code a la derecha
    doc.image(qrPng, leftX + pageW - 100, claveY - 10, { width: 90, height: 90 });

    // ── Número de autorización ──────────────────────────────────────────────

    const authY = claveY + 52;

    doc
      .rect(leftX, authY, pageW, 40)
      .fillColor("#FFFFFF")
      .fill()
      .stroke(BORDER);

    doc
      .fillColor(GRAY_MED)
      .fontSize(7)
      ;
    applyPdfKitFont(doc, "bold");
    doc.text("NÚMERO DE AUTORIZACIÓN", leftX + 8, authY + 5);

    doc
      .fillColor(GRAY_DARK)
      .fontSize(8.5)
      ;
    applyPdfKitFont(doc, "bold");
    doc.text(data.authorizationNumber, leftX + 8, authY + 15);

    doc
      .fillColor(GRAY_MED)
      .fontSize(7.5)
      ;
    applyPdfKitFont(doc);
    doc.text(
        `Fecha de autorización: ${fmtDateTime(data.authorizedAt)}`,
        leftX + 8,
        authY + 27
      );

    // ── Datos del comprador ─────────────────────────────────────────────────

    const buyerY = authY + 48;

    doc
      .rect(leftX, buyerY, pageW, 52)
      .fillColor(GRAY_LIGHT)
      .fill()
      .stroke(BORDER);

    doc
      .fillColor(GRAY_MED)
      .fontSize(7)
      ;
    applyPdfKitFont(doc, "bold");
    doc.text("DATOS DEL COMPRADOR", leftX + 8, buyerY + 5);

    const halfW = pageW / 2 - 12;

    doc
      .fillColor(GRAY_DARK)
      .fontSize(8)
      ;
    applyPdfKitFont(doc);
    doc.text(`Razón social / Nombres: ${data.customer.name}`, leftX + 8, buyerY + 16, {
        width: halfW,
      })
      .text(
        `Identificación: ${data.customer.identification ?? "Consumidor Final"}`,
        leftX + 8,
        buyerY + 28
      )
      .text(`Fecha emisión: ${fmtDate(data.issuedAt)}`, leftX + 8, buyerY + 40);

    if (data.customer.email) {
      doc.text(
        `Email: ${data.customer.email}`,
        leftX + halfW + 16,
        buyerY + 16,
        { width: halfW }
      );
    }

    // ── Tabla de items ──────────────────────────────────────────────────────

    const tableY = buyerY + 60;
    const colWidths = [60, 0, 50, 60, 55, 50, 55]; // [code, name(flexible), qty, unitPrice, disc, taxRate, total]
    colWidths[1] = pageW - colWidths.reduce((a, b) => a + b, 0); // name takes remaining space

    const headers = ["Cód.", "Descripción", "Cant.", "P. Unit.", "Desc.", "IVA%", "Total"];
    const colX: number[] = [leftX];
    for (let i = 0; i < colWidths.length - 1; i++) {
      colX.push(colX[i]! + colWidths[i]!);
    }

    // Header row
    doc
      .rect(leftX, tableY, pageW, 16)
      .fillColor(BLUE)
      .fill();

    headers.forEach((h, i) => {
      doc
        .fillColor("#FFFFFF")
        .fontSize(7)
        ;
      applyPdfKitFont(doc, "bold");
      doc.text(h, colX[i]! + 2, tableY + 4, {
          width: colWidths[i]! - 4,
          align: i >= 2 ? "right" : "left",
        });
    });

    // Data rows
    let rowY = tableY + 16;
    data.lines.forEach((line, idx) => {
      const rowH = 18;
      doc
        .rect(leftX, rowY, pageW, rowH)
        .fillColor(idx % 2 === 0 ? "#FFFFFF" : GRAY_LIGHT)
        .fill()
        .stroke(BORDER);

      const cells = [
        line.itemCode ?? "",
        line.itemName,
        String(line.quantity),
        money(line.unitPrice),
        money(line.discountAmount),
        `${line.taxRate}%`,
        money(line.total),
      ];

      cells.forEach((cell, i) => {
        doc
          .fillColor(GRAY_DARK)
          .fontSize(7.5)
          ;
        applyPdfKitFont(doc);
        doc.text(cell, colX[i]! + 2, rowY + 4, {
            width: colWidths[i]! - 4,
            align: i >= 2 ? "right" : "left",
            ellipsis: true,
          });
      });

      rowY += rowH;
    });

    // ── Totales ─────────────────────────────────────────────────────────────

    const totalsY = rowY + 8;
    const totalsLabelX = leftX + pageW - 200;
    const totalsValueX = leftX + pageW - 80;

    const totals = [
      ["Subtotal sin impuestos:", money(data.subtotal)],
      ["Descuento:", money(data.discountTotal)],
      ["IVA:", money(data.taxTotal)],
    ];

    let ty = totalsY;
    totals.forEach(([label, value]) => {
      doc
        .fillColor(GRAY_MED)
        .fontSize(8)
        ;
      applyPdfKitFont(doc);
      doc.text(label!, totalsLabelX, ty, { width: 120, align: "right" });
      doc
        .fillColor(GRAY_DARK)
        .text(value!, totalsValueX, ty, { width: 70, align: "right" });
      ty += 14;
    });

    // Total general
    doc
      .rect(totalsLabelX - 4, ty, 200, 20)
      .fillColor(BLUE)
      .fill();

    doc
      .fillColor("#FFFFFF")
      .fontSize(9)
      ;
    applyPdfKitFont(doc, "bold");
    doc.text("TOTAL:", totalsLabelX, ty + 5, { width: 120, align: "right" })
      .text(`$${money(data.grandTotal)}`, totalsValueX, ty + 5, {
        width: 70,
        align: "right",
      });

    ty += 28;

    // Forma de pago
    doc
      .fillColor(GRAY_MED)
      .fontSize(8)
      ;
    applyPdfKitFont(doc);
    doc.text(`Forma de pago: ${data.paymentMethod}`, leftX, ty);

    // ── Pie de página ────────────────────────────────────────────────────────

    ty += 20;

    doc
      .rect(leftX, ty, pageW, 1)
      .fillColor(BORDER)
      .fill();

    doc
      .fillColor(GRAY_MED)
      .fontSize(7)
      ;
    applyPdfKitFont(doc);
    doc.text(
        "Representación impresa del comprobante electrónico. Para verificar su validez, consulte: https://srienlinea.sri.gob.ec",
        leftX,
        ty + 6,
        { width: pageW, align: "center" }
      );

    doc.end();
  });
}
