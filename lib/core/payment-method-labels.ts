export const COMMERCIAL_LABELS: Record<string, string> = {
  cash: "Efectivo",
  check: "Cheque",
  deposit: "Depósito",
  transfer: "Transferencia",
  debit_card: "Débito",
  credit_card: "Tarjeta de crédito",
  card: "Tarjeta",
  credit: "Crédito",
};

export const COMMERCIAL_TO_SRI: Record<string, string> = {
  cash: "01",
  check: "20",
  deposit: "20",
  transfer: "20",
  debit_card: "16",
  credit_card: "19",
  card: "19",
  credit: "20",
};

export const SRI_PAYMENT_LABELS: Record<string, string> = {
  "01": "Sin utilización del sistema financiero",
  "15": "Compensación de deudas",
  "16": "Tarjeta de débito",
  "17": "Dinero electrónico",
  "18": "Tarjeta prepago",
  "19": "Tarjeta de crédito",
  "20": "Otros con utilización del sistema financiero",
  "21": "Endoso de títulos",
};
