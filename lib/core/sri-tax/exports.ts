import "@/lib/security/server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import ExcelJS from "exceljs";
import type { AtsPeriodData } from "./ats-data";
import { buildAtsSummary, TAX_REPORT_FOOTER } from "./ats-summary";
import type { Iva104Report } from "./iva-104-report";

const shown = (value: string | null) => value ?? "No disponible";
export function atsSummaryLines(data: AtsPeriodData) {
  const report = buildAtsSummary(data);
  return [
    "Facturom — Talón resumen ATS",
    report.company?.legalName ?? "Empresa por completar",
    `RUC: ${report.company?.ruc ?? "Por completar"}`,
    `Período: ${report.period.label} · ${report.period.frequency === "MONTHLY" ? "Mensual" : "Semestral"}`,
    `Ventas: ${report.totals.sales.count} registros | Base ${report.totals.sales.base} | IVA ${report.totals.sales.iva}`,
    `Compras: ${report.totals.purchases.count} registros | Base ${report.totals.purchases.base} | IVA ${report.totals.purchases.iva}`,
    `Retenciones emitidas: ${report.totals.withholdings.count} registros | Valor ${shown(report.totals.withholdings.amount)}`,
    `Documentos cancelados registrados (aplicabilidad ATS por verificar): ${report.totals.cancelled.count}`,
    `Validación interna: ${report.validation.domainStatus}`,
    `XML: ${report.validation.xmlStatus}`,
    `XSD: ${report.validation.xsdStatus}`,
    ...report.validation.issues.map(
      (i) => `${i.severity} ${i.code}: ${i.description}`,
    ),
    TAX_REPORT_FOOTER,
  ];
}

export function ivaReportLines(report: Iva104Report) {
  return [
    "Facturom — Reporte IVA 104 · ESTIMADO",
    report.nature,
    report.company?.legalName ?? "Empresa por completar",
    `RUC: ${report.company?.ruc ?? "Por completar"}`,
    `Período: ${report.period.label}`,
    `Completitud: ${report.completeness.percentage}% (${report.completeness.factors.filter((f) => f.complete).length}/${report.completeness.factors.length} controles)`,
    "A. Resumen de ventas / B. Resumen de compras y gastos",
    "Casilleros | Concepto | Bruto | Neto | IVA",
    ...report.rows.map(
      (r) =>
        `${r.codes.join("/")} | ${r.label}${r.manual ? " (Dato manual)" : ""}${r.complete ? "" : " (Por clasificar; importes de casillero desconocidos)"} | ${shown(r.gross)} | ${shown(r.net)} | ${shown(r.iva)}`,
    ),
    `Total ventas registradas: Base ${report.sales.base} | IVA ${report.sales.iva}`,
    `Total compras registradas: Base ${report.purchases.base} | IVA ${report.purchases.iva}`,
    "C. Resumen de impuesto — ESTIMADO",
    `IVA generado registrado: ${report.tax.generatedIva}`,
    `IVA crédito potencial clasificado: ${report.tax.potentialCredit}`,
    `564 Crédito aplicable (Dato manual): ${shown(report.tax.applicableCredit)}`,
    `601 Impuesto causado estimado: ${shown(report.tax.causedTax)}`,
    `605 Crédito compras anterior (Dato manual): ${shown(report.tax.previousPurchasesCredit)}`,
    `606 Crédito retenciones anterior (Dato manual): ${shown(report.tax.previousWithholdingsCredit)}`,
    `Crédito disponible estimado: ${shown(report.tax.availableCredit)}`,
    `609 Retenciones recibidas: ${shown(report.tax.receivedWithholdings)}`,
    `Subtotal parcial antes de retenciones y ajustes: ${shown(report.tax.preliminarySubtotal)}`,
    `Subtotal a pagar: ${shown(report.tax.subtotal)}`,
    `Total estimado: ${shown(report.tax.totalEstimated)}`,
    "D. Operaciones por clasificar / observaciones",
    ...report.unclassified.map(
      (d) => `${d.number ?? d.id}: Base ${d.base} | IVA ${d.iva}`,
    ),
    ...report.observations,
    `Casilleros pendientes de clasificación o cálculo: ${report.pendingBoxes.join(", ")}`,
    ...report.issues.map((i) => `${i.severity} ${i.code}: ${i.description}`),
    TAX_REPORT_FOOTER,
  ];
}

export async function taxReportPdf(lines: string[]) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(lines[0]);
  pdf.setAuthor("Facturom");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage(),
    y = page.getHeight() - 45;
  for (const original of lines) {
    // StandardFonts is WinAnsi; preserve common Spanish characters, replace only
    // unsupported code points so an unusual company name cannot break the export.
    const safe = [...original]
      .map((c) => {
        try {
          font.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
    const words = safe.split(/\s+/);
    const wrapped: string[] = [];
    let line = "";
    for (const word of words) {
      if (
        font.widthOfTextAtSize(`${line} ${word}`, 9) > page.getWidth() - 90 &&
        line
      ) {
        wrapped.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    wrapped.push(line);
    for (const text of wrapped) {
      if (y < 45) {
        page = pdf.addPage();
        y = page.getHeight() - 45;
      }
      page.drawText(text, {
        x: 45,
        y,
        font,
        size: 9,
        color: rgb(0.1, 0.16, 0.24),
      });
      y -= 14;
    }
    y -= 5;
  }
  return pdf.save();
}

export async function ivaReportXlsx(report: Iva104Report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Facturom";
  const sheet = workbook.addWorksheet("IVA 104 apoyo");
  sheet.columns = [
    { width: 25 },
    { width: 70 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
  ];
  sheet.addRow(["Facturom · Reporte de apoyo IVA 104 · ESTIMADO"]);
  sheet.addRow([
    report.company?.legalName ?? "Por completar",
    report.company?.ruc ?? "Por completar",
    report.period.label,
  ]);
  sheet.addRow(["Completitud", `${report.completeness.percentage}%`]);
  sheet.addRow(["Casilleros", "Concepto", "Valor bruto", "Valor neto", "IVA"]);
  // Decimal amounts are written as text to preserve the exact service values.
  for (const r of report.rows)
    sheet.addRow([
      r.codes.join("/"),
      `${r.label}${r.manual ? " · Dato manual" : ""}`,
      r.gross ?? "Por clasificar",
      r.net ?? "Por clasificar",
      r.iva ?? "Por clasificar",
    ]);
  const details = workbook.addWorksheet("Detalle y observaciones");
  details.columns = [{ width: 130 }];
  for (const line of ivaReportLines(report)) details.addRow([line]);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
