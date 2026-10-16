import "@/lib/security/server-only";

import { Prisma } from "@prisma/client";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export type CalcLineInput = {
  quantity: number;
  unitPrice: Decimal;
  discountAmount: Decimal;
  taxRate: Decimal;
};

export type CalcLineResult = {
  lineSubtotal: Decimal;
  taxAmount: Decimal;
  lineTotal: Decimal;
};

export type CalcTotalsResult = {
  subtotal: Decimal;
  taxTotal: Decimal;
  discountTotal: Decimal;
  total: Decimal;
  lines: CalcLineResult[];
};

export function calculateLine(line: CalcLineInput): CalcLineResult {
  const grossAmount = line.unitPrice.mul(line.quantity);
  const discountAmount = Decimal.min(line.discountAmount, grossAmount);
  const lineSubtotal = grossAmount.sub(discountAmount);
  const taxAmount = lineSubtotal.mul(line.taxRate).div(100).toDecimalPlaces(2);
  const lineTotal = lineSubtotal.add(taxAmount);
  return { lineSubtotal, taxAmount, lineTotal };
}

export function calculateSaleTotals(lines: CalcLineInput[]): CalcTotalsResult {
  let subtotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  let discountTotal = new Decimal(0);
  const lineResults: CalcLineResult[] = [];

  for (const line of lines) {
    const result = calculateLine(line);
    subtotal = subtotal.add(result.lineSubtotal);
    taxTotal = taxTotal.add(result.taxAmount);
    discountTotal = discountTotal.add(
      Decimal.min(line.discountAmount, line.unitPrice.mul(line.quantity)),
    );
    lineResults.push(result);
  }

  return {
    subtotal,
    taxTotal,
    discountTotal,
    total: subtotal.add(taxTotal),
    lines: lineResults,
  };
}
