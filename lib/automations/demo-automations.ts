import type { AppsoluxAutomation } from "@/types/automation";

const demoTenantId = "tenant_demo_milusk";

export const demoAutomations: AppsoluxAutomation[] = [
  {
    id: "atm_demo_inventory_smart",
    tenant_id: demoTenantId,
    title: "Inventario inteligente",
    description:
      "Monitorea productos con stock bajo y prepara alertas internas para el equipo.",
    category: "inventory",
    status: "active",
    trigger_type: "inventory_low",
    required_setup: ["Catalogo", "Stock minimo", "Responsable interno"],
    last_run_at: "2026-05-02T13:45:00.000Z",
    result_summary: "Detecto 2 productos por debajo del stock minimo.",
  },
  {
    id: "atm_demo_payment_validation",
    tenant_id: demoTenantId,
    title: "Validacion de pagos",
    description:
      "Ayuda a revisar pagos recibidos y deja resultados listos para seguimiento interno.",
    category: "payments",
    status: "needs_setup",
    trigger_type: "payment_received",
    required_setup: ["Reglas de validacion", "Cuenta de conciliacion"],
    last_run_at: null,
    result_summary: "Pendiente de configuracion inicial.",
  },
  {
    id: "atm_demo_customer_follow_up",
    tenant_id: demoTenantId,
    title: "Seguimiento de clientes",
    description:
      "Crea recordatorios internos para clientes que necesitan respuesta comercial.",
    category: "follow_up",
    status: "active",
    trigger_type: "incoming_message",
    required_setup: ["Horario de atencion", "Tiempo maximo de respuesta"],
    last_run_at: "2026-05-02T12:30:00.000Z",
    result_summary: "Genero 3 recordatorios de seguimiento.",
  },
  {
    id: "atm_demo_catalog_auto",
    tenant_id: demoTenantId,
    title: "Catalogo automatico",
    description:
      "Organiza productos disponibles para respuestas comerciales y busquedas internas.",
    category: "catalog",
    status: "available",
    trigger_type: "manual",
    required_setup: ["Productos", "Precios", "Categorias"],
    last_run_at: null,
    result_summary: "Lista para configurar.",
  },
  {
    id: "atm_demo_internal_alerts",
    tenant_id: demoTenantId,
    title: "Alertas internas",
    description:
      "Centraliza eventos importantes del negocio dentro del dashboard de Appsolux.",
    category: "notifications",
    status: "active",
    trigger_type: "schedule",
    required_setup: ["Prioridades", "Usuarios responsables"],
    last_run_at: "2026-05-02T10:15:00.000Z",
    result_summary: "Publico 5 alertas internas recientes.",
  },
  {
    id: "atm_demo_payment_reminder",
    tenant_id: demoTenantId,
    title: "Recordatorio de pago",
    description:
      "Identifica pedidos con pago pendiente y prepara recordatorios para gestion interna.",
    category: "payments",
    status: "paused",
    trigger_type: "schedule",
    required_setup: ["Politica de vencimiento", "Plantilla interna"],
    last_run_at: "2026-05-01T20:00:00.000Z",
    result_summary: "Ultima revision sin pagos vencidos.",
  },
  {
    id: "atm_demo_lead_classification",
    tenant_id: demoTenantId,
    title: "Clasificacion de leads",
    description:
      "Clasifica leads nuevos por interes, urgencia y etapa comercial para priorizar ventas.",
    category: "sales",
    status: "error",
    trigger_type: "new_lead",
    required_setup: ["Criterios comerciales", "Categorias de lead"],
    last_run_at: "2026-05-02T09:40:00.000Z",
    result_summary: "Requiere revisar criterios incompletos.",
  },
];
