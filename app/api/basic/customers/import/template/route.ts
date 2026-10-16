import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { customerColumns } from "@/lib/core/customer-import";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Clientes");

  sheet.addRow([...customerColumns]);
  sheet.getRow(1).font = { bold: true };

  sheet.addRow([
    "RUC",
    "1790012345001",
    "Empresa Ejemplo",
    "Ejemplo",
    "contacto@ejemplo.com",
    "+593999999999",
    "Dirección",
    "Ecuador",
    "Pichincha",
    "Quito",
    "",
    "",
    "",
    "Empresa",
    "Referido",
    "",
    "Fila de ejemplo: reemplazar o eliminar",
  ]);

  const docsSheet = workbook.addWorksheet("Instrucciones");
  docsSheet.columns = [{ width: 30 }, { width: 80 }];
  const instructions: [string, string][] = [
    ["Campo", "Descripción"],
    ["identificationType", "RUC | CEDULA | PASSPORT | FOREIGN_ID — Si vacío se infiere: 10 dígitos → CEDULA, 13 dígitos → RUC"],
    ["identification", "Obligatorio. Número de identificación del cliente."],
    ["name", "Obligatorio. Razón social o nombre completo."],
    ["tradeName", "Opcional. Nombre comercial."],
    ["email", "Opcional. Si vacío se usa: systemworkfacturaelectronica@gmail.com"],
    ["phone", "Opcional. Si vacío se usa: 9999999999"],
    ["address", "Opcional. Si vacío se usa: SIN DIRECCIÓN"],
    ["country", "Opcional. Si vacío se usa: Ecuador"],
    ["province", "Opcional. Puede quedar vacío."],
    ["city", "Opcional. Puede quedar vacío."],
    ["parish", "Opcional. Puede quedar vacío."],
    ["", ""],
    ["NOTAS", ""],
    ["Clientes existentes", "Si un cliente ya existe (misma identificación), se omite automáticamente sin bloquear la importación."],
    ["Duplicados en archivo", "Si una identificación aparece más de una vez, solo se importa la primera fila."],
    ["Límite de filas", "Máximo 2,000 filas por archivo."],
  ];
  instructions.forEach((row, i) => {
    docsSheet.addRow(row);
    if (i === 0) docsSheet.getRow(1).font = { bold: true };
  });

  sheet.columns.forEach((column) => { column.width = 22; });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="formato-clientes.xlsx"',
    },
  });
}
