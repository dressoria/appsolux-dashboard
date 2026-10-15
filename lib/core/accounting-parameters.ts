import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { AccountingAccountMappingKey } from "@prisma/client";

export async function getMappings(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingAccountMapping.findMany({
    where: { tenantId },
    include: { account: { select: { id: true, code: true, name: true } } },
    orderBy: { key: "asc" },
  });
}

export async function getMappingByKey(
  tenantId: string,
  key: AccountingAccountMappingKey,
) {
  const prisma = getPrismaClient();
  return prisma.accountingAccountMapping.findUnique({
    where: { tenantId_key: { tenantId, key } },
    include: { account: { select: { id: true, code: true, name: true } } },
  });
}

export async function upsertMapping(
  tenantId: string,
  key: AccountingAccountMappingKey,
  accountId: string,
) {
  const prisma = getPrismaClient();
  return prisma.accountingAccountMapping.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: { tenantId, key, accountId },
    update: { accountId },
  });
}

export async function upsertMappings(
  tenantId: string,
  mappings: Array<{ key: AccountingAccountMappingKey; accountId: string }>,
) {
  const prisma = getPrismaClient();
  return prisma.$transaction(
    mappings.map((m) =>
      prisma.accountingAccountMapping.upsert({
        where: { tenantId_key: { tenantId, key: m.key } },
        create: { tenantId, key: m.key, accountId: m.accountId },
        update: { accountId: m.accountId },
      }),
    ),
  );
}

export async function deleteMapping(
  tenantId: string,
  key: AccountingAccountMappingKey,
) {
  const prisma = getPrismaClient();
  return prisma.accountingAccountMapping.delete({
    where: { tenantId_key: { tenantId, key } },
  });
}

export async function getTaxWithholdingMappings(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.taxWithholdingAccountMapping.findMany({
    where: { tenantId },
    include: {
      withholdingCode: { select: { id: true, code: true, description: true, taxType: true } },
      assetAccount: { select: { id: true, code: true, name: true } },
      liabilityAccount: { select: { id: true, code: true, name: true } },
      expenseAccount: { select: { id: true, code: true, name: true } },
    },
  });
}

export async function upsertTaxWithholdingMapping(
  tenantId: string,
  withholdingCodeId: string,
  data: {
    assetAccountId?: string | null;
    liabilityAccountId?: string | null;
    expenseAccountId?: string | null;
  },
) {
  const prisma = getPrismaClient();
  return prisma.taxWithholdingAccountMapping.upsert({
    where: {
      tenantId_withholdingCodeId: { tenantId, withholdingCodeId },
    },
    create: {
      tenantId,
      withholdingCodeId,
      assetAccountId: data.assetAccountId ?? null,
      liabilityAccountId: data.liabilityAccountId ?? null,
      expenseAccountId: data.expenseAccountId ?? null,
    },
    update: {
      assetAccountId: data.assetAccountId ?? null,
      liabilityAccountId: data.liabilityAccountId ?? null,
      expenseAccountId: data.expenseAccountId ?? null,
    },
  });
}

export const MAPPING_KEY_TABS: Record<string, AccountingAccountMappingKey[]> = {
  General: [
    "TRANSITORY_CLEARING",
    "ASSUMED_WITHHOLDING_LIABILITY",
    "ASSUMED_WITHHOLDING_EXPENSE",
  ],
  Cartera: [
    "CUSTOMER_RECEIVABLE_LOCAL",
    "CUSTOMER_RECEIVABLE_FOREIGN",
    "CUSTOMER_ADVANCE_LOCAL",
    "CUSTOMER_ADVANCE_FOREIGN",
    "IMPORTED_CUSTOMER_OBLIGATION",
    "SUPPLIER_PAYABLE_LOCAL",
    "SUPPLIER_PAYABLE_FOREIGN",
    "SUPPLIER_ADVANCE_LOCAL",
    "SUPPLIER_ADVANCE_FOREIGN",
    "IMPORTED_SUPPLIER_OBLIGATION",
  ],
  Inventario: [
    "INVENTORY_TAXABLE",
    "INVENTORY_ZERO",
    "INVENTORY_NON_OBJECT",
    "INVENTORY_EXEMPT",
    "COGS_TAXABLE",
    "COGS_ZERO",
    "COGS_NON_OBJECT",
    "COGS_EXEMPT",
    "UNSUPPORTED_MERCHANDISE",
    "PHYSICAL_COUNT_ADJUSTMENT",
  ],
  Impuestos: [
    "VAT_OUTPUT",
    "VAT_INPUT",
    "VAT_COST_EXPENSE",
  ],
  "Ventas y NC": [
    "SALES_TAXABLE",
    "SALES_ZERO",
    "SALES_NON_OBJECT",
    "SALES_EXEMPT",
    "SALES_EXPORT",
    "SALES_CREDIT_NOTE_DISCOUNT_TAXABLE",
    "SALES_CREDIT_NOTE_DISCOUNT_ZERO",
    "SALES_CREDIT_NOTE_DISCOUNT_NON_OBJECT",
    "SALES_CREDIT_NOTE_DISCOUNT_EXEMPT",
    "SALES_CREDIT_NOTE_RETURN_TAXABLE",
    "SALES_CREDIT_NOTE_RETURN_ZERO",
    "SALES_CREDIT_NOTE_RETURN_NON_OBJECT",
    "SALES_CREDIT_NOTE_RETURN_EXEMPT",
  ],
  "Compras NC": [
    "PURCHASE_CREDIT_NOTE_DISCOUNT_TAXABLE",
    "PURCHASE_CREDIT_NOTE_DISCOUNT_ZERO",
    "PURCHASE_CREDIT_NOTE_DISCOUNT_NON_OBJECT",
    "PURCHASE_CREDIT_NOTE_DISCOUNT_EXEMPT",
    "PURCHASE_CREDIT_NOTE_RETURN_TAXABLE",
    "PURCHASE_CREDIT_NOTE_RETURN_ZERO",
    "PURCHASE_CREDIT_NOTE_RETURN_NON_OBJECT",
    "PURCHASE_CREDIT_NOTE_RETURN_EXEMPT",
  ],
  "Cuentas Cierre": [
    "CLOSING_ACCUMULATED_RESULTS",
    "CLOSING_PROFIT_LOSS",
    "CLOSING_CURRENT_RESULT",
  ],
  Tarjetas: [
    "CARD_CLEARING",
  ],
};

