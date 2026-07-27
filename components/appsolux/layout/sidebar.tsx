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
import type { TenantModeState } from "@/lib/core/tenant-mode";

export type SidebarItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  title: string;
  items: SidebarItem[];
};

export function buildSidebarNavigation(tenantMode: TenantModeState): NavGroup[] {
  const isAdvanced = tenantMode.businessSuiteStatus === "active";

  const operationItems: SidebarItem[] = isAdvanced
    ? [
        { title: "POS / Ventas", href: routes.facturacionPos, icon: ShoppingCart },
        { title: "Facturador rápido", href: routes.facturacionQuickInvoice, icon: FileText },
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
        { title: "Categorías", href: routes.facturacionSettingsCategories, icon: FolderTree },
        { title: "Unidades", href: routes.facturacionSettingsUnits, icon: Package },
        { title: "Métodos de pago", href: routes.facturacionSettingsPaymentMethods, icon: CreditCard },
        { title: "Historial básico", href: routes.facturacionHistoryBasic, icon: BarChart3 },
      ]
    : [{ title: "Ajustes", href: routes.facturacionSettings, icon: Settings2 }];

  const fiscalItems: SidebarItem[] = [
    { title: "SRI Ecuador", href: routes.sri, icon: Receipt },
    { title: "Documentos electrónicos", href: routes.sriDocuments, icon: FileCheck },
  ];

  const accountItems: SidebarItem[] = [{ title: "Mi plan", href: routes.billing, icon: WalletCards }];

  return [
    { title: "Operación", items: operationItems },
    { title: "Configuración", items: configItems },
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
              { title: "Balance de comprobación", href: routes.facturacionAccountingTrialBalance, icon: BarChart3 },
            ],
          },
          {
            title: "Comunicación",
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
}
