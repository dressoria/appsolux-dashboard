export type SriPaymentCodeEntry = {
  code: string;
  description: string;
};

export const SRI_PAYMENT_CODES: SriPaymentCodeEntry[] = [
  { code: "01", description: "SIN UTILIZACIÓN DEL SISTEMA FINANCIERO" },
  { code: "15", description: "COMPENSACIÓN DE DEUDAS" },
  { code: "16", description: "TARJETA DE DÉBITO" },
  { code: "17", description: "DINERO ELECTRÓNICO" },
  { code: "18", description: "TARJETA PREPAGO" },
  { code: "19", description: "TARJETA DE CRÉDITO" },
  { code: "20", description: "OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO" },
  { code: "21", description: "ENDOSO DE TÍTULOS" },
];

export function getSriPaymentCodeLabel(code: string): string {
  const entry = SRI_PAYMENT_CODES.find((e) => e.code === code);
  return entry ? `${entry.code} — ${entry.description}` : code;
}
