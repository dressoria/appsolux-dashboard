import type { AppsoluxNotification } from "@/types/notification";

const demoTenantId = "tenant_demo_milusk";

export const demoNotifications: AppsoluxNotification[] = [
  {
    id: "ntf_demo_receipt_pending",
    tenant_id: demoTenantId,
    title: "Comprobante pendiente de revision",
    description:
      "Un cliente envio un comprobante que necesita validacion antes de confirmar el pedido.",
    category: "receipt",
    priority: "high",
    status: "unread",
    created_at: "2026-05-02T14:35:00.000Z",
    source: "appsolux",
  },
  {
    id: "ntf_demo_payment_received",
    tenant_id: demoTenantId,
    title: "Pago recibido",
    description:
      "Se registro un pago de una orden reciente y esta listo para conciliacion interna.",
    category: "payment",
    priority: "medium",
    status: "unread",
    created_at: "2026-05-02T13:50:00.000Z",
    source: "erpnext",
  },
  {
    id: "ntf_demo_new_lead",
    tenant_id: demoTenantId,
    title: "Nuevo lead comercial",
    description:
      "Un contacto solicito informacion de productos y requiere seguimiento del equipo.",
    category: "lead",
    priority: "medium",
    status: "unread",
    created_at: "2026-05-02T12:20:00.000Z",
    source: "chatwoot",
  },
  {
    id: "ntf_demo_automation_error",
    tenant_id: demoTenantId,
    title: "Error de automatizacion",
    description:
      "Una regla interna no pudo completar el proceso y quedo pendiente de revision operativa.",
    category: "automation",
    priority: "urgent",
    status: "unread",
    created_at: "2026-05-02T11:10:00.000Z",
    source: "n8n",
  },
  {
    id: "ntf_demo_low_inventory",
    tenant_id: demoTenantId,
    title: "Inventario bajo",
    description:
      "Un producto del catalogo esta por debajo del nivel minimo configurado.",
    category: "inventory",
    priority: "high",
    status: "read",
    created_at: "2026-05-01T22:45:00.000Z",
    source: "erpnext",
  },
  {
    id: "ntf_demo_pending_order",
    tenant_id: demoTenantId,
    title: "Pedido pendiente",
    description:
      "Hay un pedido esperando confirmacion de disponibilidad antes de continuar.",
    category: "order",
    priority: "medium",
    status: "read",
    created_at: "2026-05-01T19:30:00.000Z",
    source: "appsolux",
  },
  {
    id: "ntf_demo_system_event",
    tenant_id: demoTenantId,
    title: "Evento del sistema",
    description:
      "El centro de notificaciones internas quedo preparado para recibir eventos del tenant.",
    category: "system",
    priority: "low",
    status: "archived",
    created_at: "2026-05-01T16:05:00.000Z",
    source: "appsolux",
  },
];
