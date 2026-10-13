import { Prisma } from "@prisma/client";
import { getEcuadorSriDateParts } from "../sri-ecuador-date";

export class TreasuryError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}
export const dec = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
export const money = (value: Prisma.Decimal.Value) =>
  dec(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
export const total = (values: Prisma.Decimal.Value[]) =>
  values.reduce<Prisma.Decimal>((sum, value) => sum.plus(value), dec(0));
export function amount(value: unknown, allowZero = false, signed = false) {
  if (
    typeof value !== "string" ||
    !(signed ? /^-?\d{1,12}(\.\d{1,2})?$/ : /^\d{1,12}(\.\d{1,2})?$/).test(
      value,
    )
  )
    throw new TreasuryError(
      "Ingresa un monto válido con máximo dos decimales y punto decimal.",
    );
  const result = dec(value);
  if (!signed && (result.lt(0) || (!allowZero && result.isZero())))
    throw new TreasuryError("El monto debe ser mayor que cero.");
  return result;
}
export function text(
  value: unknown,
  label: string,
  required = true,
  max = 200,
) {
  if ((value === undefined || value === null || value === "") && !required)
    return null;
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new TreasuryError(`${label} inválido.`);
  return value.trim();
}
export function id(value: unknown) {
  const result = text(value, "Identificador")!;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(result))
    throw new TreasuryError("Identificador inválido.");
  return result;
}
export function choice<const T extends readonly string[]>(
  value: unknown,
  values: T,
): T[number] {
  if (typeof value !== "string" || !values.includes(value))
    throw new TreasuryError("Opción inválida.");
  return value;
}
export function date(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    )
  )
    throw new TreasuryError("Fecha inválida.");
  const result = new Date(
    value.length === 10 ? `${value}T00:00:00-05:00` : value,
  );
  const plain = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (
    Number.isNaN(result.getTime()) ||
    Number.isNaN(plain.getTime()) ||
    plain.toISOString().slice(0, 10) !== value.slice(0, 10) ||
    result.getUTCFullYear() < 2000 ||
    result.getUTCFullYear() > 2100
  )
    throw new TreasuryError("Fecha fuera de rango.");
  return result;
}
export function nextDay(value: Date) {
  return new Date(value.getTime() + 86_400_000);
}
export function localDay(value = new Date()) {
  const parts = getEcuadorSriDateParts(value);
  return date(`${parts.year}-${parts.month}-${parts.day}`);
}
export function obligationState(
  original: Prisma.Decimal.Value,
  paid: Prisma.Decimal.Value,
  due: Date,
  now = new Date(),
) {
  const balance = dec(original).minus(paid);
  if (balance.lt(0))
    throw new TreasuryError("El pago supera el saldo pendiente.");
  return {
    balance,
    status: balance.isZero()
      ? ("PAID" as const)
      : dec(paid).gt(0)
        ? ("PARTIAL" as const)
        : localDay(due) < localDay(now)
          ? ("OVERDUE" as const)
          : ("OPEN" as const),
  };
}
export function cardAmounts(
  gross: Prisma.Decimal.Value,
  percentage: Prisma.Decimal.Value,
  fixed: Prisma.Decimal.Value,
) {
  const fee = dec(gross)
    .mul(percentage)
    .div(100)
    .plus(fixed)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (fee.lt(0) || fee.gt(gross))
    throw new TreasuryError("La comisión supera el importe del cobro.");
  return { gross: dec(gross), fee, net: dec(gross).minus(fee) };
}
export function signed(direction: string, value: Prisma.Decimal.Value) {
  return dec(value).mul(direction === "IN" ? 1 : -1);
}
export function pageParams(params: URLSearchParams) {
  const read = (key: string, fallback: number, max: number) => {
    const value = params.get(key) ?? String(fallback);
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max)
      throw new TreasuryError("Paginación inválida.");
    return Number(value);
  };
  return { page: read("page", 1, 100000), pageSize: read("pageSize", 25, 100) };
}
