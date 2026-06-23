import "@/lib/security/server-only";

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const FONT_PATH_CANDIDATES = {
  regular: [
    path.join(process.cwd(), "node_modules/pdfkit/js/data/Helvetica.afm"),
    "/app/node_modules/pdfkit/js/data/Helvetica.afm",
    "/app/.next/standalone/node_modules/pdfkit/js/data/Helvetica.afm",
    "/ROOT/node_modules/pdfkit/js/data/Helvetica.afm",
  ],
  bold: [
    path.join(process.cwd(), "node_modules/pdfkit/js/data/Helvetica-Bold.afm"),
    "/app/node_modules/pdfkit/js/data/Helvetica-Bold.afm",
    "/app/.next/standalone/node_modules/pdfkit/js/data/Helvetica-Bold.afm",
    "/ROOT/node_modules/pdfkit/js/data/Helvetica-Bold.afm",
  ],
} as const;

function resolveExistingPath(candidates: readonly string[]) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

const resolvedRegularFont = resolveExistingPath(FONT_PATH_CANDIDATES.regular);
const resolvedBoldFont = resolveExistingPath(FONT_PATH_CANDIDATES.bold);

export function applyPdfKitFont(
  doc: InstanceType<typeof PDFDocument>,
  weight: "regular" | "bold" = "regular"
) {
  const resolvedPath = weight === "bold" ? resolvedBoldFont : resolvedRegularFont;

  if (!resolvedPath) {
    throw new Error("No se pudo localizar la fuente base de PDFKit para generar el PDF.");
  }

  doc.font(resolvedPath);
}
