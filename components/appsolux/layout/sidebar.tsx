import { routes } from "@/config/routes";
import type { TenantModeState } from "@/lib/core/tenant-mode";

export type SidebarItem = {
  title: string;
  href: string;
  icon: SidebarIconName;
};

export type NavGroup = {
  title: string;
  items: SidebarItem[];
};

export type SidebarIconName =
  | "archive"
  | "bar-chart-3"
  | "book-open"
  | "building-2"
  | "credit-card"
  | "file-check"
  | "file-text"
  | "folder-tree"
  | "layout-grid"
  | "message-square-text"
  | "package"
  | "receipt"
  | "settings-2"
  | "shopping-cart"
  | "sparkles"
  | "users"
  | "warehouse"
  | "wallet-cards";

export function buildSidebarNavigation(tenantMode: TenantModeState): NavGroup[] {
  const isAdvanced = tenantMode.businessSuiteStatus === "active";

  const operationItems: SidebarItem[] = isAdvanced
    ? [
        { title: "POS / Ventas", href: routes.facturacionPos, icon: "shopping-cart" },
        { title: "Facturador rápido", href: routes.facturacionQuickInvoice, icon: "file-text" },
        { title: "Documentos", href: routes.facturacionDocuments, icon: "file-check" },
        { title: "Clientes", href: routes.facturacionCustomers, icon: "users" },
        { title: "Productos", href: routes.facturacionProducts, icon: "package" },
        { title: "Inventario", href: routes.facturacionInventory, icon: "archive" },
        { title: "Compras", href: routes.facturacionPurchases, icon: "folder-tree" },
        { title: "Caja", href: routes.facturacionCash, icon: "credit-card" },
        { title: "Reportes", href: routes.facturacionReports, icon: "bar-chart-3" },
      ]
    : [
        { title: "POS / Ventas", href: routes.facturacionPos, icon: "shopping-cart" },
        { title: "Documentos", href: routes.facturacionDocuments, icon: "file-check" },
        { title: "Clientes", href: routes.facturacionCustomers, icon: "users" },
        { title: "Productos", href: routes.facturacionProducts, icon: "package" },
        { title: "Inventario", href: routes.facturacionInventory, icon: "archive" },
        { title: "Caja", href: routes.facturacionCash, icon: "credit-card" },
        { title: "Reportes", href: routes.facturacionReports, icon: "bar-chart-3" },
      ];

  const configItems: SidebarItem[] = isAdvanced
    ? [
        { title: "Empresa y ajustes", href: routes.facturacionSettings, icon: "building-2" },
        { title: "Bodegas", href: routes.facturacionSettingsWarehouses, icon: "warehouse" },
        { title: "Categorías", href: routes.facturacionSettingsCategories, icon: "folder-tree" },
        { title: "Unidades", href: routes.facturacionSettingsUnits, icon: "package" },
        { title: "Métodos de pago", href: routes.facturacionSettingsPaymentMethods, icon: "credit-card" },
        { title: "Historial básico", href: routes.facturacionHistoryBasic, icon: "bar-chart-3" },
      ]
    : [{ title: "Ajustes", href: routes.facturacionSettings, icon: "settings-2" }];

  const fiscalItems: SidebarItem[] = [
    { title: "SRI Ecuador", href: routes.sri, icon: "receipt" },
    { title: "Documentos electrónicos", href: routes.sriDocuments, icon: "file-check" },
  ];

  const accountItems: SidebarItem[] = [{ title: "Mi plan", href: routes.billing, icon: "wallet-cards" }];
  const accountingItems: SidebarItem[] = [
    { title: "Plan de cuentas", href: routes.facturacionAccountingChartOfAccounts, icon: "book-open" },
    { title: "Libro diario", href: routes.facturacionAccountingJournal, icon: "book-open" },
    { title: "Libro mayor", href: routes.facturacionAccountingLedger, icon: "book-open" },
    { title: "Estado de resultados", href: routes.facturacionAccountingIncomeStatement, icon: "bar-chart-3" },
    { title: "Balance general", href: routes.facturacionAccountingBalanceSheet, icon: "bar-chart-3" },
    { title: "Balance de comprobación", href: routes.facturacionAccountingTrialBalance, icon: "bar-chart-3" },
  ];
  const communicationItems: SidebarItem[] = [
    { title: "Conversaciones", href: routes.conversations, icon: "message-square-text" },
    { title: "Canales", href: routes.channels, icon: "layout-grid" },
    { title: "Automatizaciones", href: routes.automations, icon: "sparkles" },
  ];

  return [
    { title: "Operación", items: operationItems },
    { title: "Configuración", items: configItems },
    { title: "Fiscal", items: fiscalItems },
    ...(isAdvanced
      ? [
          {
            title: "Contabilidad",
            items: accountingItems,
          },
          {
            title: "Comunicación",
            items: communicationItems,
          },
        ]
      : []),
    { title: "Cuenta", items: accountItems },
  ];
}
