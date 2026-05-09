"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  ExternalLink,
  Package,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sliders,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import type {
  ErpnextBin,
  ErpnextCustomer,
  ErpnextItem,
  ErpnextMasters,
  ErpnextStockLedgerEntry,
  ErpnextWarehouse,
} from "@/types/erpnext";

// ─── Types ────────────────────────────────────────────────────────────────────

type ErpSectionId =
  | "items"
  | "customers"
  | "warehouses"
  | "inventory"
  | "stock-ledger";

type SubItemStatus =
  | "available"
  | "coming-soon"
  | "in-preparation"
  | "requires-config";

type SubItem = {
  label: string;
  status: SubItemStatus;
  sectionId?: ErpSectionId;
  href?: string;
  badge?: string;
};

type Module = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  items: SubItem[];
};

type ErpTabsProps = {
  items: ErpnextItem[];
  warehouses: ErpnextWarehouse[];
  inventory: ErpnextBin[];
  stockLedgerEntries: ErpnextStockLedgerEntry[];
  customers: ErpnextCustomer[];
  masters: ErpnextMasters;
  masterWarnings: string[];
};

// ─── Module Definitions ───────────────────────────────────────────────────────

const MODULES: Module[] = [
  {
    id: "ventas",
    label: "Ventas",
    description: "POS, facturas, pedidos, pagos y clientes.",
    icon: ShoppingCart,
    iconColor: "bg-blue-50 text-blue-600",
    items: [
      { label: "Punto de venta (POS)", status: "available", href: routes.pos },
      {
        label: "Facturas / comprobantes",
        status: "available",
        href: routes.posInvoices,
      },
      {
        label: "Pedidos / ordenes de venta",
        status: "available",
        href: routes.posOrders,
      },
      {
        label: "Pagos recibidos",
        status: "available",
        href: routes.posPayments,
      },
      { label: "Proformas / cotizaciones", status: "coming-soon" },
      { label: "Clientes", status: "available", sectionId: "customers" },
      { label: "Cuentas por cobrar", status: "coming-soon" },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    description: "Proveedores, ingresos y cuentas por pagar.",
    icon: ShoppingBag,
    iconColor: "bg-orange-50 text-orange-600",
    items: [
      {
        label: "Proveedores",
        status: "available",
        href: routes.erpPurchasesSuppliers,
      },
      {
        label: "Ordenes de compra",
        status: "available",
        href: routes.erpPurchasesDocuments,
      },
      {
        label: "Facturas recibidas",
        status: "available",
        href: routes.erpPurchasesDocuments,
      },
      {
        label: "Ingresos de mercaderia",
        status: "available",
        href: routes.erpPurchasesReceipts,
      },
      {
        label: "Cuentas por pagar",
        status: "available",
        href: routes.erpPurchasesPayables,
      },
      { label: "Pagos a proveedores", status: "coming-soon" },
    ],
  },
  {
    id: "inventario",
    label: "Inventario",
    description: "Productos, bodegas, stock, movimientos y ajustes.",
    icon: Package,
    iconColor: "bg-violet-50 text-violet-600",
    items: [
      {
        label: "Productos",
        status: "available",
        href: routes.erpInventoryProducts,
      },
      { label: "Categorias y unidades", status: "in-preparation" },
      {
        label: "Bodegas / ubicaciones",
        status: "available",
        href: routes.erpInventoryWarehouses,
      },
      {
        label: "Stock actual",
        status: "available",
        href: routes.erpInventoryStock,
      },
      {
        label: "Ajustes de inventario",
        status: "available",
        href: routes.erpInventoryAdjustments,
      },
      {
        label: "Movimientos / historial",
        status: "available",
        href: routes.erpInventoryMovements,
      },
      {
        label: "Kardex por producto",
        status: "available",
        href: routes.erpInventoryKardex,
      },
      { label: "Transferencias entre bodegas", status: "in-preparation" },
      { label: "Toma fisica", status: "coming-soon" },
      {
        label: "Ingresos de mercaderia",
        status: "available",
        href: routes.erpPurchasesReceipts,
      },
      {
        label: "Stock bajo / sin stock",
        status: "available",
        href: routes.reports,
      },
      { label: "Inventario valorizado", status: "coming-soon" },
    ],
  },
  {
    id: "caja-bancos",
    label: "Caja y bancos",
    description: "Movimientos, cierres y conciliación.",
    icon: CreditCard,
    iconColor: "bg-emerald-50 text-emerald-600",
    items: [
      { label: "Caja", status: "in-preparation" },
      {
        label: "Métodos de pago",
        status: "requires-config",
        href: routes.settings,
      },
      { label: "Movimientos de caja", status: "in-preparation" },
      { label: "Cierres de caja", status: "in-preparation" },
      { label: "Bancos", status: "in-preparation" },
      { label: "Conciliación bancaria", status: "coming-soon" },
    ],
  },
  {
    id: "clientes-proveedores",
    label: "Clientes y proveedores",
    description: "Directorio comercial y saldos.",
    icon: Users,
    iconColor: "bg-sky-50 text-sky-600",
    items: [
      { label: "Clientes", status: "available", sectionId: "customers" },
      {
        label: "Proveedores",
        status: "available",
        href: routes.erpPurchasesSuppliers,
      },
      { label: "Historial de transacciones", status: "coming-soon" },
      { label: "Saldos pendientes", status: "coming-soon" },
    ],
  },
  {
    id: "facturacion",
    label: "Facturación e impuestos",
    description: "Documentos electrónicos y cumplimiento fiscal.",
    icon: Receipt,
    iconColor: "bg-rose-50 text-rose-600",
    items: [
      { label: "Documentos electrónicos", status: "coming-soon" },
      {
        label: "Facturación electrónica",
        status: "coming-soon",
        badge: "Ecuador",
      },
      { label: "Retenciones", status: "coming-soon", badge: "Ecuador" },
      { label: "ATS", status: "coming-soon", badge: "Ecuador" },
      { label: "Configuración fiscal", status: "in-preparation" },
      { label: "Impuestos por país", status: "coming-soon" },
    ],
  },
  {
    id: "contabilidad",
    label: "Contabilidad",
    description: "Plan de cuentas, libros y estados financieros.",
    icon: BookOpen,
    iconColor: "bg-indigo-50 text-indigo-600",
    items: [
      { label: "Plan de cuentas", status: "in-preparation" },
      { label: "Libro diario", status: "in-preparation" },
      { label: "Libro mayor", status: "in-preparation" },
      { label: "Estado de resultados", status: "in-preparation" },
      { label: "Balance general", status: "in-preparation" },
      { label: "Balance de comprobación", status: "in-preparation" },
    ],
  },
  {
    id: "reportes",
    label: "Reportes",
    description: "Ventas, inventario, caja y análisis.",
    icon: BarChart3,
    iconColor: "bg-teal-50 text-teal-600",
    items: [
      { label: "Ventas y cobros", status: "available", href: routes.reports },
      { label: "Inventario y stock", status: "available", href: routes.reports },
      { label: "Caja y pagos", status: "available", href: routes.reports },
      { label: "Clientes y cartera", status: "available", href: routes.reports },
      {
        label: "Productos más vendidos",
        status: "available",
        href: routes.reports,
      },
      {
        label: "Stock bajo mínimo",
        status: "available",
        href: routes.reports,
      },
      { label: "Cuentas por cobrar", status: "coming-soon" },
      { label: "Cuentas por pagar", status: "coming-soon" },
    ],
  },
  {
    id: "empresa",
    label: "Empresa y configuración",
    description: "Empresa, sucursales, usuarios y datos fiscales.",
    icon: Building2,
    iconColor: "bg-slate-50 text-slate-600",
    items: [
      { label: "Empresa", status: "available", href: routes.settings },
      {
        label: "Sucursales / bodegas",
        status: "available",
        sectionId: "warehouses",
      },
      {
        label: "Usuarios y permisos",
        status: "available",
        href: routes.settings,
      },
      {
        label: "Métodos de pago",
        status: "available",
        href: routes.settings,
      },
      { label: "Cuentas de caja / banco", status: "in-preparation" },
      { label: "Datos fiscales", status: "available", href: routes.settings },
    ],
  },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<SubItemStatus, { label: string; className: string }> =
  {
    available: {
      label: "Disponible",
      className: "border-green-200 bg-green-50 text-green-700",
    },
    "coming-soon": {
      label: "Próximamente",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    },
    "in-preparation": {
      label: "En preparación",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    "requires-config": {
      label: "Configurar",
      className: "border-orange-200 bg-orange-50 text-orange-700",
    },
  };

function StatusBadge({ status }: { status: SubItemStatus }) {
  const { label, className } = STATUS_MAP[status];
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

// ─── Sub Item Row ─────────────────────────────────────────────────────────────

function SubItemRow({
  item,
  onNavigate,
}: {
  item: SubItem;
  onNavigate: (s: ErpSectionId) => void;
}) {
  const isAvailable = item.status === "available";

  if (isAvailable && item.href) {
    return (
      <Link
        href={item.href}
        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
      >
        <span className="leading-tight">{item.label}</span>
        <ExternalLink className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  if (isAvailable && item.sectionId) {
    return (
      <button
        type="button"
        onClick={() => onNavigate(item.sectionId!)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
      >
        <span className="leading-tight">{item.label}</span>
        <ArrowRight className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm">
      <span className="leading-tight text-muted-foreground">{item.label}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        {item.badge ? (
          <span className="inline-flex h-4 items-center rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-500">
            {item.badge}
          </span>
        ) : null}
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}

// ─── Module Card ──────────────────────────────────────────────────────────────

function ModuleCard({
  module,
  onNavigate,
}: {
  module: Module;
  onNavigate: (s: ErpSectionId) => void;
}) {
  const Icon = module.icon;
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <div className={`rounded-xl p-2.5 ${module.iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold leading-tight">{module.label}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {module.description}
          </p>
        </div>
      </div>
      <div className="p-2">
        {module.items.map((item) => (
          <SubItemRow key={item.label} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

type QuickAction = {
  label: string;
  description: string;
  icon: LucideIcon;
  action: "navigate" | "href";
  sectionId?: ErpSectionId;
  href?: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Abrir POS",
    description: "Punto de venta",
    icon: Zap,
    action: "href",
    href: routes.pos,
  },
  {
    label: "Nuevo producto",
    description: "Agregar al catálogo",
    icon: Plus,
    action: "navigate",
    sectionId: "items",
  },
  {
    label: "Nuevo cliente",
    description: "Registrar contacto",
    icon: Users,
    action: "navigate",
    sectionId: "customers",
  },
  {
    label: "Ajustar inventario",
    description: "Entrada de stock",
    icon: Sliders,
    action: "navigate",
    sectionId: "inventory",
  },
  {
    label: "Ver reportes",
    description: "Análisis y métricas",
    icon: BarChart3,
    action: "href",
    href: routes.reports,
  },
  {
    label: "Configuración",
    description: "Empresa y ajustes",
    icon: Settings,
    action: "href",
    href: routes.settings,
  },
];

function QuickActions({
  onNavigate,
}: {
  onNavigate: (s: ErpSectionId) => void;
}) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Acciones rápidas
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_ACTIONS.map((qa) => {
          const Icon = qa.icon;
          const className =
            "flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center text-sm transition-colors hover:bg-muted";
          if (qa.action === "href" && qa.href) {
            return (
              <Link key={qa.label} href={qa.href} className={className}>
                <div className="rounded-xl bg-muted p-2.5">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-medium leading-tight">{qa.label}</span>
                <span className="text-xs text-muted-foreground">
                  {qa.description}
                </span>
              </Link>
            );
          }
          return (
            <button
              key={qa.label}
              type="button"
              onClick={() => qa.sectionId && onNavigate(qa.sectionId)}
              className={className}
            >
              <div className="rounded-xl bg-muted p-2.5">
                <Icon className="h-4 w-4" />
              </div>
              <span className="font-medium leading-tight">{qa.label}</span>
              <span className="text-xs text-muted-foreground">
                {qa.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── POS Section Card ─────────────────────────────────────────────────────────

function PosSection() {
  return (
    <Card className="border-foreground/10">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Punto de venta</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Usa el POS avanzado de Appsolux para vender con productos,
              clientes, bodegas, stock y pagos conectados al ERP.
            </p>
          </div>
          <span className="inline-flex h-6 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
            Disponible
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={routes.pos}>Abrir POS</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.posOrders}>Ver pedidos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.posInvoices}>Ver facturas</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.posPayments}>Ver pagos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.reports}>Ver reportes</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Purchases Flow Card ─────────────────────────────────────────────────────

function PurchasesSection() {
  return (
    <Card className="border-foreground/10">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Compras y proveedores</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Registra proveedores, gestiona compras, ingresos de mercaderia y
              cuentas por pagar conectados al ERP.
            </p>
          </div>
          <span className="inline-flex h-6 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
            Disponible
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={routes.erpPurchases}>Ver modulo de compras</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.erpPurchasesSuppliers}>Proveedores</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.erpPurchasesDocuments}>Compras</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.erpPurchasesPayables}>Cuentas por pagar</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Inventory Section Card ───────────────────────────────────────────────────

function InventorySectionCard() {
  return (
    <Card className="border-foreground/10">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Inventario</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Controla productos, stock, bodegas, movimientos y ajustes
              conectados al ERP.
            </p>
          </div>
          <span className="inline-flex h-6 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
            Disponible
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={routes.erpInventory}>Ver modulo de inventario</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.erpInventoryProducts}>Productos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.erpInventoryStock}>Stock actual</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.erpInventoryMovements}>Movimientos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.erpInventoryWarehouses}>Bodegas</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.erpInventoryAdjustments}>Ajustes</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Fiscal Notice Card ───────────────────────────────────────────────────────

function FiscalNoticeCard() {
  return (
    <Card className="border-rose-100 bg-rose-50/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-rose-500" />
          <CardTitle className="text-base">Facturación e impuestos</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          La facturación electrónica se activará por país. Para Ecuador se
          preparará integración con SRI, ATS, retenciones y documentos
          electrónicos.
        </p>
        <p>
          Otros países vendrán con su localización fiscal. Si tu país no está
          configurado, la facturación estará disponible como módulo genérico.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Connection Warnings ──────────────────────────────────────────────────────

function ConnectionWarnings({ masterWarnings }: { masterWarnings: string[] }) {
  if (masterWarnings.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
      <span className="text-sm font-medium text-amber-800">
        Configuración pendiente:
      </span>
      {masterWarnings.map((w) => (
        <span
          key={w}
          className="inline-flex h-6 items-center rounded-full border border-amber-200 bg-amber-100 px-2 text-xs font-medium text-amber-700"
        >
          {w}
        </span>
      ))}
    </div>
  );
}

// ─── Section Detail Headers & Views ──────────────────────────────────────────

const SECTION_LABELS: Record<ErpSectionId, string> = {
  items: "Productos",
  customers: "Clientes",
  warehouses: "Bodegas / ubicaciones",
  inventory: "Inventario y stock",
  "stock-ledger": "Movimientos de stock",
};

function SectionHeader({
  sectionId,
  onBack,
}: {
  sectionId: ErpSectionId;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al ERP
      </button>
      <h2 className="text-xl font-semibold">{SECTION_LABELS[sectionId]}</h2>
    </div>
  );
}

function ItemsSection({
  items,
  masters,
  onBack,
}: {
  items: ErpnextItem[];
  masters: ErpnextMasters;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader sectionId="items" onBack={onBack} />
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Los productos se crean en tu ERP usando categorías y unidades
            reales.
          </p>
        </CardContent>
      </Card>
      <CreateItemForm itemGroups={masters.itemGroups} uoms={masters.uoms} />
      <ItemsTable
        items={items}
        itemGroups={masters.itemGroups}
        uoms={masters.uoms}
      />
    </div>
  );
}

function CustomersSection({
  customers,
  masters,
  onBack,
}: {
  customers: ErpnextCustomer[];
  masters: ErpnextMasters;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader sectionId="customers" onBack={onBack} />
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Los clientes se registran usando ubicaciones reales para futuras
            ventas, seguimiento y facturación.
          </p>
        </CardContent>
      </Card>
      <CreateCustomerForm territories={masters.territories} />
      <CustomersTable
        customers={customers}
        territories={masters.territories}
      />
    </div>
  );
}

function WarehousesSection({
  warehouses,
  masters,
  onBack,
}: {
  warehouses: ErpnextWarehouse[];
  masters: ErpnextMasters;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader sectionId="warehouses" onBack={onBack} />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>Bodegas / ubicaciones</CardTitle>
            <CreateWarehouseDialog companies={masters.companies} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Una bodega o ubicación es el lugar donde guardas productos: local
            principal, sucursal, mostrador o bodega central.
          </p>
        </CardContent>
      </Card>
      <WarehousesTable warehouses={warehouses} />
    </div>
  );
}

function InventorySection({
  items,
  warehouses,
  inventory,
  onBack,
}: {
  items: ErpnextItem[];
  warehouses: ErpnextWarehouse[];
  inventory: ErpnextBin[];
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader sectionId="inventory" onBack={onBack} />
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Agregar stock registra y confirma el movimiento para actualizar el
            inventario automáticamente.
          </p>
        </CardContent>
      </Card>
      <CreateStockEntryForm items={items} warehouses={warehouses} />
      <AdjustStockForm items={items} warehouses={warehouses} />
      <InventoryTable inventory={inventory} />
    </div>
  );
}

function StockLedgerSection({
  stockLedgerEntries,
  items,
  warehouses,
  onBack,
}: {
  stockLedgerEntries: ErpnextStockLedgerEntry[];
  items: ErpnextItem[];
  warehouses: ErpnextWarehouse[];
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader sectionId="stock-ledger" onBack={onBack} />
      <StockLedgerTable
        entries={stockLedgerEntries}
        items={items}
        warehouses={warehouses}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ErpTabs({
  items,
  warehouses,
  inventory,
  stockLedgerEntries,
  customers,
  masters,
  masterWarnings,
}: ErpTabsProps) {
  const [activeSection, setActiveSection] = useState<ErpSectionId | null>(null);

  function handleBack() {
    setActiveSection(null);
  }

  if (activeSection === "items") {
    return (
      <ItemsSection items={items} masters={masters} onBack={handleBack} />
    );
  }
  if (activeSection === "customers") {
    return (
      <CustomersSection
        customers={customers}
        masters={masters}
        onBack={handleBack}
      />
    );
  }
  if (activeSection === "warehouses") {
    return (
      <WarehousesSection
        warehouses={warehouses}
        masters={masters}
        onBack={handleBack}
      />
    );
  }
  if (activeSection === "inventory") {
    return (
      <InventorySection
        items={items}
        warehouses={warehouses}
        inventory={inventory}
        onBack={handleBack}
      />
    );
  }
  if (activeSection === "stock-ledger") {
    return (
      <StockLedgerSection
        stockLedgerEntries={stockLedgerEntries}
        items={items}
        warehouses={warehouses}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="space-y-8">
      <ErpSummary
        itemsCount={items.length}
        warehousesCount={warehouses.length}
        customersCount={customers.length}
        inventoryRowsCount={inventory.length}
      />

      <ConnectionWarnings masterWarnings={masterWarnings} />

      <QuickActions onNavigate={setActiveSection} />

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Módulos
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              onNavigate={setActiveSection}
            />
          ))}
        </div>
      </div>

      <PosSection />

      <PurchasesSection />

      <InventorySectionCard />

      <FiscalNoticeCard />
    </div>
  );
}
