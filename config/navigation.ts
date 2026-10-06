import type { TenantAppRouting } from "@/lib/core/tenant-app-routing";
import { routes } from "./routes";

export type NavigationItem = {
  title: string;
  href: string;
  description?: string;
};

const facturomNavigation: NavigationItem[] = [
  { title: "Inicio", href: routes.facturacion, description: "Panel principal de Facturom." },
  { title: "Facturar", href: routes.facturacionPos, description: "Ventas y facturación." },
  { title: "Documentos", href: routes.facturacionDocuments, description: "Comprobantes y estados." },
  { title: "Clientes", href: routes.facturacionCustomers, description: "Directorio e historial de clientes." },
  { title: "Productos", href: routes.facturacionProducts, description: "Catálogo de productos." },
  { title: "Inventario", href: routes.facturacionInventory, description: "Stock y movimientos." },
  { title: "Compras", href: routes.facturacionPurchases, description: "Compras y proveedores." },
  { title: "Contabilidad", href: routes.facturacionAccounting, description: "Operación y reportes contables." },
  { title: "Reportes", href: routes.facturacionReports, description: "Indicadores de la operación." },
  { title: "Configuración", href: routes.facturacionSettings, description: "Datos y preferencias de empresa." },
];

export function getDashboardNavigation(_appRouting: TenantAppRouting): NavigationItem[] {
  return facturomNavigation;
}

export const dashboardNavigation = facturomNavigation;
