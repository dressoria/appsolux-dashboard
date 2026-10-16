import "@/lib/security/server-only";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { TEMPLATE_COLUMNS, type ImportRow } from "./inventory-import";
import { ProductInputError } from "./inventory-product-input";

export async function productImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Productos");
  sheet.addRow([...TEMPLATE_COLUMNS]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => { column.width = 21; column.numFmt = "@"; });
  for (const column of [1, 16, 19]) for (let row = 2; row <= 2001; row++) {
    sheet.getCell(row, column).dataValidation = { type: "list", allowBlank: true, showErrorMessage: true, errorTitle: "Valor inválido", error: "Selecciona un valor de la lista.", formulae: [column === 16 ? '"15,5,8,12,0,NON_OBJECT,EXEMPT"' : column === 1 ? '"PRODUCTO,SERVICIO,COMBO"' : '"true,false"'] };
  }
  const help = workbook.addWorksheet("Instrucciones");
  help.addRows([
    ["IVA", "15, 5, 8, 12, 0, NON_OBJECT, EXEMPT; también 15%, 5%, 8%, 12%, 0%, NO_OBJETO, EXENTO"],
    ["Precios", "Netos sin IVA; vacíos = 0; nunca negativos. Usa punto decimal."],
    ["Catálogos", "Usa nombre existente; unidad y bodega también aceptan código. Vacíos usan defaults existentes."],
    ["Stock", "Stock inicial y mínimo: enteros no negativos. Servicios sin inventario."],
    ["Códigos", "Texto; conserva ceros iniciales. Código y barcode únicos dentro del tenant."],
    ["Límite", "2000 filas por archivo; 5 MB. CSV UTF-8 separado por comas o XLSX."],
  ]);
  help.getColumn(1).width = 20; help.getColumn(2).width = 120;
  return workbook.xlsx.writeBuffer();
}

export async function readProductImportFile(file: File): Promise<ImportRow[]> {
  if (file.size > 5 * 1024 * 1024) throw new ProductInputError("El archivo supera 5 MB.");
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer());
  let sheet: ExcelJS.Worksheet;
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    try {
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch { throw new ProductInputError("El archivo XLSX no es válido o está dañado."); }
    sheet = workbook.worksheets[0];
  } else if (file.name.toLowerCase().endsWith(".csv")) {
    try {
      sheet = await workbook.csv.read(Readable.from([buffer]), { parserOptions: { trim: true }, map: (value) => value });
    } catch { throw new ProductInputError("El archivo CSV no es válido. Usa UTF-8 y separador de comas."); }
  } else throw new ProductInputError("Selecciona un archivo CSV o XLSX.");
  if (!sheet) throw new ProductInputError("El archivo no contiene una hoja de productos.");
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map((v) => String(v ?? "").trim().replace(/^\uFEFF/, "").toLowerCase());
  if (!headers.includes("nombre")) throw new ProductInputError("Falta la columna nombre.");
  if (new Set(headers).size !== headers.length || headers.some((h) => !(TEMPLATE_COLUMNS as readonly string[]).includes(h))) throw new ProductInputError("Columnas duplicadas o desconocidas. Usa el formato de importación.");
  const rows: ImportRow[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    if (number > 2001) throw new ProductInputError("El archivo supera 2000 filas.");
    rows.push(Object.fromEntries(headers.map((key, index) => [key, row.getCell(index + 1).text.trim()])) as ImportRow);
  });
  return rows;
}
