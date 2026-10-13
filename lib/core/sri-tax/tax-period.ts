import { getEcuadorSriDateParts } from "../sri-ecuador-date";

export class TaxInputError extends Error {}
export type TaxPeriod = {
  year: number;
  month: number;
  frequency: "MONTHLY" | "SEMIANNUAL";
  start: Date;
  end: Date;
  key: string;
  label: string;
};

export function parseTaxPeriod(
  input: { year?: unknown; month?: unknown; frequency?: unknown },
  now = new Date(),
): TaxPeriod {
  const current = getEcuadorSriDateParts(now);
  const integer = (value: unknown, fallback: string) => {
    const raw =
      value === undefined || value === null ? fallback : String(value);
    if (!/^\d{1,4}$/.test(raw)) throw new TaxInputError("Período inválido.");
    return Number(raw);
  };
  const year = integer(input.year, current.year);
  const month = integer(input.month, current.month);
  const frequency = input.frequency ?? "MONTHLY";
  if (frequency !== "MONTHLY" && frequency !== "SEMIANNUAL")
    throw new TaxInputError("Frecuencia inválida.");
  if (year < 2000 || year > Number(current.year) || month < 1 || month > 12)
    throw new TaxInputError("Período fuera de rango.");
  if (frequency === "SEMIANNUAL" && month !== 6 && month !== 12)
    throw new TaxInputError("Seleccione junio o diciembre para el semestre.");
  const firstMonth = frequency === "MONTHLY" ? month : month === 6 ? 1 : 7;
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = new Date(`${year}-${pad(firstMonth)}-01T00:00:00-05:00`);
  const end = new Date(
    `${month === 12 ? year + 1 : year}-${pad(month === 12 ? 1 : month + 1)}-01T00:00:00-05:00`,
  );
  if (start > now) throw new TaxInputError("No se admiten períodos futuros.");
  return {
    year,
    month,
    frequency,
    start,
    end,
    key: `${year}${pad(month)}${frequency === "SEMIANNUAL" ? "_SEM" : ""}`,
    label:
      frequency === "MONTHLY"
        ? `${pad(month)}/${year}`
        : `${month === 6 ? "Primer" : "Segundo"} semestre ${year}`,
  };
}

export function periodFromSearch(params: URLSearchParams) {
  return parseTaxPeriod({
    year: params.get("year"),
    month: params.get("month"),
    frequency: params.get("frequency") ?? undefined,
  });
}
