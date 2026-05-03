"use client";

import { useState } from "react";
import {
  AccountingPreviewCard,
  PosPreviewCard,
} from "@/components/appsolux/erp/coming-soon-modules";
import { CreateCustomerForm } from "@/components/appsolux/erp/create-customer-form";
import { CreateItemForm } from "@/components/appsolux/erp/create-item-form";
import { CreateStockEntryForm } from "@/components/appsolux/erp/create-stock-entry-form";
import { CustomersTable } from "@/components/appsolux/erp/customers-table";
import { ErpSummary } from "@/components/appsolux/erp/erp-summary";
import { InventoryTable } from "@/components/appsolux/erp/inventory-table";
import { ItemsTable } from "@/components/appsolux/erp/items-table";
import { WarehousesTable } from "@/components/appsolux/erp/warehouses-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ErpnextBin,
  ErpnextCustomer,
  ErpnextItem,
  ErpnextMasters,
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
        <CardTitle>Conexion ERPNext</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          ERP conectado a ERPNext. Los datos y formularios usan informacion real.
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
            Maestros principales disponibles para operar productos y clientes.
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
            Crea productos y clientes reales, revisa stock y registra entradas
            de inventario en borrador. Usa las pestañas para trabajar por area.
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
  customers,
  masters,
  masterWarnings,
}: ErpTabsProps) {
  const [activeTab, setActiveTab] = useState<ErpTabId>("summary");

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <ErpSummary
          itemsCount={items.length}
          warehousesCount={warehouses.length}
          customersCount={customers.length}
          inventoryRowsCount={inventory.length}
        />
        <ConnectionPanel masterWarnings={masterWarnings} />
        <QuickAccessPanel onSelectTab={setActiveTab} />
      </div>

      <div className="space-y-4">
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-2 rounded-xl border bg-muted/40 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  activeTab === tab.id
                    ? "rounded-lg bg-background px-3 py-2 text-sm font-medium shadow-sm"
                    : "rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
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
                <CardTitle>Productos reales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Los productos se crean directamente en ERPNext usando grupos y
                  unidades de medida reales.
                </p>
              </CardContent>
            </Card>
            <CreateItemForm
              itemGroups={masters.itemGroups}
              uoms={masters.uoms}
            />
            <ItemsTable items={items} />
          </div>
        ) : null}

        {activeTab === "inventory" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stock e ingresos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  La entrada de inventario crea un Stock Entry en borrador. No
                  se hace submit automatico.
                </p>
              </CardContent>
            </Card>
            <CreateStockEntryForm items={items} warehouses={warehouses} />
            <InventoryTable inventory={inventory} />
          </div>
        ) : null}

        {activeTab === "customers" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Clientes reales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Los clientes se registran en ERPNext usando territorios reales
                  para futuras ventas, seguimiento y facturacion.
                </p>
              </CardContent>
            </Card>
            <CreateCustomerForm territories={masters.territories} />
            <CustomersTable customers={customers} />
          </div>
        ) : null}

        {activeTab === "warehouses" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bodegas y estructura</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Las bodegas de grupo ordenan la estructura. Los movimientos de
                  stock usan solo bodegas no-grupo.
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
