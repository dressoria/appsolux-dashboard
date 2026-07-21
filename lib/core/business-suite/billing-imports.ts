import "@/lib/security/server-only";

import { disableErpnextCustomer, getErpnextCustomers, updateErpnextCustomer, createErpnextCustomer, createErpnextCustomerAddress } from "@/lib/api/erpnext/customers";
import { getErpnextInventoryBin } from "@/lib/api/erpnext/inventory";
import { disableErpnextItem, getErpnextItems, updateErpnextItem, createErpnextItem } from "@/lib/api/erpnext/items";
import { getErpnextTerritories } from "@/lib/api/erpnext/masters";
import { createAndSubmitErpnextStockEntry } from "@/lib/api/erpnext/stock-entries";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getPrismaClient } from "@/lib/db/prisma";
import { resolveBusinessSuiteErpMasterData } from "@/lib/core/business-suite/erpnext-master-data";
import type { ErpnextCustomer, ErpnextItem, ErpnextTerritory, ErpnextWarehouse } from "@/types/erpnext";

const MAX_IMPORT_ROWS = 500;

export type BillingImportType = "products" | "customers";

type BaseImportRow = {
  index: number;
  status: "ready" | "warning" | "error";
  action: "create" | "update" | "skip";
  identifier: string;
  name: string;
  errors: string[];
  warnings: string[];
};

export type ProductImportPreviewRow = BaseImportRow & {
  kind: "product";
  payload: {
    name: string;
    itemCode: string;
    barcode: string | null;
    price: number;
    cost: number | null;
    initialStock: number;
    warehouse: string | null;
    uom: string | null;
    itemGroup: string | null;
    taxRate: number | null;
    active: boolean;
  };
};

export type CustomerImportPreviewRow = BaseImportRow & {
  kind: "customer";
  payload: {
    name: string;
    taxId: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    customerType: "Individual" | "Company";
    territory: string | null;
    active: boolean;
  };
};

export type BillingImportPreviewResult = {
  type: BillingImportType;
  rows: Array<ProductImportPreviewRow | CustomerImportPreviewRow>;
  summary: {
    totalRows: number;
    readyRows: number;
    warningRows: number;
    errorRows: number;
    createRows: number;
    updateRows: number;
  };
  masterData: {
    companyName: string | null;
    warehouseName: string | null;
    itemGroupName: string | null;
    uomName: string | null;
    territory: string | null;
  };
  blockers: string[];
  warnings: string[];
};

