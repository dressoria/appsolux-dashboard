import Link from "next/link";
import {
  BarChart3,
  Boxes,
  BookOpen,
  Building2,
  CreditCard,
  FileText,
  FileCheck,
  FolderTree,
  LayoutGrid,
  type LucideIcon,
  MessageSquareText,
  MessageSquareWarning,
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
import { isInternalAdmin } from "@/lib/auth/internal-admin";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { cn } from "@/lib/utils";
import type { AppsoluxUser } from "@/types/user";

type SidebarItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export async function Sidebar({ user }: { user: AppsoluxUser }) {
  const tenantMode = await getTenantModeState(user.tenant);
  const showInternalAdmin = isInternalAdmin(user);
  const isBusinessSuiteActive = tenantMode.businessSuiteStatus === "active";
  const operationsItems = isBusinessSuiteActive
    ? ([
        { title: "POS / Ventas", href: routes.facturacionPos, icon: ShoppingCart },
        { title: "Facturador rapido", href: routes.facturacionQuickInvoice, icon: FileText },
        { title: "Documentos", href: routes.facturacionDocuments, icon: FileCheck },
        { title: "Clientes", href: routes.facturacionCustomers, icon: Users },
        { title: "Productos", href: routes.facturacionProducts, icon: Package },
        { title: "Inventario", href: routes.facturacionInventory, icon: Boxes },
        { title: "Compras", href: routes.facturacionPurchases, icon: FolderTree },
        { title: "Caja", href: routes.facturacionCash, icon: CreditCard },
        { title: "Reportes", href: routes.facturacionReports, icon: BarChart3 },
      ].filter(Boolean) as SidebarItem[])
    : ([
        { title: "POS / Ventas", href: routes.facturacionPos, icon: ShoppingCart },
        { title: "Documentos", href: routes.facturacionDocuments, icon: FileCheck },
        { title: "Clientes", href: routes.facturacionCustomers, icon: Users },
        { title: "Productos", href: routes.facturacionProducts, icon: Package },
        { title: "Inventario", href: routes.facturacionInventory, icon: Boxes },
        { title: "Caja", href: routes.facturacionCash, icon: CreditCard },
        { title: "Reportes", href: routes.facturacionReports, icon: BarChart3 },
      ].filter(Boolean) as SidebarItem[]);
  const configurationItems = isBusinessSuiteActive
    ? ([
        { title: "Empresa y ajustes", href: routes.facturacionSettings, icon: Building2 },
        { title: "Bodegas", href: routes.erpInventoryWarehouses, icon: Warehouse },
        { title: "Categorias", href: routes.erpInventoryCategories, icon: FolderTree },
        { title: "Unidades", href: routes.erpInventoryUnits, icon: Package },
        { title: "Metodos de pago", href: routes.erpFinancePaymentMethods, icon: CreditCard },
        { title: "Configuracion SRI", href: routes.facturacionSri, icon: Settings2 },
        { title: "Historial Basico", href: routes.facturacionHistoryBasic, icon: MessageSquareWarning },
      ].filter(Boolean) as SidebarItem[])
    : ([
        { title: "Configuracion SRI", href: routes.facturacionSri, icon: Settings2 },
        { title: "Ajustes", href: routes.facturacionSettings, icon: MessageSquareWarning },
      ].filter(Boolean) as SidebarItem[]);
  const accountItems = [
    { title: "Mi Plan", href: routes.billing, icon: WalletCards },
    showInternalAdmin ? { title: "Admin Billing", href: routes.adminBilling, icon: Sparkles } : null,
  ].filter(Boolean) as SidebarItem[];
  const navigationGroups = [
    {
      title: "Operacion",
      items: operationsItems,
    },
    {
      title: "Configuracion",
      items: configurationItems,
    },
    ...(isBusinessSuiteActive
      ? [
          {
            title: "Fiscal",
            items: [
              { title: "SRI Ecuador", href: routes.erpFiscalEcuador, icon: Receipt },
              {
                title: "Documentos electronicos",
                href: routes.facturacionDocuments,
                icon: FileCheck,
              },
            ],
          },
          {
            title: "Contabilidad",
            items: [
              { title: "Plan de cuentas", href: routes.erpAccountingAccounts, icon: BookOpen },
              { title: "Libro diario", href: routes.erpAccountingJournal, icon: BookOpen },
              { title: "Libro mayor", href: routes.erpAccountingGeneralLedger, icon: BookOpen },
              {
                title: "Estado de resultados",
                href: routes.erpAccountingProfitAndLoss,
                icon: BarChart3,
              },
              {
                title: "Balance general",
                href: routes.erpAccountingBalanceSheet,
                icon: BarChart3,
              },
              {
                title: "Balance de comprobacion",
                href: routes.erpAccountingTrialBalance,
                icon: BarChart3,
              },
            ],
          },
        ]
      : []),
    {
      title: "Comunicacion",
      items: [
        { title: "Conversaciones", href: routes.conversations, icon: MessageSquareText },
        { title: "Canales", href: routes.channels, icon: LayoutGrid },
        { title: "Automatizaciones", href: routes.automations, icon: Sparkles },
      ],
    },
    {
      title: "Cuenta",
      items: accountItems,
    },
  ];

  return (
    <aside className="hidden min-h-screen w-72 border-r border-slate-200 bg-linear-to-b from-slate-50 via-white to-slate-50/60 px-4 py-6 lg:block">
      <div className="mb-6 rounded-2xl border border-sky-100 bg-white px-4 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Workspace</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
          Facturacion
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {tenantMode.shouldUseAdvancedMode
            ? "Motor empresarial activo. El historial basico queda protegido para consulta."
            : "Operacion diaria con motor basico activo para este tenant."}
        </p>
      </div>

      <div className="mb-4">
        <Link
          href={routes.facturacion}
          className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
        >
          <div className="rounded-xl bg-white p-2 text-sky-700 shadow-sm">
            <LayoutGrid className="h-4 w-4" />
          </div>
          Mis Aplicaciones
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