export const MAPPING_KEY_LABELS: Record<AccountingAccountMappingKey, string> = {
  TRANSITORY_CLEARING: "Cuenta transitoria de compensación",
  ASSUMED_WITHHOLDING_LIABILITY: "Retención asumida – pasivo",
  ASSUMED_WITHHOLDING_EXPENSE: "Retención asumida – gasto",
  CUSTOMER_RECEIVABLE_LOCAL: "Cuentas por cobrar – local",
  CUSTOMER_RECEIVABLE_FOREIGN: "Cuentas por cobrar – exterior",
  CUSTOMER_ADVANCE_LOCAL: "Anticipo clientes – local",
  CUSTOMER_ADVANCE_FOREIGN: "Anticipo clientes – exterior",
  IMPORTED_CUSTOMER_OBLIGATION: "Obligación importada – clientes",
  SUPPLIER_PAYABLE_LOCAL: "Cuentas por pagar – local",
  SUPPLIER_PAYABLE_FOREIGN: "Cuentas por pagar – exterior",
  SUPPLIER_ADVANCE_LOCAL: "Anticipo proveedores – local",
  SUPPLIER_ADVANCE_FOREIGN: "Anticipo proveedores – exterior",
  IMPORTED_SUPPLIER_OBLIGATION: "Obligación importada – proveedores",
  INVENTORY_TAXABLE: "Inventario – gravado",
  INVENTORY_ZERO: "Inventario – tarifa 0",
  INVENTORY_NON_OBJECT: "Inventario – no objeto",
  INVENTORY_EXEMPT: "Inventario – exento",
  COGS_TAXABLE: "Costo de ventas – gravado",
  COGS_ZERO: "Costo de ventas – tarifa 0",
  COGS_NON_OBJECT: "Costo de ventas – no objeto",
  COGS_EXEMPT: "Costo de ventas – exento",
  SALES_TAXABLE: "Ventas – gravado",
  SALES_ZERO: "Ventas – tarifa 0",
  SALES_NON_OBJECT: "Ventas – no objeto",
  SALES_EXEMPT: "Ventas – exento",
  SALES_EXPORT: "Ventas – exportación",
  SALES_CREDIT_NOTE_DISCOUNT_TAXABLE: "NC venta descuento – gravado",
  SALES_CREDIT_NOTE_DISCOUNT_ZERO: "NC venta descuento – tarifa 0",
  SALES_CREDIT_NOTE_DISCOUNT_NON_OBJECT: "NC venta descuento – no objeto",
  SALES_CREDIT_NOTE_DISCOUNT_EXEMPT: "NC venta descuento – exento",
  SALES_CREDIT_NOTE_RETURN_TAXABLE: "NC venta devolución – gravado",
  SALES_CREDIT_NOTE_RETURN_ZERO: "NC venta devolución – tarifa 0",
  SALES_CREDIT_NOTE_RETURN_NON_OBJECT: "NC venta devolución – no objeto",
  SALES_CREDIT_NOTE_RETURN_EXEMPT: "NC venta devolución – exento",
  PURCHASE_CREDIT_NOTE_DISCOUNT_TAXABLE: "NC compra descuento – gravado",
  PURCHASE_CREDIT_NOTE_DISCOUNT_ZERO: "NC compra descuento – tarifa 0",
  PURCHASE_CREDIT_NOTE_DISCOUNT_NON_OBJECT: "NC compra descuento – no objeto",
  PURCHASE_CREDIT_NOTE_DISCOUNT_EXEMPT: "NC compra descuento – exento",
  PURCHASE_CREDIT_NOTE_RETURN_TAXABLE: "NC compra devolución – gravado",
  PURCHASE_CREDIT_NOTE_RETURN_ZERO: "NC compra devolución – tarifa 0",
  PURCHASE_CREDIT_NOTE_RETURN_NON_OBJECT: "NC compra devolución – no objeto",
  PURCHASE_CREDIT_NOTE_RETURN_EXEMPT: "NC compra devolución – exento",
  UNSUPPORTED_MERCHANDISE: "Mercadería sin sustento",
  PHYSICAL_COUNT_ADJUSTMENT: "Ajuste conteo físico",
  VAT_OUTPUT: "IVA en ventas",
  VAT_INPUT: "IVA en compras (crédito tributario)",
  VAT_COST_EXPENSE: "IVA al costo/gasto",
  CLOSING_ACCUMULATED_RESULTS: "Resultados acumulados",
  CLOSING_PROFIT_LOSS: "Utilidad/pérdida del ejercicio",
  CLOSING_CURRENT_RESULT: "Resultado del ejercicio actual",
  CARD_CLEARING: "Cuenta puente tarjetas",
};
