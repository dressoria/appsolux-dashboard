"use client";

import { useState } from "react";
import {
  AccountingPreviewCard,
  PosPreviewCard,
} from "@/components/appsolux/erp/coming-soon-modules";
import { AdjustStockForm } from "@/components/appsolux/erp/adjust-stock-form";
import { CreateCustomerForm } from "@/components/appsolux/erp/create-customer-form";
import { CreateItemForm } from "@/components/appsolux/erp/create-item-form";
import { CreateStockEntryForm } from "@/components/appsolux/erp/create-stock-entry-form";
import { CreateWarehouseDialog } from "@/components/appsolux/erp/create-warehouse-dialog";
import { CustomersTable } from "@/components/appsolux/erp/customers-table";
import { ErpSummary } from "@/components/appsolux/erp/erp-summary";
import { InventoryTable } from "@/components/appsolux/erp/inventory-table";
import { ItemsTable } from "@/components/appsolux/erp/items-table";
import { StockLedgerTable } from "@/components/appsolux/erp/stock-ledger-table";
import { WarehousesTable } from "@/components/appsolux/erp/warehouses-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ErpnextBin,
  ErpnextCustomer,
  ErpnextItem,
  ErpnextMasters,
  ErpnextStockLedgerEntry,
  ErpnextWarehouse,
} from "@/types/erpnext";

type ErpTabId =
  | "summary"
  | "items"
  | "inventory"
  | "customers"
  | "warehouses"
  | "pos"
  | "billing";

type ErpTabsProps = {
  items: ErpnextItem[];
  warehouses: ErpnextWarehouse[];
  inventory: ErpnextBin[];
  stockLedgerEntries: ErpnextStockLedgerEntry[];
  customers: ErpnextCustomer[];
  masters: ErpnextMasters;
  masterWarnings: string[];
};

const tabs: { id: ErpTabId; label: string }[] = [
  { id: "summary", label: "Resumen" },
  { id: "items", label: "Productos" },
  { id: "inventory", label: "Inventario" },
  { id: "customers", label: "Clientes" },
  { id: "warehouses", label: "Bodegas" },
  { id: "pos", label: "POS" },
  { id: "billing", label: "Facturacion" },
];

const quickLinks: { tab: ErpTabId; title: string; description: string }[] = [
  {
    tab: "items",
    title: "Productos",
    description: "Catalogo e inventario vendible.",
  },
  {
    tab: "inventory",
    title: "Inventario",
    description: "Stock y entradas de bodega.",
  },
  {
    tab: "customers",
    title: "Clientes",
    description: "Contactos para ventas y seguimiento.",
  },
  {
    tab: "warehouses",
    title: "Bodegas",
    description: "Ubicaciones y estructura de stock.",
  },
  {
    tab: "pos",
    title: "POS",
    description: "Punto de venta planificado.",
  },
  {
    tab: "billing",
    title: "Facturacion",
    description: "Documentos contables proximamente.",
  },
];

function ConnectionPanel({ masterWarnings }: { masterWarnings: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexion ERP</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          ERP conectado. Los datos y formularios usan informacion real.
        </p>
        {masterWarnings.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {masterWarnings.map((warning) => (
              <span
                key={warning}
                className="inline-flex h-6 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700"
              >
                {warning}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Configuracion principal disponible para operar productos y clientes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function QuickAccessPanel({
  onSelectTab,
}: {
  onSelectTab: (tab: ErpTabId) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {quickLinks.map((link) => (
        <button
          key={link.tab}
          type="button"
          onClick={() => onSelectTab(link.tab)}
          className="rounded-xl border bg-card p-3 text-left text-sm ring-1 ring-foreground/5 transition-colors hover:bg-muted"
        >
          <span className="font-medium">{link.title}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {link.description}
          </span>
        </button>
      ))}
    </div>
  );
}

function SummaryTab({
  items,
  warehouses,
  inventory,
  customers,
  masterWarnings,
  onSelectTab,
}: {
  items: ErpnextItem[];
  warehouses: ErpnextWarehouse[];
  inventory: ErpnextBin[];
  customers: ErpnextCustomer[];
  masterWarnings: string[];
  onSelectTab: (tab: ErpTabId) => void;
}) {
  return (
    <div className="space-y-4">
      <ErpSummary
        itemsCount={items.length}
        warehousesCount={warehouses.length}
        customersCount={customers.length}
        inventoryRowsCount={inventory.length}
      />
      <ConnectionPanel masterWarnings={masterWarnings} />
      <Card>
        <CardHeader>
          <CardTitle>Que puedes hacer aqui</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Crea productos y clientes reales, revisa stock y agrega unidades a
            tus bodegas. Usa las pestanas para trabajar por area.
          </p>
        </CardContent>
      </Card>
      <QuickAccessPanel onSelectTab={onSelectTab} />
    </div>
  );
}

export function ErpTabs({
  items,
  warehouses,
  inventory,
  stockLedgerEntries,
  customers,
  masters,
  masterWarnings,
}: ErpTabsProps) {
  const [activeTab, setActiveTab] = useState<ErpTabId>("summary");

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-1 rounded-xl border bg-card p-1 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  activeTab === tab.id
                    ? "rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background shadow-sm"
                    : "rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "summary" ? (
          <SummaryTab
            items={items}
            warehouses={warehouses}
            inventory={inventory}
            customers={customers}
            masterWarnings={masterWarnings}
            onSelectTab={setActiveTab}
          />
        ) : null}

        {activeTab === "items" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Productos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Los productos se crean en tu ERP usando categorias y unidades
                  reales.
                </p>
              </CardContent>
            </Card>
            <CreateItemForm
              itemGroups={masters.itemGroups}
              uoms={masters.uoms}
            />
            <ItemsTable
              items={items}
              itemGroups={masters.itemGroups}
              uoms={masters.uoms}
            />
          </div>
        ) : null}

        {activeTab === "inventory" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inventario / stock</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Agregar stock registra y confirma el movimiento para
                  actualizar el inventario automaticamente.
                </p>
              </CardContent>
            </Card>
            <CreateStockEntryForm items={items} warehouses={warehouses} />
            <AdjustStockForm items={items} warehouses={warehouses} />
            <InventoryTable inventory={inventory} />
            <StockLedgerTable
              entries={stockLedgerEntries}
              items={items}
              warehouses={warehouses}
            />
          </div>
        ) : null}

        {activeTab === "customers" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Los clientes se registran usando ubicaciones reales para
                  futuras ventas, seguimiento y facturacion.
                </p>
              </CardContent>
            </Card>
            <CreateCustomerForm territories={masters.territories} />
            <CustomersTable
              customers={customers}
              territories={masters.territories}
            />
          </div>
        ) : null}

        {activeTab === "warehouses" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle>Bodegas / ubicaciones</CardTitle>
                  <CreateWarehouseDialog companies={masters.companies} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Una bodega o ubicacion es el lugar donde guardas productos:
                  local principal, sucursal, mostrador o bodega central. Las
                  bodegas utilizables reciben stock. Las bodegas de grupo solo
                  organizan la estructura y no se usan directamente para
                  movimientos.
                </p>
              </CardContent>
            </Card>
            <WarehousesTable warehouses={warehouses} />
          </div>
        ) : null}

        {activeTab === "pos" ? <PosPreviewCard /> : null}
        {activeTab === "billing" ? <AccountingPreviewCard /> : null}
      </div>
    </div>
  );
}
