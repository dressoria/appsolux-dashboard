import "@/lib/security/server-only";

import PDFDocument from "pdfkit";

import { applyPdfKitFont } from "@/lib/core/pdfkit-fonts";
import type { ParsedAuthorizedSriInvoice } from "@/lib/core/sri-authorized-xml-parser";

function money(value: string) {
  const parsed = Number(value || "0");
  return Number.isFinite(parsed) ? parsed.toFixed(2) : value || "0.00";
}

function safeText(value: string | undefined) {
  return value?.trim() || "N/A";
}

export async function generateRidePdfFromAuthorizedXml(
  invoice: ParsedAuthorizedSriInvoice
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 36, bottom: 36, left: 36, right: 36 },
      info: {
        Title: `RIDE ${invoice.document.number || invoice.authorization.number}`,
        Author: invoice.emitter.legalName,
        Creator: "Appsolux",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 72;
    const leftX = 36;
    const topY = 36;
    const leftWidth = pageWidth * 0.56;
    const rightWidth = pageWidth - leftWidth - 12;
    const rightX = leftX + leftWidth + 12;

    doc.rect(leftX, topY, leftWidth, 126).stroke("#cbd5e1");
    doc.rect(rightX, topY, rightWidth, 126).stroke("#cbd5e1");

    doc.fontSize(11).fillColor("#0f172a");
    applyPdfKitFont(doc, "bold");
    doc.text(safeText(invoice.emitter.legalName), leftX + 10, topY + 10, { width: leftWidth - 20 });

    doc.fontSize(8.5).fillColor("#334155");
    applyPdfKitFont(doc);
    let currentY = topY + 30;
    const emitterLines = [
      invoice.emitter.tradeName ? `Nombre comercial: ${invoice.emitter.tradeName}` : "",
      `Direccion matriz: ${safeText(invoice.emitter.dirMatriz)}`,
      `Direccion establecimiento: ${safeText(invoice.emitter.dirEstablecimiento)}`,
      `Obligado a llevar contabilidad: ${safeText(invoice.emitter.obligadoContabilidad)}`,
      invoice.emitter.contribuyenteRimpe || "",
      invoice.emitter.agenteRetencion
        ? `Agente de Retencion Resolucion No. ${invoice.emitter.agenteRetencion}`
        : "",
    ].filter(Boolean);

    for (const line of emitterLines) {
      doc.text(line, leftX + 10, currentY, { width: leftWidth - 20 });
      currentY = doc.y + 3;
    }

    doc.fontSize(10).fillColor("#0f172a");
    applyPdfKitFont(doc, "bold");
    doc.text(invoice.document.typeLabel, rightX + 10, topY + 10, {
      width: rightWidth - 20,
      align: "center",
    });

    doc.fontSize(8.5);
    applyPdfKitFont(doc);
    const rightLines = [
      `RUC: ${safeText(invoice.emitter.ruc)}`,
      `Numero: ${safeText(invoice.document.number)}`,
      `Numero autorizacion: ${safeText(invoice.authorization.number)}`,
      `Fecha autorizacion: ${safeText(invoice.authorization.date)}`,
      `Ambiente: ${invoice.authorization.environmentLabel}`,
      `Emision: ${invoice.authorization.emissionLabel}`,
      `Clave de acceso: ${safeText(invoice.authorization.accessKey)}`,
    ];

    currentY = topY + 32;
    for (const line of rightLines) {
      doc.text(line, rightX + 10, currentY, { width: rightWidth - 20 });
      currentY = doc.y + 3;
    }

    const customerY = topY + 142;
    doc.rect(leftX, customerY, pageWidth, 64).stroke("#cbd5e1");
    doc.fontSize(8.5).fillColor("#334155");
    applyPdfKitFont(doc, "bold");
    doc.text("Cliente", leftX + 10, customerY + 8);
    applyPdfKitFont(doc);
    doc.text(`Razon social / Nombres: ${safeText(invoice.customer.name)}`, leftX + 10, customerY + 24, {
      width: pageWidth * 0.5,
    });
    doc.text(`Identificacion: ${safeText(invoice.customer.identification)}`, leftX + 10, customerY + 40, {
      width: pageWidth * 0.5,
    });
    doc.text(`Fecha emision: ${safeText(invoice.document.issueDate)}`, leftX + pageWidth * 0.55, customerY + 24);
    if (invoice.document.guideRemission) {
      doc.text(`Guia remision: ${invoice.document.guideRemission}`, leftX + pageWidth * 0.55, customerY + 40);
    }

    const tableY = customerY + 80;
    const columns = [76, 52, 180, 60, 56, 72];
    const headers = ["Cod.", "Cant.", "Descripcion", "P. Unit.", "Desc.", "Total s/impuesto"];
    const xOffsets = [leftX];
    for (let i = 0; i < columns.length - 1; i += 1) {
      xOffsets.push(xOffsets[i]! + columns[i]!);
    }

    doc.rect(leftX, tableY, pageWidth, 18).fill("#0f4c81");
    headers.forEach((header, index) => {
      doc.fillColor("#ffffff").fontSize(7.5);
      applyPdfKitFont(doc, "bold");
      doc.text(header, xOffsets[index]! + 4, tableY + 5, {
        width: columns[index]! - 8,
        align: index >= 1 ? "right" : "left",
      });
    });

    let rowY = tableY + 18;
    invoice.details.forEach((detail, index) => {
      const rowHeight = 22;
      doc.rect(leftX, rowY, pageWidth, rowHeight).fillAndStroke(
        index % 2 === 0 ? "#ffffff" : "#f8fafc",
        "#e2e8f0"
      );
      const values = [
        safeText(detail.code),
        safeText(detail.quantity),
        safeText(detail.description),
        money(detail.unitPrice),
        money(detail.discount),
        money(detail.subtotalExcludingTax),
      ];

      values.forEach((value, valueIndex) => {
        doc.fillColor("#0f172a").fontSize(7.5);
        applyPdfKitFont(doc);
        doc.text(value, xOffsets[valueIndex]! + 4, rowY + 6, {
          width: columns[valueIndex]! - 8,
          align: valueIndex >= 1 ? "right" : "left",
          ellipsis: true,
        });
      });

      rowY += rowHeight;
    });

    const extraStartY = rowY + 10;
    doc.fontSize(8.5).fillColor("#334155");
    applyPdfKitFont(doc, "bold");
    doc.text("Informacion adicional", leftX, extraStartY);
    applyPdfKitFont(doc);
    let textY = extraStartY + 14;

    if (invoice.additionalFields.length === 0) {
      doc.text("N/A", leftX, textY);
      textY += 16;
    } else {
      for (const field of invoice.additionalFields) {
        doc.text(`${safeText(field.name)}: ${safeText(field.value)}`, leftX, textY, {
          width: pageWidth * 0.58,
        });
        textY = doc.y + 2;
      }
    }

    const paymentText =
      invoice.payments.length > 0
        ? invoice.payments.map((payment) => `${payment.code} - ${payment.label}`).join(" · ")
        : "N/A";
    doc.fontSize(8.5).fillColor("#334155");
    applyPdfKitFont(doc, "bold");
    doc.text("Forma de pago", leftX, textY + 6);
    applyPdfKitFont(doc);
    doc.text(paymentText, leftX, textY + 20, { width: pageWidth * 0.58 });

    const summaryX = leftX + pageWidth * 0.62;
    let summaryY = extraStartY;
    const summaryRows = [
      ...invoice.totals.subtotalTaxed.map((row) => [row.label, money(row.baseAmount)] as const),
      ["SUBTOTAL 0%", money(invoice.totals.subtotalZero)] as const,
      ["SUBTOTAL NO OBJETO DE IVA", money(invoice.totals.subtotalNoObjetoIva)] as const,
      ["SUBTOTAL EXENTO DE IVA", money(invoice.totals.subtotalExentoIva)] as const,
      ["SUBTOTAL SIN IMPUESTOS", money(invoice.totals.subtotalSinImpuestos)] as const,
      ["TOTAL DESCUENTO", money(invoice.totals.totalDescuento)] as const,
      ["ICE", money(invoice.totals.ice)] as const,
      ...invoice.totals.iva.map((row) => [row.label, money(row.value)] as const),
      ["VALOR TOTAL", money(invoice.totals.importeTotal)] as const,
    ];

    summaryRows.forEach(([label, value], index) => {
      const isTotal = index === summaryRows.length - 1;
      doc.fontSize(isTotal ? 9.5 : 8.2).fillColor(isTotal ? "#0f172a" : "#475569");
      applyPdfKitFont(doc, isTotal ? "bold" : "regular");
      doc.text(label, summaryX, summaryY, { width: 120, align: "right" });
      doc.text(value, summaryX + 126, summaryY, { width: 70, align: "right" });
      summaryY += isTotal ? 16 : 13;
    });

    doc.fontSize(7.5).fillColor("#64748b");
    applyPdfKitFont(doc);
    doc.text(
      "Representacion impresa del comprobante electronico autorizado por el SRI.",
      leftX,
      doc.page.height - 34,
      { width: pageWidth, align: "center" }
    );

    doc.end();
  });
}
