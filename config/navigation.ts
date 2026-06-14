import { routes } from "./routes";
import type { TenantAppRouting } from "@/lib/core/tenant-app-routing";

export type NavigationItem = {
  title: string;
  href: string;
  description?: string;
};

export function getDashboardNavigation(appRouting: TenantAppRouting): NavigationItem[] {
  return [
    {
      title: "Workspace",
      href: routes.workspace,
      description:
        "Launcher principal con acceso claro a inventario, ventas, facturacion y configuracion.",
    },
    {
      title: "Inventario",
      href: appRouting.inventoryHref,
      description: appRouting.inventoryDescription,
    },
    {
      title: "POS / Ventas",
      href: appRouting.salesHref,
      description: appRouting.salesDescription,
    },
    {
      title: "Facturacion",
      href: routes.sriDocuments,
      description:
        "Comprobantes, estados y seguimiento de facturacion electronica Ecuador / SRI.",
    },
    {
      title: "Configuracion SRI",
      href: routes.sri,
      description:
        "Empresa, RUC, firma, secuenciales, ambiente y monitoreo tecnico del SRI.",
    },
    {
      title: "ERP Avanzado",
      href: appRouting.erpActionHref,
      description:
        "Clientes, inventario, productos, ventas, compras, facturas y contabilidad.",
    },
    {
      title: "Conversaciones",
      href: routes.conversations,
      description:
        "Todos los chats del tenant desde Chatwoot, con filtros por etiquetas, estado y canal.",
    },
    {
      title: "Canales",
      href: routes.channels,
      description: "Conecta WhatsApp, Instagram, Messenger y Webchat.",
    },
    {
      title: "Automatizaciones",
      href: routes.automations,
      description:
        "Plantillas y configuraciones disponibles sin exponer workflows internos de n8n.",
    },
    {
      title: "Notificaciones",
      href: routes.notifications,
      description: "Centro interno de alertas, pagos, comprobantes, leads y eventos importantes.",
    },
    {
      title: "Mi plan",
      href: routes.billing,
      description: "Plan Appsolux, pagos, suscripcion y facturas del servicio.",
    },
    {
      title: "Ajustes",
      href: routes.settings,
      description: "Empresa, usuarios, permisos, canales, Chatwoot, ERP y seguridad.",
    },
  ];
}

export const dashboardNavigation = getDashboardNavigation({
  inventoryHref: routes.basicStock,
  productsHref: routes.basicProducts,
  stockHref: routes.basicStock,
  movementsHref: routes.basicStock,
  salesHref: routes.sales,
  posHref: routes.basicPos,
  inventoryDescription: "Productos, stock, movimientos y alertas para la operacion diaria.",
  salesDescription: "Punto de venta, cobros, pedidos, clientes y seguimiento comercial.",
  inventoryFeatures: [],
  salesFeatures: [],
  inventoryStatusLabel: "Modo basico",
  inventoryStatusVariant: "pending",
  salesStatusLabel: "Modo basico",
  salesStatusVariant: "pending",
  erpStatusLabel: "Plan Pro",
  erpStatusVariant: "locked",
  erpActionHref: routes.erp,
  erpActionLabel: "Abrir app",
  erpHelperText: "",
  hasActiveErp: false,
});
