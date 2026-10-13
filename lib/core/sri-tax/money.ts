import { Prisma } from "@prisma/client";

export const decimal = (value: Prisma.Decimal.Value) =>
  new Prisma.Decimal(value);
export const money = (value: Prisma.Decimal.Value) =>
  decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
export const sum = (values: Prisma.Decimal.Value[]) =>
  values.reduce<Prisma.Decimal>(
    (total, value) => total.plus(value),
    decimal(0),
  );
