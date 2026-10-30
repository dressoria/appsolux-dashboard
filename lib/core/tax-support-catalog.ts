export type TaxSupportEntry = {
  code: string;
  description: string;
  compatibleDocumentTypes: string[];
};

export const TAX_SUPPORT_CATALOG: TaxSupportEntry[] = [
  {
    code: "01",
    description: "Crédito tributario para declaración de IVA (servicios y bienes distintos de inventarios y activos fijos)",
    compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"],
  },
  {
    code: "02",
    description: "Costo o gasto para declaración de IR (servicios y bienes distintos de inventarios y activos fijos)",
    compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"],
  },
  {
    code: "03",
    description: "Activo fijo — Crédito tributario para declaración de IVA",
    compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"],
  },
  {
    code: "04",
    description: "Activo fijo — Costo o gasto para declaración de IR",
    compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"],
  },
  {
    code: "05",
    description: "Liquidación gastos de viaje, hospedaje y alimentación",
    compatibleDocumentTypes: ["INVOICE", "PURCHASE_SETTLEMENT"],
  },
  {
    code: "06",
    description: "Inventario — Crédito tributario para declaración de IVA",
    compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"],
  },
  {
    code: "07",
    description: "Inventario — Costo o gasto para declaración de IR",
    compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"],
  },
  {
    code: "08",
    description: "Valor pagado para solicitar reembolso de gasto",
    compatibleDocumentTypes: ["INVOICE", "PURCHASE_SETTLEMENT"],
  },
  {
    code: "09",
    description: "Reembolso por siniestros",
    compatibleDocumentTypes: ["INVOICE"],
  },
  {
    code: "10",
    description: "Distribución de dividendos, beneficios o utilidades",
    compatibleDocumentTypes: ["INVOICE", "PURCHASE_SETTLEMENT"],
  },
  {
    code: "11",
    description: "Convenios de débito o recaudación para IFI",
    compatibleDocumentTypes: ["INVOICE"],
  },
  {
    code: "12",
    description: "Impuestos y retenciones presuntivos",
    compatibleDocumentTypes: ["INVOICE"],
  },
  {
    code: "13",
    description: "Valores reconocidos por entidades del sector público a favor de sujetos pasivos",
    compatibleDocumentTypes: ["INVOICE"],
  },
  {
    code: "14",
    description: "Valores facturados por socios a operadoras de transporte",
    compatibleDocumentTypes: ["INVOICE"],
  },
  {
    code: "15",
    description: "Pagos por consumos propios y de terceros de servicios digitales",
    compatibleDocumentTypes: ["INVOICE"],
  },
];

export function getTaxSupportForDocumentType(documentType: string): TaxSupportEntry[] {
  return TAX_SUPPORT_CATALOG.filter((e) =>
    e.compatibleDocumentTypes.includes(documentType),
  );
}

export function isValidTaxSupportCombination(
  taxSupportCode: string,
  documentType: string,
): boolean {
  const entry = TAX_SUPPORT_CATALOG.find((e) => e.code === taxSupportCode);
  if (!entry) return false;
  return entry.compatibleDocumentTypes.includes(documentType);
}

export function suggestTaxSupportCode(purchaseType: string | null): string | null {
  if (purchaseType === "MERCHANDISE") return "06";
  if (purchaseType === "EXPENSE_SERVICE") return "01";
  return null;
}

export const PURCHASE_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  INVOICE: "01 · Factura",
  CREDIT_NOTE: "04 · Nota de crédito",
  DEBIT_NOTE: "05 · Nota de débito",
  OTHER: "Otro",
};
