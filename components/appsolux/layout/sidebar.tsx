import Link from "next/link";
import {
  Archive,
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  FileCheck,
  FileText,
  FolderTree,
  LayoutGrid,
  type LucideIcon,
  MessageSquareText,
  Package,
  Receipt,
  Settings2,
  ShoppingCart,
  Sparkles,
  Users,
  Warehouse,
  WalletCards,
} from "lucide-react";

import { routes } from "@/config/routes";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { cn } from "@/lib/utils";
import type { AppsoluxUser } from "@/types/user";

type SidebarItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

type NavGroup = {
  title: string;
  items: SidebarItem[];
};

export async function Sidebar({ user }: { user: AppsoluxUser }) {
  if (!user.tenant) {
    return null;
  }

  const tenantMode = await getTenantModeState(user.tenant);
  const isAdvanced = tenantMode.businessSuiteStatus === "active";

  const operationItems: SidebarItem[] = isAdvanced
    ? [
        { title: "POS / Ventas", href: routes.facturacionPos, icon: ShoppingCart },
        { title: "Facturador rapido", href: routes.facturacionQuickInvoice, icon: FileText },
        { title: "Documentos", href: routes.facturacionDocuments, icon: FileCheck },
        { title: "Clientes", href: routes.facturacionCustomers, icon: Users },
        { title: "Productos", href: routes.facturacionProducts, icon: Package },
        { title: "Inventario", href: routes.facturacionInventory, icon: Archive },
        { title: "Compras", href: routes.facturacionPurchases, icon: FolderTree },
        { title: "Caja", href: routes.facturacionCash, icon: CreditCard },
        { title: "Reportes", href: routes.facturacionReports, icon: BarChart3 },
      ]
    : [
        { title: "POS / Ventas", href: routes.facturacionPos, icon: ShoppingCart },
        { title: "Documentos", href: routes.facturacionDocuments, icon: FileCheck },
        { title: "Clientes", href: routes.facturacionCustomers, icon: Users },
        { title: "Productos", href: routes.facturacionProducts, icon: Package },
        { title: "Inventario", href: routes.facturacionInventory, icon: Archive },
        { title: "Caja", href: routes.facturacionCash, icon: CreditCard },
        { title: "Reportes", href: routes.facturacionReports, icon: BarChart3 },
      ];

  const configItems: SidebarItem[] = isAdvanced
    ? [
        { title: "Empresa y ajustes", href: routes.facturacionSettings, icon: Building2 },
        { title: "Bodegas", href: routes.facturacionSettingsWarehouses, icon: Warehouse },
        { title: "Categorias", href: routes.facturacionSettingsCategories, icon: FolderTree },
        { title: "Unidades", href: routes.facturacionSettingsUnits, icon: Package },
        { title: "Metodos de pago", href: routes.facturacionSettingsPaymentMethods, icon: CreditCard },
        { title: "Historial Basico", href: routes.facturacionHistoryBasic, icon: BarChart3 },
      ]
    : [
        { title: "Ajustes", href: routes.facturacionSettings, icon: Settings2 },
      ];

  const fiscalItems: SidebarItem[] = [
    { title: "SRI Ecuador", href: routes.sri, icon: Receipt },
    { title: "Documentos electronicos", href: routes.sriDocuments, icon: FileCheck },
  ];

  const accountItems: SidebarItem[] = [
    { title: "Mi Plan", href: routes.billing, icon: WalletCards },
  ];

  const navigationGroups: NavGroup[] = [
    { title: "Operacion", items: operationItems },
    { title: "Configuracion", items: configItems },
    { title: "Fiscal", items: fiscalItems },
    ...(isAdvanced
      ? [
          {
            title: "Contabilidad",
            items: [
              { title: "Plan de cuentas", href: routes.facturacionAccountingChartOfAccounts, icon: BookOpen },
              { title: "Libro diario", href: routes.facturacionAccountingJournal, icon: BookOpen },
              { title: "Libro mayor", href: routes.facturacionAccountingLedger, icon: BookOpen },
              { title: "Estado de resultados", href: routes.facturacionAccountingIncomeStatement, icon: BarChart3 },
              { title: "Balance general", href: routes.facturacionAccountingBalanceSheet, icon: BarChart3 },
              { title: "Balance de comprobacion", href: routes.facturacionAccountingTrialBalance, icon: BarChart3 },
            ],
          },
        ]
      : []),
    ...(isAdvanced
      ? [
          {
            title: "Comunicacion",
            items: [
              { title: "Conversaciones", href: routes.conversations, icon: MessageSquareText },
              { title: "Canales", href: routes.channels, icon: LayoutGrid },
              { title: "Automatizaciones", href: routes.automations, icon: Sparkles },
            ],
          },
        ]
      : []),
    { title: "Cuenta", items: accountItems },
  ];

  return (
    <aside className="hidden min-h-screen w-72 border-r border-slate-200 bg-linear-to-b from-slate-50 via-white to-slate-50/60 px-4 py-6 lg:block">
      <div className="mb-6 rounded-2xl border border-sky-100 bg-white px-4 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Facturación</p>
        <div className="mt-2 flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Panel</h2>
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {isAdvanced ? "Gestión Empresarial" : "Básico"}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <Link
          href={routes.facturacion}
          className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
        >
          <div className="rounded-xl bg-white p-2 text-sky-700 shadow-sm">
            <LayoutGrid className="h-4 w-4" />
          </div>
          Facturación
        </Link>
      </div>

      <nav className="space-y-5">
        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {group.title}
            </p>
            {group.items.map((item) => (
              <Link
                key={`${group.title}-${item.href}-${item.title}`}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className="h-4 w-4 text-slate-400" />
                {item.title}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
