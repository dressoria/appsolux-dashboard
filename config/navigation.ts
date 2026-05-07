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
    title: "ERP",
    href: routes.erp,
    description:
      "Clientes, inventario, productos, ventas, compras, facturas y contabilidad.",
  },
  {
    title: "POS",
    href: routes.pos,
    description:
      "Punto de venta para crear pedidos desde productos, clientes e inventario.",
  },
  {
    title: "POS basico",
    href: routes.basicPos,
    description:
      "Ventas simples con productos, clientes, stock automatico y recibos basicos.",
  },
  {
    title: "Productos basicos",
    href: routes.basicProducts,
    description: "Catalogo ligero de productos guardado en Appsolux Core DB.",
  },
  {
    title: "Clientes basicos",
    href: routes.basicCustomers,
    description: "Clientes ligeros, saldos y ventas fiadas en Core DB.",
  },
  {
    title: "Ventas basicas",
    href: routes.basicSales,
    description: "Recibos simples creados desde el POS basico.",
  },
  {
    title: "Reportes basicos",
    href: routes.basicReports,
    description: "Ventas, cobros pendientes y alertas de stock desde Core DB.",
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
