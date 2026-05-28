import { routes } from "./routes";

export type NavigationItem = {
  title: string;
  href: string;
  description?: string;
};

export const dashboardNavigation: NavigationItem[] = [
  {
    title: "Workspace",
    href: routes.workspace,
    description: "Portal de aplicaciones: accede a todos tus modulos desde un solo lugar.",
  },
  {
    title: "Inventario & POS",
    href: routes.basic,
    description: "Productos, stock, clientes, ventas, caja y reportes para operacion diaria.",
  },
  {
    title: "Ventas",
    href: routes.sales,
    description: "Pedidos, cotizaciones, ventas y cuentas por cobrar.",
  },
  {
    title: "Facturacion Electronica",
    href: routes.sri,
    description: "Configura empresa, establecimientos, secuenciales, firma y comprobantes SRI Ecuador.",
  },
  {
    title: "ERP Avanzado",
    href: routes.erp,
    description: "Clientes, inventario, productos, ventas, compras, facturas y contabilidad.",
  },
  {
    title: "Conversaciones",
    href: routes.conversations,
    description: "Todos los chats del tenant desde Chatwoot, con filtros por etiquetas, estado y canal.",
  },
  {
    title: "Canales",
    href: routes.channels,
    description: "Conecta WhatsApp, Instagram, Messenger y Webchat.",
  },
  {
    title: "Automatizaciones",
    href: routes.automations,
    description: "Plantillas y configuraciones disponibles sin exponer workflows internos de n8n.",
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
