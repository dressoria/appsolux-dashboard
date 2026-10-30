import "@/lib/security/server-only";

import ExcelJS from "exceljs";

export const IMPORT_COLUMNS = [
  "COMPROBANTE",
  "SERIE_COMPROBANTE",
  "CLAVE_ACCESO",
  "FECHA_AUTORIZACION",
  "FECHA_EMISION",
  "VALOR_SIN_IMPUESTOS",
  "IVA",
  "IMPORTE_TOTAL",
  "TIPO_IDENTIFICACION",
  "IDENTIFICACION_CLIENTE",
  "NOMBRE_CLIENTE",
  "CODIGO_PRODUCTO",
  "TIPO_IMPUESTO",
  "CANTIDAD",
  "PRECIO_UNITARIO",
  "DESCUENTO_VALOR",
  "OBSERVACION_PRODUCTO",
  "OBSERVACION_FACTURA",
] as const;

export type ImportColumnKey = (typeof IMPORT_COLUMNS)[number];

const COL_WIDTHS: number[] = [
  16, 22, 52, 22, 16, 18, 14, 18,
  20, 22, 30, 18, 16, 12, 16, 16, 24, 24,
];

export async function generateImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Facturom";
  wb.created = new Date();

  // ── Sheet 1: VENTAS ─────────────────────────────────────────────────────

  const ws = wb.addWorksheet("VENTAS");

  const blue = "FF1E52F1";

  ws.columns = IMPORT_COLUMNS.map((col, i) => ({
    header: col,
    key: col,
    width: COL_WIDTHS[i] ?? 16,
  }));

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF999999" } },
    };
  });
  headerRow.height = 30;

  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: `R1` };

  // Example rows
  const examples: string[][] = [
    [
      "Factura",
      "001-100-000011434",
      "",
      "",
      "30/10/2026",
      "17.25",
      "2.59",
      "19.84",
      "CEDULA",
      "1712345678",
      "JAIME ESTRADA ORTIZ",
      "PROD001",
      "15",
      "2",
      "8.625",
      "0",
      "",
      "Venta de ejemplo",
    ],
    [
      "Factura",
      "001-100-000011435",
      "3010202601010010000001143500110012345678912345671",
      "30/10/2026 15:41",
      "30/10/2026",
      "100.00",
      "15.00",
      "115.00",
      "RUC",
      "1790016919001",
      "EMPRESA DEMO S.A.",
      "SRV001",
      "15",
      "1",
      "80.00",
      "0",
      "Servicio principal",
      "",
    ],
    [
      "Factura",
      "001-100-000011435",
      "3010202601010010000001143500110012345678912345671",
      "30/10/2026 15:41",
      "30/10/2026",
      "100.00",
      "15.00",
      "115.00",
      "RUC",
      "1790016919001",
      "EMPRESA DEMO S.A.",
      "SRV002",
      "15",
      "1",
      "20.00",
      "0",
      "Servicio adicional",
      "",
    ],
    [
      "Factura",
      "001-100-000011436",
      "",
      "",
      "29/10/2026",
      "50.00",
      "0.00",
      "50.00",
      "CONSUMIDOR_FINAL",
      "9999999999999",
      "Consumidor Final",
      "",
      "",
      "",
      "",
      "",
      "",
      "Factura sin detalle de productos",
    ],
  ];

  for (const row of examples) {
    const dataRow = ws.addRow(row);
    dataRow.eachCell((cell) => {
      cell.font = { size: 10, color: { argb: "FF666666" } };
    });
  }

  // ── Sheet 2: INSTRUCCIONES ──────────────────────────────────────────────

  const instrWs = wb.addWorksheet("INSTRUCCIONES");
  instrWs.getColumn(1).width = 30;
  instrWs.getColumn(2).width = 70;

  const titleRow = instrWs.addRow(["INSTRUCCIONES DE IMPORTACIÓN"]);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: blue } };
  instrWs.mergeCells("A1:B1");

  instrWs.addRow([]);

  const sections: [string, string][] = [
    ["Campos obligatorios", "SERIE_COMPROBANTE, FECHA_EMISION, VALOR_SIN_IMPUESTOS, IVA, IMPORTE_TOTAL, TIPO_IDENTIFICACION, IDENTIFICACION_CLIENTE, NOMBRE_CLIENTE"],
    ["Campos opcionales", "COMPROBANTE, CLAVE_ACCESO, FECHA_AUTORIZACION, CODIGO_PRODUCTO, OBSERVACION_PRODUCTO, OBSERVACION_FACTURA"],
    ["Obligatorios si hay producto", "TIPO_IMPUESTO, CANTIDAD, PRECIO_UNITARIO, DESCUENTO_VALOR"],
    ["", ""],
    ["COMPROBANTE", "Vacío = Factura. Valores: Factura, Nota de crédito, Nota de débito, 01, 04, 05"],
    ["SERIE_COMPROBANTE", "Formato: 001-100-000011434 (3 dígitos - 3 dígitos - 9 dígitos). Es la clave de agrupación: todas las filas con la misma serie pertenecen a la misma factura."],
    ["CLAVE_ACCESO", "Exactamente 49 dígitos numéricos. Se usa para deduplicación."],
    ["FECHA_AUTORIZACION", "Formatos: 31/12/25, 31/12/2025, 31/12/2025 15:49:00, YYYY-MM-DD"],
    ["FECHA_EMISION", "Formatos: 30/12/25, 30/12/2025, YYYY-MM-DD"],
    ["VALOR_SIN_IMPUESTOS", "Subtotal. Acepta: 15, 15.00, 15,00, 1.234,56, 1,234.56"],
    ["IVA", "Total de impuestos. Mismo formato numérico."],
    ["IMPORTE_TOTAL", "Total con impuestos. Debe ser ≈ VALOR_SIN_IMPUESTOS + IVA (tolerancia 0.02)."],
    ["TIPO_IDENTIFICACION", "CEDULA, RUC, PASAPORTE, EXTERIOR, CONSUMIDOR_FINAL"],
    ["IDENTIFICACION_CLIENTE", "Número de cédula, RUC, pasaporte. Para consumidor final: 9999999999999"],
    ["NOMBRE_CLIENTE", "Razón social o nombre completo."],
    ["CODIGO_PRODUCTO", "Código del producto en Facturom. Si está vacío, se importa solo la cabecera sin líneas."],
    ["TIPO_IMPUESTO", "Obligatorio si hay producto. Valores: 0, 15, 12, NO_OBJETO, EXENTO"],
    ["CANTIDAD", "Obligatorio si hay producto. Acepta decimales (ej: 0.5, 1.25)."],
    ["PRECIO_UNITARIO", "Obligatorio si hay producto. Precio unitario sin impuesto."],
    ["DESCUENTO_VALOR", "Obligatorio si hay producto. Monto del descuento (0 si no hay). No puede ser negativo."],
    ["OBSERVACION_PRODUCTO", "Nota opcional por línea de producto."],
    ["OBSERVACION_FACTURA", "Nota opcional a nivel de factura. Debe ser idéntica en todas las filas de la misma serie."],
    ["", ""],
    ["Múltiples productos", "Para una factura con varios productos, repita la serie, clave de acceso, fechas, cliente y totales en cada fila. Cambie solo CODIGO_PRODUCTO y los campos de producto."],
    ["Deduplicación", "Si la clave de acceso o serie ya existe en Facturom, el documento se marcará como duplicado y no se reimportará."],
  ];

  for (const [label, desc] of sections) {
    const r = instrWs.addRow([label, desc]);
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(2).font = { size: 10 };
    r.getCell(2).alignment = { wrapText: true };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
