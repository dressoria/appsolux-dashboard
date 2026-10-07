export type ProformaCalculationLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate: number;
  observation?: string;
};

export function calculateProformaTotals(lines: ProformaCalculationLine[]) {
  const items = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0)
      throw new Error("La cantidad debe ser un entero mayor a cero.");
    if (
      ![line.unitPrice, line.discount ?? 0, line.taxRate].every(Number.isFinite)
    )
      throw new Error("La línea contiene valores inválidos.");
    const gross = line.unitPrice * line.quantity;
    const discount = Math.min(Math.max(line.discount ?? 0, 0), gross);
    const subtotal = gross - discount;
    const tax = subtotal * (line.taxRate / 100);
    return { ...line, discount, subtotal, tax, total: subtotal + tax };
  });
  const sum = (field: "subtotal" | "discount" | "tax" | "total") =>
    Number(items.reduce((value, item) => value + item[field], 0).toFixed(2));
  return {
    items,
    subtotal: sum("subtotal"),
    discount: sum("discount"),
    tax: sum("tax"),
    total: sum("total"),
  };
}
