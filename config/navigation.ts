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
      href: appRouting.inventory.href,
      description: appRouting.inventory.description,
    },
    {
      title: "POS / Ventas",
      href: appRouting.sales.href,
      description: appRouting.sales.description,
    },
    appRouting.shouldShowReports
      ? {
          title: "Reportes",
          href: appRouting.reports.href,
          description: appRouting.reports.description,
        }
      : null,
    appRouting.invoicing.isVisible
      ? {
          title: "Facturacion",
          href: appRouting.invoicing.href,
          description: appRouting.invoicing.description,
        }
      : null,
    appRouting.sriConfiguration.isVisible
      ? {
          title: "Configuracion SRI",
          href: appRouting.sriConfiguration.href,
          description: appRouting.sriConfiguration.description,
        }
      : null,
    appRouting.shouldShowAdvancedErp
      ? {
          title: "Gestion Empresarial",
          href: appRouting.advancedErp.href,
          description: appRouting.advancedErp.description,
        }
      : null,
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
      description: "Empresa, usuarios, permisos, canales, integraciones y seguridad.",
    },
  ].filter(Boolean) as NavigationItem[];
}

export const dashboardNavigation: NavigationItem[] = getDashboardNavigation({
  inventory: {
    href: routes.basicStock,
    description: "Productos, stock y movimientos desde el modo Core.",
    features: [],
    statusLabel: "Core activo",
    statusVariant: "active",
    actionLabel: "Abrir inventario",
    buttonVariant: "default",
    helperText: "",
    isEnabled: true,
    isVisible: true,
  },
  sales: {
    href: routes.basicPos,
    description: "POS, ventas y cobros desde el modo Core.",
    features: [],
    statusLabel: "Core activo",
    statusVariant: "active",
    actionLabel: "Abrir ventas",
    buttonVariant: "default",
    helperText: "",
    isEnabled: true,
    isVisible: true,
  },
  reports: {
    href: routes.basicReports,
    description: "Reportes operativos disponibles en Core.",
    features: [],
    statusLabel: "Activo",
    statusVariant: "active",
    actionLabel: "Abrir reportes",
    buttonVariant: "outline",
    helperText: "",
    isEnabled: true,
    isVisible: true,
  },
  invoicing: {
    href: routes.billing,
    description: "Facturacion disponible solo cuando SRI esta habilitado.",
    features: [],
    statusLabel: "Disponible en un plan superior",
    statusVariant: "locked",
    actionLabel: "Ver planes",
    buttonVariant: "outline",
    helperText: "",
    isEnabled: false,
    isVisible: false,
  },
  sriConfiguration: {
    href: routes.billing,
    description: "Configuracion SRI disponible segun acceso efectivo del tenant.",
    features: [],
    statusLabel: "Disponible en un plan superior",
    statusVariant: "locked",
    actionLabel: "Ver planes",
    buttonVariant: "outline",
    helperText: "",
    isEnabled: false,
    isVisible: false,
  },
  advancedErp: {
    href: routes.billing,
    description: "Gestion Empresarial disponible segun plan y activacion operativa.",
    features: [],
    statusLabel: "Disponible en un plan superior",
    statusVariant: "locked",
    actionLabel: "Ver planes",
    buttonVariant: "outline",
    helperText: "",
    isEnabled: false,
    isVisible: true,
  },
  inventoryHref: routes.basicStock,
  productsHref: routes.basicProducts,
  stockHref: routes.basicStock,
  movementsHref: routes.basicStock,
  salesHref: routes.basicPos,
  posHref: routes.basicPos,
  reportsHref: routes.basicReports,
  inventoryDescription: "Productos, stock, movimientos y alertas para la operacion diaria.",
  salesDescription: "Punto de venta, cobros, pedidos, clientes y seguimiento comercial.",
  inventoryFeatures: [],
  salesFeatures: [],
  inventoryStatusLabel: "Core activo",
  inventoryStatusVariant: "active",
  salesStatusLabel: "Core activo",
  salesStatusVariant: "active",
  erpStatusLabel: "Disponible en un plan superior",
  erpStatusVariant: "locked",
  erpActionHref: routes.billing,
  erpActionLabel: "Ver planes",
  erpHelperText: "",
  hasActiveErp: false,
  shouldShowFacturacion: false,
  shouldShowSriConfiguration: false,
  shouldShowAdvancedErp: true,
  shouldShowReports: true,
});
