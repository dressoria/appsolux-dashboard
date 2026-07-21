import "@/lib/security/server-only";
import { getErpnextCustomers } from "@/lib/api/erpnext/customers";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpProductPricingMap } from "@/lib/core/erp-pricing";

export type PosNormalizedProduct = {
  id: string;
  name: string;
  price: string;
  stock: number;
  barcode?: string | null;
  taxRate: string;
  warehouseStock?: Record<string, number>;
};

export type PosNormalizedCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export async function loadSharedErpPosProducts(tenantId: string): Promise<PosNormalizedProduct[]> {
  const [items, inventory] = await Promise.all([
    getErpnextItems(),
    getErpnextInventory(),
  ]);

  const activeItems = items.filter((item) => item.disabled !== 1);
  const pricingMap = await getErpProductPricingMap(
    tenantId,
    activeItems.map((item) => item.item_code)
  );

  const totalStockByItem = inventory.reduce<Record<string, number>>((acc, bin) => {
    acc[bin.item_code] = (acc[bin.item_code] ?? 0) + (bin.actual_qty ?? 0);
    return acc;
  }, {});
  const warehouseStockByItem = inventory.reduce<Record<string, Record<string, number>>>(
    (acc, bin) => {
      if (!acc[bin.item_code]) {
        acc[bin.item_code] = {};
      }
      acc[bin.item_code][bin.warehouse] = Math.max(0, Math.floor(bin.actual_qty ?? 0));
      return acc;
    },
    {}
  );

  return activeItems.map((item) => ({
    id: item.item_code,
    name: item.item_name,
    price: String(pricingMap[item.item_code]?.retailPrice ?? 0),
    stock: Math.max(0, Math.floor(totalStockByItem[item.item_code] ?? 0)),
    barcode: item.barcode ?? item.item_code,
    taxRate: "15",
    warehouseStock: warehouseStockByItem[item.item_code] ?? {},
  }));
}

export async function loadSharedErpPosCustomers(): Promise<PosNormalizedCustomer[]> {
  const customers = await getErpnextCustomers();
  return customers
    .filter((c) => c.disabled !== 1)
    .map((customer) => ({
      id: customer.name,
      name: customer.customer_name,
      phone: null,
      email: null,
      address: null,
    }));
}
