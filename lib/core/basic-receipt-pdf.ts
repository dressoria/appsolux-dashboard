import "@/lib/security/server-only";

import PDFDocument from "pdfkit";

import { applyPdfKitFont } from "@/lib/core/pdfkit-fonts";

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

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
    credit: "Credito / Fiado",
  };

  return labels[method] ?? method;
}

export async function generateBasicReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 42, bottom: 42, left: 40, right: 40 },
      info: {
        Title: `Recibo ${data.saleId}`,
        Author: data.tenantName,
        Creator: "Appsolux",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 80;
    const leftX = 40;
    const shortSaleId = data.saleId.slice(-8);
    const paid = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const pending = Math.max(data.total - paid, 0);

    doc.fillColor("#004080").fontSize(18);
    applyPdfKitFont(doc, "bold");
    doc.text(data.tenantName, leftX, 42, { width: pageWidth });

    doc.fillColor("#0f172a").fontSize(11);
    applyPdfKitFont(doc, "bold");
    doc.text("Recibo interno", leftX, doc.y + 6);

    doc.fillColor("#475569").fontSize(9);
    applyPdfKitFont(doc);
    doc.text(`Venta interna: ${shortSaleId}`, leftX, doc.y + 2);
    doc.text(
      `Fecha: ${data.createdAt.toLocaleString("es-EC", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      leftX,
      doc.y + 2
    );

    doc.roundedRect(leftX, 118, pageWidth, 78, 10).fillAndStroke("#f8fafc", "#e2e8f0");
    doc.fillColor("#0f172a").fontSize(10);
    applyPdfKitFont(doc, "bold");
    doc.text("Cliente", leftX + 14, 132);
    applyPdfKitFont(doc);
    doc.text(data.customerName, leftX + 14, 148);
    applyPdfKitFont(doc, "bold");
    doc.text("Estado", leftX + 240, 132);
    applyPdfKitFont(doc);
    doc.text(`${data.status} · ${data.paymentStatus}`, leftX + 240, 148, { width: 220 });

    const tableY = 220;
    const colWidths = [220, 50, 80, 60, 90];
    const headers = ["Producto", "Cant.", "P. Unit.", "IVA", "Total"];
    const colX = [leftX, leftX + 220, leftX + 270, leftX + 350, leftX + 410];

    doc.rect(leftX, tableY, pageWidth, 18).fill("#004080");
    headers.forEach((header, index) => {
      doc.fillColor("#ffffff").fontSize(8);
      applyPdfKitFont(doc, "bold");
      doc.text(header, colX[index]! + 4, tableY + 5, {
        width: colWidths[index]! - 8,
        align: index === 0 ? "left" : "right",
      });
    });

    let rowY = tableY + 18;
    data.items.forEach((item, index) => {
      const rowHeight = item.discountAmount > 0 ? 28 : 20;

      doc.rect(leftX, rowY, pageWidth, rowHeight).fillAndStroke(
        index % 2 === 0 ? "#ffffff" : "#f8fafc",
        "#e2e8f0"
      );

      doc.fillColor("#0f172a").fontSize(8.5);
      applyPdfKitFont(doc, "bold");
      doc.text(item.productName, colX[0]! + 4, rowY + 5, { width: colWidths[0]! - 8 });

      if (item.discountAmount > 0) {
        doc.fillColor("#64748b").fontSize(7.5);
        applyPdfKitFont(doc);
        doc.text(`Desc. ${money(item.discountAmount)}`, colX[0]! + 4, rowY + 15);
      }

      doc.fillColor("#334155").fontSize(8);
      applyPdfKitFont(doc);
      doc.text(String(item.quantity), colX[1]! + 4, rowY + 5, {
        width: colWidths[1]! - 8,
        align: "right",
      });
      doc.text(money(item.price), colX[2]! + 4, rowY + 5, {
        width: colWidths[2]! - 8,
        align: "right",
      });
      doc.text(item.taxRate > 0 ? `${item.taxRate}%` : "-", colX[3]! + 4, rowY + 5, {
        width: colWidths[3]! - 8,
        align: "right",
      });
      doc.text(money(item.total), colX[4]! + 4, rowY + 5, {
        width: colWidths[4]! - 8,
        align: "right",
      });

      rowY += rowHeight;
    });

    let summaryY = rowY + 14;
    const summaryLeft = leftX + pageWidth - 210;

    const summaryRows = [
      ["Subtotal", money(data.subtotal)],
      ["Descuento", money(data.discountTotal)],
      ["IVA", money(data.taxTotal)],
      ["Total", money(data.total)],
      ["Pagado", money(paid)],
    ];

    summaryRows.forEach(([label, value], index) => {
      const isTotal = label === "Total";
      const isLast = index === summaryRows.length - 1;

      doc.fillColor(isTotal ? "#0f172a" : "#64748b").fontSize(isTotal ? 10 : 9);
      applyPdfKitFont(doc, isTotal ? "bold" : "regular");
      doc.text(label, summaryLeft, summaryY, { width: 90, align: "right" });
      doc.text(value, summaryLeft + 104, summaryY, { width: 90, align: "right" });
      summaryY += isLast ? 18 : 14;
    });

    if (pending > 0) {
      doc.fillColor("#b45309").fontSize(9);
      applyPdfKitFont(doc, "bold");
      doc.text(`Saldo pendiente: ${money(pending)}`, summaryLeft, summaryY, {
        width: 194,
        align: "right",
      });
      summaryY += 18;
    }

    if (data.payments.length > 0) {
      const paymentsLabel = data.payments
        .map((payment) => `${paymentMethodLabel(payment.method)} ${money(payment.amount)}`)
        .join(" · ");

      doc.fillColor("#475569").fontSize(8.5);
      applyPdfKitFont(doc);
      doc.text(`Pagos: ${paymentsLabel}`, leftX, summaryY + 8, { width: pageWidth });
    }

    doc.fillColor("#64748b").fontSize(8);
    applyPdfKitFont(doc);
    doc.text(
      "Recibo interno generado por Appsolux. No corresponde a un comprobante tributario SRI.",
      leftX,
      doc.page.height - 54,
      { width: pageWidth, align: "center" }
    );

    doc.end();
  });
}
