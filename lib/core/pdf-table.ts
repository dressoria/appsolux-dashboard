import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PdfTableColumn = {
  header: string;
  key: string;
  width: number;
  align?: "left" | "right" | "center";
};

export type PdfTableOptions = {
  title: string;
  subtitle?: string;
  columns: PdfTableColumn[];
  rows: Record<string, string>[];
  landscape?: boolean;
};

const BRAND_BLUE = rgb(0.09, 0.41, 0.88);
const BRAND_BLUE_LIGHT = rgb(0.94, 0.96, 0.99);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0.09, 0.12, 0.2);
const GRAY = rgb(0.4, 0.44, 0.52);
const BORDER = rgb(0.82, 0.85, 0.9);

const FONT_SIZE = 7;
const HEADER_FONT_SIZE = 7.5;
const TITLE_FONT_SIZE = 14;
const SUBTITLE_FONT_SIZE = 8;
const ROW_PADDING_X = 4;
const ROW_PADDING_Y = 4;
const HEADER_HEIGHT = 22;
const MARGIN = 30;
const PAGE_NUM_SIZE = 7;

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, fontSize) > maxWidth) {
            if (chunk) lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function computeRowHeight(
  row: Record<string, string>,
  columns: PdfTableColumn[],
  font: PDFFont,
): number {
  let maxLines = 1;
  for (const col of columns) {
    const text = row[col.key] ?? "";
    const cellWidth = col.width - ROW_PADDING_X * 2;
    const lines = wrapText(text, font, FONT_SIZE, cellWidth);
    if (lines.length > maxLines) maxLines = lines.length;
  }
  return maxLines * (FONT_SIZE + 2) + ROW_PADDING_Y * 2;
}

function drawTableHeader(
  page: PDFPage,
  columns: PdfTableColumn[],
  bold: PDFFont,
  startX: number,
  y: number,
) {
  let x = startX;
  const pageWidth = page.getWidth();
  page.drawRectangle({
    x: MARGIN,
    y: y - HEADER_HEIGHT,
    width: pageWidth - MARGIN * 2,
    height: HEADER_HEIGHT,
    color: BRAND_BLUE,
  });
  for (const col of columns) {
    const textY = y - HEADER_HEIGHT + (HEADER_HEIGHT - HEADER_FONT_SIZE) / 2;
    page.drawText(col.header, {
      x: x + ROW_PADDING_X,
      y: textY,
      size: HEADER_FONT_SIZE,
      font: bold,
      color: WHITE,
    });
    x += col.width;
  }
  return y - HEADER_HEIGHT;
}

function drawRow(
  page: PDFPage,
  row: Record<string, string>,
  columns: PdfTableColumn[],
  font: PDFFont,
  startX: number,
  y: number,
  rowHeight: number,
  isAlternate: boolean,
) {
  const pageWidth = page.getWidth();
  if (isAlternate) {
    page.drawRectangle({
      x: MARGIN,
      y: y - rowHeight,
      width: pageWidth - MARGIN * 2,
      height: rowHeight,
      color: BRAND_BLUE_LIGHT,
    });
  }
  page.drawLine({
    start: { x: MARGIN, y: y - rowHeight },
    end: { x: pageWidth - MARGIN, y: y - rowHeight },
    thickness: 0.3,
    color: BORDER,
  });

  let x = startX;
  for (const col of columns) {
    const text = row[col.key] ?? "";
    const cellWidth = col.width - ROW_PADDING_X * 2;
    const lines = wrapText(text, font, FONT_SIZE, cellWidth);
    let textY = y - ROW_PADDING_Y - FONT_SIZE;
    for (const line of lines) {
      let textX = x + ROW_PADDING_X;
      if (col.align === "right") {
        textX = x + col.width - ROW_PADDING_X - font.widthOfTextAtSize(line, FONT_SIZE);
      } else if (col.align === "center") {
        textX = x + (col.width - font.widthOfTextAtSize(line, FONT_SIZE)) / 2;
      }
      page.drawText(line, {
        x: textX,
        y: textY,
        size: FONT_SIZE,
        font,
        color: BLACK,
      });
      textY -= FONT_SIZE + 2;
    }
    x += col.width;
  }
}

export async function generatePdfTable(options: PdfTableOptions): Promise<Uint8Array> {
  const { title, subtitle, columns, rows, landscape = true } = options;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = landscape ? [842, 595] : [595, 842];
  const contentWidth = pageSize[0] - MARGIN * 2;

  const totalDeclared = columns.reduce((sum, col) => sum + col.width, 0);
  const scaledColumns = columns.map((col) => ({
    ...col,
    width: (col.width / totalDeclared) * contentWidth,
  }));

  let page = pdf.addPage(pageSize);
  let pageNumber = 1;
  let y = pageSize[1] - MARGIN;

  page.drawText(title, { x: MARGIN, y, size: TITLE_FONT_SIZE, font: bold, color: BRAND_BLUE });
  y -= TITLE_FONT_SIZE + 6;

  if (subtitle) {
    page.drawText(subtitle, { x: MARGIN, y, size: SUBTITLE_FONT_SIZE, font, color: GRAY });
    y -= SUBTITLE_FONT_SIZE + 8;
  }

  y -= 4;
  y = drawTableHeader(page, scaledColumns, bold, MARGIN, y);

  for (let i = 0; i < rows.length; i++) {
    const rowHeight = computeRowHeight(rows[i], scaledColumns, font);
    if (y - rowHeight < MARGIN + 20) {
      page = pdf.addPage(pageSize);
      pageNumber++;
      y = pageSize[1] - MARGIN;
      y = drawTableHeader(page, scaledColumns, bold, MARGIN, y);
    }
    drawRow(page, rows[i], scaledColumns, font, MARGIN, y, rowHeight, i % 2 === 1);
    y -= rowHeight;
  }

  const totalPages = pageNumber;
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const text = `Página ${i + 1} de ${totalPages}`;
    const w = font.widthOfTextAtSize(text, PAGE_NUM_SIZE);
    pages[i].drawText(text, {
      x: pageSize[0] - MARGIN - w,
      y: MARGIN - PAGE_NUM_SIZE - 4,
      size: PAGE_NUM_SIZE,
      font,
      color: GRAY,
    });
  }

  return pdf.save();
}
