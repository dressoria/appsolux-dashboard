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
    description: "Launcher principal con acceso claro a inventario, ventas, facturacion y configuracion.",
  },
  {
    title: "Inventario",
    href: routes.basicStock,
    description: "Productos, stock, movimientos y alertas para la operacion diaria.",
  },
  {
    title: "POS / Ventas",
    href: routes.sales,
    description: "Punto de venta, cobros, pedidos, clientes y seguimiento comercial.",
  },
  {
    title: "Facturacion",
    href: routes.sriDocuments,
    description: "Comprobantes, estados y seguimiento de facturacion electronica Ecuador / SRI.",
  },
  {
    title: "Configuracion SRI",
    href: routes.sri,
    description: "Empresa, RUC, firma, secuenciales, ambiente y monitoreo tecnico del SRI.",
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
