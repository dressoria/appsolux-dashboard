import "@/lib/security/server-only";
import PDFDocument from "pdfkit";
import bwipjs from "bwip-js/node";
import { getPrismaClient } from "@/lib/db/prisma";
import { ProductInputError } from "./inventory-product-input";

export async function productBarcodePdf(tenantId: string, ids: string[]) {
  const selected = [...new Set(ids)];
  if (!selected.length || selected.length > 200 || selected.some((id) => !id)) throw new ProductInputError("Selecciona entre 1 y 200 productos.");
  const products = await getPrismaClient().lightweightProduct.findMany({ where: { tenantId, id: { in: selected } }, select: { id: true, name: true, primaryCode: true, barcode: true } });
  if (products.length !== selected.length) throw new ProductInputError("Uno de los productos seleccionados no está disponible.");
  const labels = [];
  for (const id of selected) {
    const product = products.find((p) => p.id === id)!;
    const code = product.barcode || product.primaryCode;
    if (!code) throw new ProductInputError(`Asigna un código de barras o principal a ${product.name}.`, "barcode");
    if (code.length > 64) throw new ProductInputError(`El código de ${product.name} supera 64 caracteres.`, "barcode");
    try {
      const png = await bwipjs.toBuffer({ bcid: "code128", text: code, scale: 3, height: 12, includetext: true, textxalign: "center", paddingwidth: 12, paddingheight: 3 });
      labels.push({ name: product.name, png });
    } catch {
      throw new ProductInputError(`El código de ${product.name} no se puede representar como Code 128.`, "barcode");
    }
  }
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const output = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
  });
  labels.forEach((label, index) => {
    if (index > 0 && index % 6 === 0) doc.addPage();
    const y = 36 + (index % 6) * 122;
    doc.font("Helvetica").fontSize(11).text(label.name, 42, y, { width: 505, height: 18, ellipsis: true });
    doc.image(label.png, 42, y + 24, { fit: [505, 82], align: "center" });
  });
  doc.end();
  return output;
}
