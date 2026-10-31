import { TREASURY_NAVIGATION } from "@/config/treasury-navigation";
import { SRI_TAX_NAVIGATION, SRI_SALES_NAVIGATION, SRI_PURCHASES_NAVIGATION } from "@/config/sri-tax-navigation";
import { routes } from "@/config/routes";
import { getFacturomAccess } from "@/lib/core/facturom-access";
import type { TenantModeState } from "@/lib/core/tenant-mode";

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
  | "package"
  | "receipt"
  | "settings-2"
  | "shield-check"
  | "shopping-cart"
  | "sparkles"
  | "users"
  | "wallet-cards";

export type SidebarLink = {
  kind: "link";
  title: string;
  href: string;
  icon?: SidebarIconName;
  exact?: boolean;
};

export type SidebarSubmenu = {
  kind: "submenu";
  title: string;
  items: SidebarEntry[];
};

export type SidebarEntry = SidebarLink | SidebarSubmenu;

export type NavGroup = {
  key: string;
  title: string;
  icon: SidebarIconName;
  direct?: boolean;
  items: SidebarEntry[];
};

const link = (
  title: string,
  href: string,
  icon?: SidebarIconName,
  exact = false,
): SidebarLink => ({ kind: "link", title, href, icon, exact });

export function buildSidebarNavigation(
  tenantMode: TenantModeState,
): NavGroup[] {
  const access = getFacturomAccess();
  const groups: NavGroup[] = [
    {
      key: "dashboard",
      title: "Panel de control",
      icon: "layout-grid",
      direct: true,
      items: [link("Inicio", routes.facturacion, "layout-grid", true)],
    },
    {
      key: "people",
      title: "Personas",
      icon: "users",
      items: [
        link("Clientes", routes.facturacionCustomers, "users"),
        link("Proveedores", routes.facturacionPurchasesSuppliers, "building-2"),
      ],
    },
    {
      key: "transactions",
      title: "Transacciones",
      icon: "shopping-cart",
      items: [
        {
          kind: "submenu",
          title: "Ventas",
          items: [
            link("Facturar", routes.facturacionSalesNew),
            link("Punto de Venta", routes.facturacionPos),
            link("Documentos", routes.facturacionDocuments),
            link("Proformas", routes.facturacionSalesQuotations),
            link("Órdenes de venta", routes.facturacionSalesOrders),
            link("Recibos", routes.facturacionReceipts),
            link("Notas de crédito", routes.facturacionCreditNotes),
            link("Notas de débito", routes.facturacionDebitNotes),
            link("Importar ventas", routes.facturacionSalesImports),
          ],
        },
        {
          kind: "submenu",
          title: "Compras",
          items: [
            link("Registrar compra", routes.facturacionPurchasesNew),
            link("Documentos de compra", routes.facturacionPurchasesDocuments),
            link("Recepciones", routes.facturacionPurchasesReceived),
            link("Retenciones", routes.facturacionPurchasesWithholdings),
            link("Liquidaciones", routes.facturacionPurchasesSettlements),
          ],
        },
      ],
    },
    {
      key: "sri",
      title: "SRI",
      icon: "receipt",
      items: [
        ...SRI_TAX_NAVIGATION.map((item) => link(item.title, item.href, "file-check", true)),
        {
          kind: "submenu",
          title: "Ventas",
          items: SRI_SALES_NAVIGATION.map((item) => link(item.title, item.href, undefined, true)),
        },
        {
          kind: "submenu",
          title: "Compras",
          items: SRI_PURCHASES_NAVIGATION.map((item) => link(item.title, item.href)),
        },
      ],
    },
    {
      key: "treasury",
      title: "Tesorería",
      icon: "wallet-cards",
      items: TREASURY_NAVIGATION.map((group) => ({
        kind: "submenu",
        title: group.title,
        items: group.items.map((item) => link(item.title, item.href)),
      })),
    },
    {
      key: "inventory",
      title: "Inventario",
      icon: "archive",
      items: [
        link("Productos", routes.facturacionProducts, "package"),
        link("Movimientos", routes.facturacionInventoryMovements),
        link("Toma física", routes.facturacionInventoryPhysicalCount),
        link("Ajustes", routes.facturacionInventoryAdjustments),
        link("Transferencias", routes.facturacionInventoryTransfers),
        link("Kardex", routes.facturacionInventoryKardex),
        link("Valoración", routes.facturacionInventoryValuation),
        {
          kind: "submenu",
          title: "Guías de remisión",
          items: [
            link("Documentos guía", routes.facturacionInventoryShippingGuides),
            link("Vehículos", routes.facturacionInventoryVehicles),
          ],
        },
        link("Bodegas", routes.facturacionInventoryWarehouses),
        link("Catálogo", routes.facturacionInventoryCatalog),
        link("Pedidos", routes.facturacionInventoryOrders),
        {
          kind: "submenu",
          title: "Configuración",
          items: [
            link("Categorías", routes.facturacionInventorySettingsCategories),
            link("Unidades", routes.facturacionInventorySettingsUnits),
            link("Marcas", routes.facturacionInventorySettingsBrands),
          ],
        },
      ],
    },
    {
      key: "accounting",
      title: "Contabilidad",
      icon: "book-open",
      items: [
        link("Resumen", routes.facturacionAccounting, "book-open", true),
        link("Plan de cuentas", routes.facturacionAccountingChartOfAccounts),
        link("Parámetros", routes.facturacionAccountingParameters),
        link("Códigos retención", routes.facturacionAccountingTaxCodes),
        link("Costos y gastos", routes.facturacionAccountingCostsExpenses),
        link("Centros de costo", routes.facturacionAccountingCostCenters),
        link("Periodos", routes.facturacionAccountingPeriods),
        link("Asientos", routes.facturacionAccountingJournal),
        {
          kind: "submenu",
          title: "Reportes contables",
          items: [
            link("Libro mayor", routes.facturacionAccountingLedger),
            link("Estado de resultados", routes.facturacionAccountingIncomeStatement),
            link("Balance general", routes.facturacionAccountingBalanceSheet),
            link("Balance de comprobación", routes.facturacionAccountingTrialBalance),
          ],
        },
      ],
    },
    {
      key: "reports",
      title: "Reportes",
      icon: "bar-chart-3",
      items: [link("Resumen", routes.facturacionReports, "bar-chart-3", true)],
    },
    {
      key: "company",
      title: "Empresa",
      icon: "building-2",
      items: [
        link(
          "Datos de empresa",
          routes.facturacionSettings,
          "building-2",
          true,
        ),
        link("Configuración", routes.facturacionConfiguration, "settings-2"),
      ],
    },
    {
      key: "security",
      title: "Seguridad",
      icon: "shield-check",
      items: [
        link("Usuarios y permisos", routes.facturacionSettingsUsers, "users"),
      ],
    },
  ];

  return groups.filter((group) => {
    if (group.key === "transactions")
      return access.invoicing || access.purchases;
    if (group.key === "sri") return access.sri;
    if (group.key === "treasury") return access.treasury;
    if (group.key === "inventory") return access.inventory;
    if (group.key === "accounting") return access.accounting;
    if (group.key === "reports") return access.reports;
    if (group.key === "security") return access.usersAndPermissions;
    return access.fullAccess;
  });
}
