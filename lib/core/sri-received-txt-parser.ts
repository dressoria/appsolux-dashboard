import "@/lib/security/server-only";

export type ReceivedTxtRow = {
  accessKey: string;
  emitterRuc: string;
  emitterName: string;
  documentType: string;
  documentSeries: string;
  authorizationDate: string;
  issueDate: string;
  receiverIdentification: string;
  subtotal: string;
  tax: string;
  total: string;
  modifiedDocumentNumber: string;
};

const DOC_TYPE_MAP: Record<string, string> = {
  "1": "FACTURA",
  "2": "LIQUIDACION_DE_COMPRA",
  "3": "NOTA_DE_CREDITO",
  "4": "NOTA_DE_DEBITO",
  "5": "NOTA_DE_DEBITO",
  "6": "RETENCION",
  "01": "FACTURA",
  "02": "LIQUIDACION_DE_COMPRA",
  "03": "NOTA_DE_CREDITO",
  "04": "NOTA_DE_DEBITO",
  "06": "RETENCION",
};

function normalizeDocType(code: string): string {
  return DOC_TYPE_MAP[code.trim()] ?? code.trim();
}

function splitTsvRow(line: string): string[] {
  return line.split("\t").map((s) => s.trim());
}

function findColumnIndex(header: string[], candidates: string[]): number {
  for (const name of candidates) {
    const idx = header.findIndex((h) => h.includes(name));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function isValidAccessKey(key: string): boolean {
  return /^\d{49}$/.test(key);
}

export function parseReceivedTxt(content: string): ReceivedTxtRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = splitTsvRow(lines[0]!).map((h) =>
    h.toUpperCase().replace(/\s+/g, "_"),
  );

  const iRucEmitter = findColumnIndex(header, ["RUC_EMISOR", "RUC"]);
  const iEmitterName = findColumnIndex(header, ["RAZON_SOCIAL_EMISOR", "RAZON_SOCIAL"]);
  const iDocType = findColumnIndex(header, ["TIPO_COMPROBANTE", "TIPO"]);
  const iSeries = findColumnIndex(header, ["SERIE_COMPROBANTE", "SERIE"]);
  const iAccessKey = findColumnIndex(header, ["CLAVE_ACCESO", "CLAVE"]);
  const iAuthDate = findColumnIndex(header, ["FECHA_AUTORIZACION"]);
  const iIssueDate = findColumnIndex(header, ["FECHA_EMISION", "EMISION"]);
  const iReceiverId = findColumnIndex(header, ["IDENTIFICACION_RECEPTOR", "IDENTIFICACION"]);
  const iSubtotal = findColumnIndex(header, ["VALOR_SIN_IMPUESTOS", "SUBTOTAL"]);
  const iTax = findColumnIndex(header, ["IVA"]);
  const iTotal = findColumnIndex(header, ["IMPORTE_TOTAL", "TOTAL"]);
  const iModifiedDoc = findColumnIndex(header, ["NUMERO_DOCUMENTO_MODIFICADO"]);

  if (iAccessKey < 0) return [];

  const rows: ReceivedTxtRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitTsvRow(lines[i]!);
    const accessKey = cells[iAccessKey] ?? "";
    if (!accessKey || !/^\d{49}$/.test(accessKey)) continue;

    rows.push({
      accessKey,
      emitterRuc: iRucEmitter >= 0 ? (cells[iRucEmitter] ?? "") : "",
      emitterName: iEmitterName >= 0 ? (cells[iEmitterName] ?? "") : "",
      documentType: iDocType >= 0 ? normalizeDocType(cells[iDocType] ?? "") : "",
      documentSeries: iSeries >= 0 ? (cells[iSeries] ?? "") : "",
      authorizationDate: iAuthDate >= 0 ? (cells[iAuthDate] ?? "") : "",
      issueDate: iIssueDate >= 0 ? (cells[iIssueDate] ?? "") : "",
      receiverIdentification: iReceiverId >= 0 ? (cells[iReceiverId] ?? "") : "",
      subtotal: iSubtotal >= 0 ? (cells[iSubtotal] ?? "0") : "0",
      tax: iTax >= 0 ? (cells[iTax] ?? "0") : "0",
      total: iTotal >= 0 ? (cells[iTotal] ?? "0") : "0",
      modifiedDocumentNumber: iModifiedDoc >= 0 ? (cells[iModifiedDoc] ?? "") : "",
    });
  }

  return rows;
}
