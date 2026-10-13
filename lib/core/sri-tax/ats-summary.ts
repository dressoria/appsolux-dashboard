import type { AtsPeriodData } from "./ats-data";
import { validateAtsData } from "./ats-validation";

export const TAX_REPORT_FOOTER =
  "Resumen generado a partir de la información registrada en Facturom. Verifique antes de presentar al SRI.";
export function buildAtsSummary(data: AtsPeriodData) {
  return {
    company: data.company,
    period: data.period,
    totals: data.totals,
    validation: validateAtsData(data),
    footer: TAX_REPORT_FOOTER,
  };
}