export type BillingImportConfirmResult = {
  type: BillingImportType;
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: string[];
  preview: BillingImportPreviewResult;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseBoolean(value: string | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return true;
  return !["0", "false", "no", "inactivo", "inactive"].includes(normalized);
}

function parseNumber(value: string | undefined) {
  const normalized = (value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function buildImportTemplateCsv(type: BillingImportType) {
  if (type === "products") {
    return [
      "nombre,sku,barcode,precio,costo,stock_inicial,bodega,unidad,categoria,iva,activo",
      [
        "Café molido 250g",
        "CAF-250",
        "770000000001",
        "4.50",
        "2.80",
        "12",
        "Bodega principal",
        "Unidad",
        "Productos",
        "15",
        "true",
      ].map(csvEscape).join(","),
      [
        "Taza corporativa",
        "TAZA-001",
        "770000000002",
        "7.99",
        "4.10",
        "6",
        "Sucursal Norte",
        "Unidad",
        "Promocionales",
        "15",
        "true",
      ].map(csvEscape).join(","),
    ].join("\n");
  }

  return [
    "nombre,identificacion,telefono,email,direccion,ciudad,tipo_cliente,activo",
    [
      "Comercial Andina",
      "1799999999001",
      "0999000001",
      "compras@comercialandina.ec",
      "Av. Principal 123",
      "Quito",
      "Company",
      "true",
    ].map(csvEscape).join(","),
    [
      "María Pérez",
      "0912345678",
      "0999000002",
      "maria.perez@email.ec",
      "Cdla. Los Ceibos Mz 4",
      "Guayaquil",
      "Individual",
      "true",
    ].map(csvEscape).join(","),
  ].join("\n");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      currentRow.push(currentField.trim());
      currentField = "";

      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((value) => value.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function getRowValue(headers: string[], row: string[], keys: string[]) {
  for (const key of keys) {
    const index = headers.indexOf(key);
    if (index !== -1) {
      return row[index] ?? "";
    }
  }

  return "";
}

async function resolveDefaultTerritory(territories: ErpnextTerritory[]) {
  return (
    territories.find((territory) =>
      [territory.name, territory.territory_name ?? ""].some(
        (value) => value.trim().toLowerCase() === "ecuador"
      )
    )?.name ??
    territories.find((territory) =>
      [territory.name, territory.territory_name ?? ""].some(
        (value) => value.trim().toLowerCase() === "all territories"
      )
    )?.name ??
    territories[0]?.name ??
    null
  );
}

function buildPreviewSummary(rows: Array<ProductImportPreviewRow | CustomerImportPreviewRow>) {
  return {
    totalRows: rows.length,
    readyRows: rows.filter((row) => row.status === "ready").length,
    warningRows: rows.filter((row) => row.status === "warning").length,
    errorRows: rows.filter((row) => row.status === "error").length,
    createRows: rows.filter((row) => row.action === "create").length,
    updateRows: rows.filter((row) => row.action === "update").length,
  };
}

async function buildProductPreview(
  tenantId: string,
  csvText: string
): Promise<BillingImportPreviewResult> {
  const [masterData, items, warehouses] = await Promise.all([
    resolveBusinessSuiteErpMasterData(tenantId, { dryRun: true }),
    getErpnextItems(),
    getErpnextWarehouses(),
  ]);

  const parsed = parseCsv(csvText);
  if (parsed.length <= 1) {
    return {
      type: "products",
      rows: [],
      summary: {
        totalRows: 0,
        readyRows: 0,
        warningRows: 0,
        errorRows: 0,
        createRows: 0,
        updateRows: 0,
      },
      masterData,
      blockers: ["El archivo CSV no contiene filas de productos para importar."],
      warnings: masterData.warnings,
    };
  }

  const headers = parsed[0].map((header) => normalizeText(header));
  const records = parsed.slice(1);
  if (records.length > MAX_IMPORT_ROWS) {
    return {
      type: "products",
      rows: [],
      summary: {
        totalRows: 0,
        readyRows: 0,
        warningRows: 0,
        errorRows: 0,
        createRows: 0,
        updateRows: 0,
      },
      masterData,
      blockers: [`El archivo supera el límite inicial de ${MAX_IMPORT_ROWS} filas.`],
      warnings: masterData.warnings,
    };
  }

  const activeWarehouses = warehouses.filter((warehouse) => warehouse.disabled !== 1 && warehouse.is_group !== 1);
  const byItemCode = new Map(items.map((item) => [normalizeText(item.item_code), item]));
  const byBarcode = new Map(
    items
      .filter((item) => item.barcode?.trim())
      .map((item) => [normalizeText(item.barcode ?? ""), item])
  );
  const byName = new Map(items.map((item) => [normalizeText(item.item_name), item]));

  const rows: ProductImportPreviewRow[] = records.map((row, index) => {
    const name = getRowValue(headers, row, ["nombre", "name"]);
    const sku = getRowValue(headers, row, ["sku", "codigo", "código", "item_code"]);
    const barcode = getRowValue(headers, row, ["barcode", "codigo_barras", "código de barras"]);
    const price = parseNumber(getRowValue(headers, row, ["precio", "price"]));
    const cost = parseNumber(getRowValue(headers, row, ["costo", "cost"]));
    const initialStock = parseNumber(getRowValue(headers, row, ["stock_inicial", "stock inicial", "stock"])) ?? 0;
    const warehouseInput = getRowValue(headers, row, ["bodega", "warehouse"]);
    const uomInput = getRowValue(headers, row, ["unidad", "uom"]);
    const categoryInput = getRowValue(headers, row, ["categoria", "categoría", "grupo", "category"]);
    const taxRate = parseNumber(getRowValue(headers, row, ["iva", "impuesto", "tax"]));
    const active = parseBoolean(getRowValue(headers, row, ["activo", "active"]));

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name.trim()) errors.push("Falta el nombre del producto.");
    if (!sku.trim() && !barcode.trim()) {
      warnings.push("No se indicó SKU ni código de barras; se intentará resolver por nombre.");
    }
    if (price == null || price < 0) errors.push("El precio es inválido.");
    if (cost != null && cost < 0) errors.push("El costo es inválido.");
    if (initialStock < 0) errors.push("El stock inicial no puede ser negativo.");

    const matchedWarehouse =
      activeWarehouses.find(
        (warehouse) =>
          normalizeText(warehouse.name) === normalizeText(warehouseInput) ||
          normalizeText(warehouse.warehouse_name) === normalizeText(warehouseInput)
      ) ?? null;

    if (warehouseInput.trim() && !matchedWarehouse) {
      warnings.push(
        `La bodega "${warehouseInput}" no existe; se usará ${masterData.warehouseName ?? "la bodega principal resuelta"}.`
      );
    }

    if (!uomInput.trim() && masterData.uomName) {
      warnings.push(`No se indicó unidad; se usará ${masterData.uomName}.`);
    }
    if (!categoryInput.trim() && masterData.itemGroupName) {
      warnings.push(`No se indicó categoría; se usará ${masterData.itemGroupName}.`);
    }

    const existing =
      (sku.trim() ? byItemCode.get(normalizeText(sku)) : null) ??
      (barcode.trim() ? byBarcode.get(normalizeText(barcode)) : null) ??
      byName.get(normalizeText(name));

    const payload = {
      name: name.trim(),
      itemCode: sku.trim() || barcode.trim() || `IMP-${index + 1}`,
      barcode: barcode.trim() || null,
      price: price ?? 0,
      cost,
      initialStock,
      warehouse: matchedWarehouse?.name ?? masterData.warehouseName,
      uom: uomInput.trim() || masterData.uomName,
      itemGroup: categoryInput.trim() || masterData.itemGroupName,
      taxRate,
      active,
    };

    if (!payload.uom) errors.push("No se pudo resolver una unidad válida para esta fila.");
    if (!payload.itemGroup) errors.push("No se pudo resolver una categoría válida para esta fila.");
    if (!payload.warehouse && initialStock > 0) {
      errors.push("No se pudo resolver una bodega válida para el stock inicial.");
    }

    const status =
      errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ready";

    return {
      kind: "product",
      index: index + 1,
      status,
      action: existing ? "update" : "create",
      identifier: payload.itemCode,
      name: payload.name,
      errors,
      warnings,
      payload,
    };
  });

  return {
    type: "products",
    rows,
    summary: buildPreviewSummary(rows),
    masterData,
    blockers: masterData.blockers,
    warnings: masterData.warnings,
  };
}

async function buildCustomerPreview(
  tenantId: string,
  csvText: string
): Promise<BillingImportPreviewResult> {
  const [masterData, customers, territories] = await Promise.all([
    resolveBusinessSuiteErpMasterData(tenantId, { dryRun: true }),
    getErpnextCustomers(),
    getErpnextTerritories(),
  ]);

  const defaultTerritory = await resolveDefaultTerritory(territories);
  const parsed = parseCsv(csvText);
  if (parsed.length <= 1) {
    return {
      type: "customers",
      rows: [],
      summary: {
        totalRows: 0,
        readyRows: 0,
        warningRows: 0,
        errorRows: 0,
        createRows: 0,
        updateRows: 0,
      },
      masterData: { ...masterData, territory: defaultTerritory ?? masterData.territory },
      blockers: ["El archivo CSV no contiene filas de clientes para importar."],
      warnings: masterData.warnings,
    };
  }

  const headers = parsed[0].map((header) => normalizeText(header));
  const records = parsed.slice(1);
  if (records.length > MAX_IMPORT_ROWS) {
    return {
      type: "customers",
      rows: [],
      summary: {
        totalRows: 0,
        readyRows: 0,
        warningRows: 0,
        errorRows: 0,
        createRows: 0,
        updateRows: 0,
      },
      masterData: { ...masterData, territory: defaultTerritory ?? masterData.territory },
      blockers: [`El archivo supera el límite inicial de ${MAX_IMPORT_ROWS} filas.`],
      warnings: masterData.warnings,
    };
  }

  const byTaxId = new Map(
    customers
      .filter((customer) => customer.tax_id?.trim())
      .map((customer) => [normalizeText(customer.tax_id ?? ""), customer])
  );
  const byEmail = new Map(
    customers
      .filter((customer) => customer.email_id?.trim())
      .map((customer) => [normalizeText(customer.email_id ?? ""), customer])
  );
  const byPhone = new Map(
    customers
      .filter((customer) => customer.mobile_no?.trim())
      .map((customer) => [normalizeText(customer.mobile_no ?? ""), customer])
  );
  const byName = new Map(customers.map((customer) => [normalizeText(customer.customer_name), customer]));

  const rows: CustomerImportPreviewRow[] = records.map((row, index) => {
    const name = getRowValue(headers, row, ["nombre", "name"]);
    const taxId = getRowValue(headers, row, ["identificacion", "identificación", "ruc", "cedula", "cédula", "tax_id"]);
    const phone = getRowValue(headers, row, ["telefono", "teléfono", "phone", "mobile_no"]);
    const email = getRowValue(headers, row, ["email", "correo", "email_id"]);
    const address = getRowValue(headers, row, ["direccion", "dirección", "address"]);
    const city = getRowValue(headers, row, ["ciudad", "city"]);
    const customerTypeInput = getRowValue(headers, row, ["tipo_cliente", "tipo cliente", "customer_type"]);
    const active = parseBoolean(getRowValue(headers, row, ["activo", "active"]));
    const customerType: "Individual" | "Company" =
      normalizeText(customerTypeInput) === "company" || normalizeText(customerTypeInput) === "empresa"
        ? "Company"
        : "Individual";

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name.trim()) errors.push("Falta el nombre del cliente.");
    const existing =
      (taxId.trim() ? byTaxId.get(normalizeText(taxId)) : null) ??
      (email.trim() ? byEmail.get(normalizeText(email)) : null) ??
      (phone.trim() ? byPhone.get(normalizeText(phone)) : null) ??
      byName.get(normalizeText(name));

    const territory = defaultTerritory ?? masterData.territory;
    if (!territory) errors.push("No se pudo resolver un territorio válido para clientes.");
    if (!taxId.trim() && !email.trim() && !phone.trim()) {
      warnings.push("No se indicó identificación, email ni teléfono; se intentará resolver por nombre.");
    }

    const payload = {
      name: name.trim(),
      taxId: taxId.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      customerType,
      territory,
      active,
    };

    const status =
      errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ready";

    return {
      kind: "customer",
      index: index + 1,
      status,
      action: existing ? "update" : "create",
      identifier: payload.taxId ?? payload.email ?? payload.phone ?? payload.name,
      name: payload.name,
      errors,
      warnings,
      payload,
    };
  });

  return {
    type: "customers",
    rows,
    summary: buildPreviewSummary(rows),
    masterData: { ...masterData, territory: defaultTerritory ?? masterData.territory },
    blockers: masterData.blockers,
    warnings: masterData.warnings,
  };
}

export async function buildBillingImportPreview(
  tenantId: string,
  type: BillingImportType,
  csvText: string
) {
  return type === "products"
    ? buildProductPreview(tenantId, csvText)
    : buildCustomerPreview(tenantId, csvText);
}

async function upsertPricingForImport(
  tenantId: string,
  itemCode: string,
  itemName: string,
  retailPrice: number
) {
  const prisma = getPrismaClient();
  await prisma.erpProductPricing.upsert({
    where: { tenantId_itemCode: { tenantId, itemCode } },
    create: { tenantId, itemCode, itemName, retailPrice },
    update: { itemName, retailPrice },
  });
}

async function maybeImportStock(
  itemCode: string,
  warehouse: string,
  desiredQty: number,
  basicRate: number
) {
  if (desiredQty <= 0) return false;

  const bin = await getErpnextInventoryBin(itemCode, warehouse);
  const currentQty = bin?.actual_qty ?? 0;
  const delta = desiredQty - currentQty;
  if (delta <= 0) return false;

  await createAndSubmitErpnextStockEntry({
    item_code: itemCode,
    warehouse,
    qty: delta,
    basic_rate: basicRate > 0 ? basicRate : 0,
  });

  return true;
}

export async function confirmBillingImport(
  tenantId: string,
  type: BillingImportType,
  csvText: string,
  options: { updateExisting?: boolean } = {}
): Promise<BillingImportConfirmResult> {
  const preview = await buildBillingImportPreview(tenantId, type, csvText);
  const updateExisting = options.updateExisting !== false;
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  if (preview.blockers.length > 0) {
    return {
      type,
      created,
      updated,
      failed: preview.summary.errorRows,
      skipped,
      errors: preview.blockers,
      preview,
    };
  }

  const productRows = preview.rows.filter(
    (row): row is ProductImportPreviewRow => row.kind === "product"
  );
  const customerRows = preview.rows.filter(
    (row): row is CustomerImportPreviewRow => row.kind === "customer"
  );

  if (type === "products") {
    const items = await getErpnextItems();
    const byItemCode = new Map(items.map((item) => [normalizeText(item.item_code), item]));
    const byBarcode = new Map(
      items
        .filter((item) => item.barcode?.trim())
        .map((item) => [normalizeText(item.barcode ?? ""), item])
    );
    const byName = new Map(items.map((item) => [normalizeText(item.item_name), item]));

    for (const row of productRows) {
      if (row.errors.length > 0) {
        failed += 1;
        errors.push(`Fila ${row.index}: ${row.errors.join(" ")}`);
        continue;
      }

      const payload = row.payload;
      const existing =
        byItemCode.get(normalizeText(payload.itemCode)) ??
        (payload.barcode ? byBarcode.get(normalizeText(payload.barcode)) : null) ??
        byName.get(normalizeText(payload.name));

      try {
        if (existing) {
          if (!updateExisting) {
            skipped += 1;
            continue;
          }

          await updateErpnextItem(existing.name, {
            item_name: payload.name,
            item_group: payload.itemGroup ?? undefined,
            stock_uom: payload.uom ?? undefined,
            barcode: payload.barcode ?? undefined,
            is_stock_item: true,
          });

          if (payload.active === false) {
            await disableErpnextItem(existing.name).catch(() => undefined);
          }

          await upsertPricingForImport(tenantId, payload.itemCode, payload.name, payload.price);
          if (payload.warehouse && payload.initialStock > 0) {
            await maybeImportStock(
              payload.itemCode,
              payload.warehouse,
              payload.initialStock,
              payload.cost ?? payload.price
            );
          }

          updated += 1;
          continue;
        }

        const createdItem = await createErpnextItem({
          item_code: payload.itemCode,
          item_name: payload.name,
          barcode: payload.barcode ?? undefined,
          item_group: payload.itemGroup ?? preview.masterData.itemGroupName ?? "",
          stock_uom: payload.uom ?? preview.masterData.uomName ?? "",
          is_stock_item: true,
        });

        if (payload.active === false) {
          await disableErpnextItem(createdItem.name).catch(() => undefined);
        }

        await upsertPricingForImport(tenantId, payload.itemCode, payload.name, payload.price);
        if (payload.warehouse && payload.initialStock > 0) {
          await maybeImportStock(
            payload.itemCode,
            payload.warehouse,
            payload.initialStock,
            payload.cost ?? payload.price
          );
        }

        created += 1;
      } catch (error) {
        failed += 1;
        errors.push(
          `Fila ${row.index} (${payload.name}): ${
            error instanceof Error ? error.message : "Error inesperado"
          }`
        );
      }
    }
  } else {
    const customers = await getErpnextCustomers();
    const byTaxId = new Map(
      customers
        .filter((customer) => customer.tax_id?.trim())
        .map((customer) => [normalizeText(customer.tax_id ?? ""), customer])
    );
    const byEmail = new Map(
      customers
        .filter((customer) => customer.email_id?.trim())
        .map((customer) => [normalizeText(customer.email_id ?? ""), customer])
    );
    const byPhone = new Map(
      customers
        .filter((customer) => customer.mobile_no?.trim())
        .map((customer) => [normalizeText(customer.mobile_no ?? ""), customer])
    );
    const byName = new Map(
      customers.map((customer) => [normalizeText(customer.customer_name), customer])
    );

    for (const row of customerRows) {
      if (row.errors.length > 0) {
        failed += 1;
        errors.push(`Fila ${row.index}: ${row.errors.join(" ")}`);
        continue;
      }

      const payload = row.payload;
      const existing =
        (payload.taxId ? byTaxId.get(normalizeText(payload.taxId)) : null) ??
        (payload.email ? byEmail.get(normalizeText(payload.email)) : null) ??
        (payload.phone ? byPhone.get(normalizeText(payload.phone)) : null) ??
        byName.get(normalizeText(payload.name));

      try {
        if (existing) {
          if (!updateExisting) {
            skipped += 1;
            continue;
          }

          await updateErpnextCustomer(existing.name, {
            customer_name: payload.name,
            customer_type: payload.customerType,
            territory: payload.territory ?? preview.masterData.territory ?? "All Territories",
            tax_id: payload.taxId ?? undefined,
            mobile_no: payload.phone ?? undefined,
            email_id: payload.email ?? undefined,
          });
          if (payload.address) {
            await createErpnextCustomerAddress(existing.name, payload.city ? `${payload.address} - ${payload.city}` : payload.address).catch(() => undefined);
          }
          if (payload.active === false) {
            await disableErpnextCustomer(existing.name).catch(() => undefined);
          }

          updated += 1;
          continue;
        }

        const createdCustomer = await createErpnextCustomer({
          customer_name: payload.name,
          customer_type: payload.customerType,
          territory: payload.territory ?? preview.masterData.territory ?? "All Territories",
          tax_id: payload.taxId ?? undefined,
          mobile_no: payload.phone ?? undefined,
          email_id: payload.email ?? undefined,
        });
        if (payload.address) {
          await createErpnextCustomerAddress(
            createdCustomer.name,
            payload.city ? `${payload.address} - ${payload.city}` : payload.address
          ).catch(() => undefined);
        }
        if (payload.active === false) {
          await disableErpnextCustomer(createdCustomer.name).catch(() => undefined);
        }

        created += 1;
      } catch (error) {
        failed += 1;
        errors.push(
          `Fila ${row.index} (${payload.name}): ${
            error instanceof Error ? error.message : "Error inesperado"
          }`
        );
      }
    }
  }

  return {
    type,
    created,
    updated,
    failed,
    skipped,
    errors,
    preview,
  };
}
