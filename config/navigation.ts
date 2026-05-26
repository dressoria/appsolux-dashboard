import { routes } from "./routes";

export type NavigationItem = {
  title: string;
  href: string;
  description?: string;
};

export const dashboardNavigation: NavigationItem[] = [
  {
    title: "Dashboard",
    href: routes.dashboard,
    description: "Resumen general de conversaciones, canales, pagos y alertas.",
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
    description:
      "Centro interno de alertas, pagos, comprobantes, leads y eventos importantes.",
  },
  {
    title: "ERP Comercial",
    href: routes.erp,
    description:
      "Clientes, inventario, productos, ventas, compras, facturas y contabilidad.",
  },
  {
    title: "POS avanzado",
    href: routes.pos,
    description:
      "Punto de venta para crear pedidos desde productos, clientes e inventario.",
  },
  {
    title: "Appsolux Basico",
    href: routes.basic,
    description: "Centro de ventas, productos, clientes, caja y stock simple.",
  },
  {
    title: "Facturacion Electronica",
    href: routes.sri,
    description: "Configura empresa, establecimientos, secuenciales, firma y comprobantes SRI Ecuador.",
  },
  {
    title: "Reportes",
    href: routes.reports,
    description: "Indicadores de ventas, cobros, inventario y productos.",
  },
  {
    title: "Mi plan",
    href: routes.billing,
    description: "Plan Appsolux, pagos, suscripcion y facturas del servicio.",
  },
  {
    title: "Ajustes",
    href: routes.settings,
    description:
      "Empresa, usuarios, permisos, canales, Chatwoot, ERP y seguridad.",
  },
];
