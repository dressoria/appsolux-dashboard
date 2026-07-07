import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Boxes,
  Building2,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  HandCoins,
  LayoutGrid,
  LibraryBig,
  Package,
  PackageCheck,
  PackageOpen,
  RefreshCcw,
  ScanLine,
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Warehouse,
} from "lucide-react";

import { CoreMigrationNotice } from "@/components/appsolux/business-suite/core-migration-notice";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type QuickActionGroup = {
  title: string;
  items: {
    label: string;
    href: string;
    icon: LucideIcon;
    tone?: "primary" | "default" | "warning";
  }[];
};

type ModuleCard = {
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

const helpSteps = [
  {
    step: "1",
    title: "Crea productos",
    desc: "Organiza catalogo, categorias y unidades.",
    href: routes.erpInventoryProducts,
  },
  {
    step: "2",
    title: "Configura bodegas",
    desc: "Define sucursales y ubicaciones operativas.",
    href: routes.erpInventoryWarehouses,
  },
  {
    step: "3",
    title: "Ingresa o corrige stock",
    desc: "Registra ajustes, ingresos y conteos fisicos.",
    href: routes.erpInventoryAdjustments,
  },
  {
    step: "4",
    title: "Opera ventas y traslados",
    desc: "POS y transferencias actualizan la operacion.",
    href: routes.pos,
  },
  {
    step: "5",
    title: "Consulta kardex y reportes",
    desc: "Revisa movimientos y analisis de inventario.",
    href: routes.erpInventoryKardex,
  },
];

const quickActionGroups: QuickActionGroup[] = [
  {
    title: "Catalogo",
    items: [
      {
        label: "Ver productos",
        href: routes.erpInventoryProducts,
        icon: Package,
        tone: "primary",
      },
      {
        label: "Categorias",
        href: routes.erpInventoryCategories,
        icon: FolderKanban,
      },
      {
        label: "Unidades",
        href: routes.erpInventoryUnits,
        icon: Scale,
      },
      {
        label: "Ver bodegas",
        href: routes.erpInventoryWarehouses,
        icon: Warehouse,
      },
    ],
  },
  {
    title: "Stock",
    items: [
      {
        label: "Ver stock actual",
        href: routes.erpInventoryStock,
        icon: Boxes,
        tone: "primary",
      },
      {
        label: "Stock bajo",
        href: `${routes.erpInventoryStock}?filter=low`,
        icon: ShieldAlert,
        tone: "warning",
      },
      {
        label: "Sin stock",
        href: `${routes.erpInventoryStock}?filter=out`,
        icon: PackageOpen,
        tone: "warning",
      },
      {
        label: "Ajustar inventario",
        href: routes.erpInventoryAdjustments,
        icon: SlidersHorizontal,
      },
      {
        label: "Toma fisica",
        href: routes.erpInventoryPhysicalCount,
        icon: ScanLine,
      },
      {
        label: "Transferencias",
        href: routes.erpInventoryTransfers,
        icon: RefreshCcw,
      },
    ],
  },
  {
    title: "Analisis",
    items: [
      {
        label: "Ver movimientos",
        href: routes.erpInventoryMovements,
        icon: ClipboardList,
        tone: "primary",
      },
      {
        label: "Kardex",
        href: routes.erpInventoryKardex,
        icon: LibraryBig,
      },
      {
        label: "Inventario valorizado",
        href: routes.erpInventoryValuation,
        icon: HandCoins,
      },
      {
        label: "Ingresos de mercaderia",
        href: routes.erpPurchasesReceipts,
        icon: PackageCheck,
      },
    ],
  },
];

const inventoryModules: ModuleCard[] = [
  {
    title: "Productos",
    desc: "Gestiona catalogo, codigos y datos base del item.",
    href: routes.erpInventoryProducts,
    icon: Package,
    badge: "Catalogo",
  },
  {
    title: "Categorias",
    desc: "Ordena familias y grupos del catalogo.",
    href: routes.erpInventoryCategories,
    icon: FolderKanban,
    badge: "Catalogo",
  },
  {
    title: "Unidades",
    desc: "Define unidades para compras, stock y ventas.",
    href: routes.erpInventoryUnits,
    icon: Scale,
    badge: "Catalogo",
  },
  {
    title: "Stock actual",
    desc: "Revisa existencias por bodega y disponibilidad.",
    href: routes.erpInventoryStock,
    icon: Boxes,
    badge: "Stock",
  },
  {
    title: "Movimientos",
    desc: "Consulta entradas, salidas y ajustes recientes.",
    href: routes.erpInventoryMovements,
    icon: ClipboardList,
    badge: "Stock",
  },
  {
    title: "Ajustes de inventario",
    desc: "Corrige diferencias de inventario.",
    href: routes.erpInventoryAdjustments,
    icon: SlidersHorizontal,
    badge: "Stock",
  },
  {
    title: "Kardex por producto",
    desc: "Consulta kardex y movimientos por item.",
    href: routes.erpInventoryKardex,
    icon: LibraryBig,
    badge: "Analisis",
  },
  {
    title: "Bodegas / ubicaciones",
    desc: "Administra bodegas y puntos de almacenamiento.",
    href: routes.erpInventoryWarehouses,
    icon: Warehouse,
    badge: "Catalogo",
  },
  {
    title: "Transferencias",
    desc: "Mueve stock entre bodegas operativas.",
    href: routes.erpInventoryTransfers,
    icon: RefreshCcw,
    badge: "Stock",
  },
  {
    title: "Toma fisica",
    desc: "Compara conteo real contra sistema.",
    href: routes.erpInventoryPhysicalCount,
    icon: ScanLine,
    badge: "Control",
  },
  {
    title: "Inventario valorizado",
    desc: "Analiza valor total y costo promedio.",
    href: routes.erpInventoryValuation,
    icon: HandCoins,
    badge: "Analisis",
  },
  {
    title: "Ingresos de mercaderia",
    desc: "Registra recepciones vinculadas a compras.",
    href: routes.erpPurchasesReceipts,
    icon: PackageCheck,
    badge: "Compras",
  },
  {
    title: "Reportes de inventario",
    desc: "Consulta indicadores y vistas gerenciales.",
    href: routes.reports,
    icon: Sparkles,
    badge: "Analisis",
  },
];

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: number;
  helper: string;
  icon: LucideIcon;
  tone?: "default" | "warning";
}) {
  const iconClass =
    tone === "warning"
      ? "bg-amber-50 text-amber-600 ring-1 ring-amber-100"
      : "bg-sky-100 text-blue-600 ring-1 ring-sky-200";

  return (
    <Card className="rounded-[24px] border-slate-200 bg-white/95 py-0 shadow-sm shadow-slate-200/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
          </div>
          <div className={`rounded-2xl p-3 ${iconClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ErpInventoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver inventario.</p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.facturacion} className="hover:underline">
                Facturacion
              </Link>{" "}
              / Inventario
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Inventario</h1>
          </div>
          <Card className="rounded-[24px] border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>Gestion Empresarial activa es necesaria para gestionar inventario.</p>
              <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
                <Link href={routes.facturacion}>Ir a Facturacion</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [items, warehouses, inventory, coreProductCount] = await Promise.all([
    getErpnextItems().catch(() => []),
    getErpnextWarehouses().catch(() => []),
    getErpnextInventory().catch(() => []),
    getPrismaClient().lightweightProduct.count({ where: { tenantId: tenant.id } }),
  ]);

  const operativeWarehouses = warehouses.filter(
    (warehouse) => warehouse.is_group !== 1 && warehouse.disabled !== 1
  );
  const noStockRows = inventory.filter((row) => (row.actual_qty ?? 0) <= 0).length;
  const lowStockRows = inventory.filter((row) => {
    const qty = row.actual_qty ?? 0;
    return qty > 0 && qty <= 5;
  }).length;

  return (
    <DashboardShell contentClassName="mx-auto max-w-7xl">
      <div className="space-y-8">
        <CoreMigrationNotice
          coreProductCount={coreProductCount}
          coreCustomerCount={0}
          type="inventory"
        />
        <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-linear-to-br from-sky-100 via-white to-slate-50 shadow-sm shadow-sky-100/60">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.35fr_0.95fr] lg:px-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/85 px-3 py-1 text-xs font-medium text-sky-700">
                <LayoutGrid className="h-3.5 w-3.5" />
                Inventario empresarial
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Link href={routes.facturacion} className="transition hover:text-slate-900">
                    Facturacion
                  </Link>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-700">Inventario</span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                    Inventario
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600">
                    Gestiona catalogo, stock y movimientos.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-slate-900">{tenant.name}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  <Sparkles className="h-4 w-4" />
                  Gestion Empresarial activa
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-200/60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Accesos clave</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Entra rapido a catalogo, stock y movimientos.
                  </p>
                </div>
                <Button asChild variant="outline" className="rounded-full border-slate-200">
                  <Link href={routes.facturacion}>Volver a Facturacion</Link>
                </Button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    title: "Productos",
                    desc: "Gestiona catalogo y datos base.",
                    href: routes.erpInventoryProducts,
                    icon: Package,
                  },
                  {
                    title: "Stock actual",
                    desc: "Revisa existencias por bodega.",
                    href: routes.erpInventoryStock,
                    icon: Boxes,
                  },
                  {
                    title: "Kardex",
                    desc: "Consulta kardex y movimientos.",
                    href: routes.erpInventoryKardex,
                    icon: LibraryBig,
                  },
                  {
                    title: "Ajustes",
                    desc: "Corrige diferencias de inventario.",
                    href: routes.erpInventoryAdjustments,
                    icon: SlidersHorizontal,
                  },
                ].map(({ title, desc, href, icon: Icon }) => (
                  <Link
                    key={title}
                    href={href}
                    className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-2xl bg-sky-100 p-2.5 text-blue-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-blue-600" />
                    </div>
                    <p className="mt-4 font-medium text-slate-900">{title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-500">{desc}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Productos"
            value={items.length}
            helper="Catalogo disponible en Gestion Empresarial."
            icon={Package}
          />
          <MetricCard
            title="Bodegas operativas"
            value={operativeWarehouses.length}
            helper="Ubicaciones listas para operar."
            icon={Warehouse}
          />
          <MetricCard
            title="Filas de stock"
            value={inventory.length}
            helper="Existencias visibles por item y bodega."
            icon={Boxes}
          />
          <MetricCard
            title="Sin stock"
            value={noStockRows}
            helper={`${lowStockRows} con stock bajo.`}
            icon={ShieldAlert}
            tone="warning"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg text-slate-900">Acciones rapidas</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    Todo lo que el equipo usa para operar inventario.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pb-6">
              {quickActionGroups.map((group) => (
                <div key={group.title} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {group.title}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {group.items.map(({ label, href, icon: Icon, tone = "default" }) => {
                      const toneClass =
                        tone === "primary"
                          ? "border-sky-200 bg-sky-50 text-blue-700 hover:bg-sky-100"
                          : tone === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

                      return (
                        <Link
                          key={label}
                          href={href}
                          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition ${toneClass}`}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900">Ayuda rapida</CardTitle>
              <p className="text-sm text-slate-500">
                Mantiene el contexto sin ocupar el dashboard principal.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <p className="text-sm font-medium text-slate-900">Como funciona inventario</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Sigue el flujo base para catalogo, stock y control operativo.
                </p>
              </div>

              <details className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Ver pasos del flujo</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Productos, bodegas, stock, POS y reportes.
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    Expandir
                  </span>
                </summary>

                <ol className="mt-4 space-y-3">
                  {helpSteps.map(({ step, title, desc, href }) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-blue-700">
                        {step}
                      </span>
                      <div>
                        <Link href={href} className="text-sm font-medium text-slate-900 hover:underline">
                          {title}
                        </Link>
                        <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Modulos de inventario
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Accesos organizados por catalogo, stock y analisis.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {inventoryModules.map(({ title, desc, href, icon: Icon, badge }) => (
              <Link
                key={title}
                href={href}
                className="group rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 transition hover:-translate-y-1 hover:border-sky-200 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-2xl bg-sky-100 p-3 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  {badge ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {badge}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5">
                  <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">{desc}</p>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-700">
                  Abrir modulo
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
