import "@/lib/security/server-only";
import { getErpnextInventoryBin } from "./inventory";
import { getErpnextItems } from "./items";
import {
  createErpnextStockMovement,
  getErpnextStockEntry,
  submitErpnextStockEntry,
} from "./stock-entries";
import { getErpnextWarehouses } from "./warehouses";
import type {
  CreateStockAdjustmentInput,
  StockAdjustmentResult,
} from "@/types/erpnext";

export async function createErpnextStockAdjustment(
  input: CreateStockAdjustmentInput
): Promise<StockAdjustmentResult> {
  const [items, warehouses, bin] = await Promise.all([
    getErpnextItems(),
    getErpnextWarehouses(),
    getErpnextInventoryBin(input.item_code, input.warehouse),
  ]);
  const item = items.find((erpItem) => erpItem.item_code === input.item_code);
  const warehouse = warehouses.find(
    (erpWarehouse) => erpWarehouse.name === input.warehouse
  );

  if (!item) {
    throw new Error("El producto seleccionado no existe.");
  }

  if (!warehouse || warehouse.disabled === 1) {
    throw new Error("Selecciona una bodega utilizable.");
  }

  if (warehouse.is_group === 1) {
    throw new Error("Las bodegas de grupo no reciben ajustes de stock.");
  }

  const previousQty = bin?.actual_qty ?? 0;
  const difference = input.counted_qty - previousQty;

  if (difference === 0) {
    return {
      item_code: input.item_code,
      warehouse: input.warehouse,
      previous_qty: previousQty,
      counted_qty: input.counted_qty,
      difference,
      document_name: null,
    };
  }

  const stockEntry = await createErpnextStockMovement({
    item_code: input.item_code,
    warehouse: input.warehouse,
    qty: Math.abs(difference),
    basic_rate: 0,
    movement: difference > 0 ? "in" : "out",
    remarks: [input.reason, input.note].filter(Boolean).join(" - "),
  });
  const fullStockEntry = await getErpnextStockEntry(stockEntry.name);
  const submittedStockEntry = await submitErpnextStockEntry(fullStockEntry);

  return {
    item_code: input.item_code,
    warehouse: input.warehouse,
    previous_qty: previousQty,
    counted_qty: input.counted_qty,
    difference,
    document_name: submittedStockEntry.name,
  };
}
