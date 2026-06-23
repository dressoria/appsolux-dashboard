import "@/lib/security/server-only";

import PDFDocument from "pdfkit";

const PDFKIT_STANDARD_FONTS = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
} as const;

export function applyPdfKitFont(
  doc: InstanceType<typeof PDFDocument>,
  weight: keyof typeof PDFKIT_STANDARD_FONTS = "regular"
) {
  doc.font(PDFKIT_STANDARD_FONTS[weight]);
}
