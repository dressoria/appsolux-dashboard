import { routes } from "@/config/routes";
import type { TenantModeState } from "@/lib/core/tenant-mode";

type AppStatusVariant = "active" | "pending" | "locked";

export type TenantAppRouteEntry = {
  href: string;
  description: string;
  features: string[];
  statusLabel: string;
  statusVariant: AppStatusVariant;
  actionLabel: string;
  buttonVariant: "default" | "outline";
  helperText: string;
  isEnabled: boolean;
  isVisible: boolean;
};

export type TenantAppRouting = {
  inventory: TenantAppRouteEntry;
  sales: TenantAppRouteEntry;
  reports: TenantAppRouteEntry;
  invoicing: TenantAppRouteEntry;
  sriConfiguration: TenantAppRouteEntry;
  advancedErp: TenantAppRouteEntry;
  inventoryHref: string;
  productsHref: string;
  stockHref: string;
  movementsHref: string;
  salesHref: string;
  posHref: string;
  reportsHref: string;
  inventoryDescription: string;
  salesDescription: string;
  inventoryFeatures: string[];
  salesFeatures: string[];
  inventoryStatusLabel: string;
  inventoryStatusVariant: AppStatusVariant;
  salesStatusLabel: string;
  salesStatusVariant: AppStatusVariant;
  erpStatusLabel: string;
  erpStatusVariant: AppStatusVariant;
  erpActionHref: string;
  erpActionLabel: string;
  erpHelperText: string;
  hasActiveErp: boolean;
  shouldShowFacturacion: boolean;
  shouldShowSriConfiguration: boolean;
  shouldShowAdvancedErp: boolean;
  shouldShowReports: boolean;
};

function createEntry(input: TenantAppRouteEntry): TenantAppRouteEntry {
  return input;
}

export function resolveTenantAppRouting(tenantMode: TenantModeState): TenantAppRouting {
  const isAdvancedMode =
    tenantMode.effectiveOperatingMode === "SHARED_ERP" ||
    tenantMode.effectiveOperatingMode === "DEDICATED_ERP";
  const hasSriConfiguration = tenantMode.canAccessSriConfiguration;
  const hasSriInvoicing = tenantMode.canAccessSriInvoicing;
  const canUseReports = tenantMode.canAccessAdvancedReports || tenantMode.canAccessBasicReports;
  const isDedicatedPending =
    tenantMode.configuredOperatingMode === "DEDICATED_ERP" &&
    tenantMode.effectiveOperatingMode !== "DEDICATED_ERP" &&
    !tenantMode.hasDedicatedErp &&
    !tenantMode.isSuspended;
  const advancedErpIncluded =
    tenantMode.commercialPlan === "ADVANCED" ||
    tenantMode.commercialPlan === "ENTERPRISE" ||
    tenantMode.effectiveFeatures.shared_erp ||
    tenantMode.effectiveFeatures.dedicated_erp;

  const inventory = isAdvancedMode
    ? createEntry({
        href: routes.facturacionInventory,
        description:
          "Inventario empresarial como fuente principal: productos, stock por bodega, kardex y control operativo avanzado.",
        features: [
          "Productos empresariales",
          "Stock por bodega",
          "Kardex y movimientos",
          "Ajustes y transferencias",
          "Inventario conectado al flujo comercial",
        ],
        statusLabel:
          tenantMode.effectiveOperatingMode === "DEDICATED_ERP"
            ? "Gestion dedicada activa"
            : "Gestion compartida activa",
        statusVariant: "active",
        actionLabel: "Abrir inventario empresarial",
        buttonVariant: "default",
        helperText: "Tu operacion principal de inventario vive en la suite empresarial.",
        isEnabled: true,
        isVisible: true,
      })
    : createEntry({
        href: tenantMode.canAccessBasicInventory ? routes.facturacionInventory : routes.billing,
        description:
          "Inventario Core para productos, stock simple y movimientos diarios sin depender de Gestion Empresarial.",
        features: [
          "Catalogo basico de productos",
          "Control de stock simple",
          "Movimientos y alertas",
          "Base para ventas diarias",
          "Operacion liviana desde Core DB",
        ],
        statusLabel: tenantMode.canAccessBasicInventory ? "Core activo" : "Disponible en un plan superior",
        statusVariant: tenantMode.canAccessBasicInventory ? "active" : "locked",
        actionLabel: tenantMode.canAccessBasicInventory ? "Abrir inventario" : "Ver planes",
        buttonVariant: tenantMode.canAccessBasicInventory ? "default" : "outline",
        helperText: tenantMode.canAccessBasicInventory
          ? "Tu tenant opera inventario desde el motor Core."
          : "Inventario requiere activacion del modulo Core o un plan superior.",
        isEnabled: tenantMode.canAccessBasicInventory,
        isVisible: true,
      });

  const sales = isAdvancedMode
    ? createEntry({
        href: routes.facturacionPos,
        description:
          "POS y ventas avanzadas integradas con Facturacion usando el motor empresarial para pedidos, cobros y seguimiento comercial desde un solo flujo.",
        features: [
          "POS avanzado",
          "Ventas conectadas a la suite",
          "Cobros y pagos",
          "Clientes empresariales",
          "Operacion enlazada con inventario",
        ],
        statusLabel: "Gestion Empresarial activa",
        statusVariant: "active",
        actionLabel: "Abrir POS",
        buttonVariant: "default",
        helperText: "Las ventas operativas se registran desde el flujo avanzado.",
        isEnabled: true,
        isVisible: true,
      })
    : createEntry({
        href: tenantMode.canAccessBasicSales ? routes.facturacionPos : routes.billing,
        description:
          "POS y ventas Core para cobrar, emitir recibos internos y preparar facturacion SRI sin salir del flujo principal.",
        features: [
          "POS basico",
          "Ventas y cobros",
          "Clientes y fiados",
          "Recibos internos",
          "Puente a factura SRI",
        ],
        statusLabel: tenantMode.canAccessBasicSales ? "Core activo" : "Activacion admin requerida",
        statusVariant: tenantMode.canAccessBasicSales ? "active" : "locked",
        actionLabel: tenantMode.canAccessBasicSales ? "Abrir ventas" : "Revisar acceso",
        buttonVariant: tenantMode.canAccessBasicSales ? "default" : "outline",
        helperText: tenantMode.canAccessBasicSales
          ? "La venta sigue siendo el origen operativo del negocio."
          : "POS / Ventas no esta habilitado para este tenant.",
        isEnabled: tenantMode.canAccessBasicSales,
        isVisible: true,
      });

  const reports = tenantMode.canAccessAdvancedReports
    ? createEntry({
        href: routes.facturacionReports,
        description:
          "Reportes avanzados para ventas, stock, compras y seguimiento financiero sobre el flujo empresarial.",
        features: [
          "Reportes comerciales",
          "Indicadores de inventario",
          "Vista operativa avanzada",
          "Base para expansion financiera",
          "Lectura ejecutiva del negocio",
        ],
        statusLabel: "Activo",
        statusVariant: "active",
        actionLabel: "Abrir reportes",
        buttonVariant: "outline",
        helperText: "Tu tenant tiene acceso a reportes avanzados.",
        isEnabled: true,
        isVisible: true,
      })
    : createEntry({
        href: tenantMode.canAccessBasicReports ? routes.facturacionReports : routes.billing,
        description:
          "Reportes operativos para revisar productos, clientes y ventas del modo Core sin complejidad extra.",
        features: [
          "Resumen de ventas",
          "Productos y clientes",
          "Lectura diaria del negocio",
          "Atajos operativos",
          "Base para crecimiento posterior",
        ],
        statusLabel: tenantMode.canAccessBasicReports ? "Activo" : "Disponible en un plan superior",
        statusVariant: tenantMode.canAccessBasicReports ? "active" : "locked",
        actionLabel: tenantMode.canAccessBasicReports ? "Abrir reportes" : "Ver planes",
        buttonVariant: "outline",
        helperText: tenantMode.canAccessBasicReports
          ? "Tu tenant puede revisar reportes desde Core."
          : "Los reportes no estan habilitados para este tenant.",
        isEnabled: tenantMode.canAccessBasicReports,
        isVisible: canUseReports || advancedErpIncluded,
      });

  const invoicing = hasSriInvoicing
    ? createEntry({
        href: routes.facturacionDocuments,
        description:
          "Revision y seguimiento de comprobantes SRI: borradores, firmados, autorizados, pendientes o rechazados.",
        features: [
          "Comprobantes y estados",
          "Seguimiento operativo",
          "Revision de clientes y documentos",
          "Atajo a configuracion SRI",
          "Facturacion separada de la venta",
        ],
        statusLabel: "Activo",
        statusVariant: "active",
        actionLabel: "Abrir facturacion",
        buttonVariant: "default",
        helperText: "Tu tenant puede emitir y revisar comprobantes SRI.",
        isEnabled: true,
        isVisible: true,
      })
    : createEntry({
        href: hasSriConfiguration ? routes.facturacionSri : routes.billing,
        description:
          "Facturacion SRI separada de la operacion diaria, con acceso solo cuando el modulo de emision este habilitado.",
        features: [
          "Emision separada del POS",
          "Control por permisos",
          "Checklist de preparacion",
          "Compatibilidad con SRI Ecuador",
          "Monitoreo por estados",
        ],
        statusLabel: hasSriConfiguration ? "Activacion admin requerida" : "Disponible en un plan superior",
        statusVariant: hasSriConfiguration ? "pending" : "locked",
        actionLabel: hasSriConfiguration ? "Completar configuracion" : "Ver planes",
        buttonVariant: "outline",
        helperText: hasSriConfiguration
          ? "SRI puede configurarse, pero la emision todavia no esta habilitada."
          : "Facturacion SRI no esta incluida para este tenant.",
        isEnabled: false,
        isVisible: hasSriConfiguration || advancedErpIncluded || tenantMode.commercialPlan !== "BASIC",
      });

  const sriConfiguration = hasSriConfiguration
    ? createEntry({
        href: routes.facturacionSri,
        description:
          "Empresa, RUC, firma electronica, secuenciales, ambiente y monitoreo tecnico del modulo SRI.",
        features: [
          "Perfil tributario",
          "Firma electronica",
          "Secuenciales",
          "Ambientes de pruebas y produccion",
          "Monitoreo tecnico",
        ],
        statusLabel: "Activo",
        statusVariant: "active",
        actionLabel: "Abrir configuracion",
        buttonVariant: "outline",
        helperText: "Tu tenant puede preparar y monitorear el modulo SRI.",
        isEnabled: true,
        isVisible: true,
      })
    : createEntry({
        href: routes.billing,
        description:
          "Configuracion del modulo SRI para empresas que necesiten preparar facturacion electronica Ecuador.",
        features: [
          "Perfil tributario",
          "Firma y secuenciales",
          "Ambientes SRI",
          "Monitoreo de readiness",
          "Base para emision",
        ],
        statusLabel: "Disponible en un plan superior",
        statusVariant: "locked",
        actionLabel: "Ver planes",
        buttonVariant: "outline",
        helperText: "Configuracion SRI aun no esta habilitada para este tenant.",
        isEnabled: false,
        isVisible: tenantMode.commercialPlan !== "BASIC" || tenantMode.effectiveFeatures.sri_invoicing,
      });

  let advancedErp: TenantAppRouteEntry;

  if (tenantMode.effectiveOperatingMode === "DEDICATED_ERP") {
    advancedErp = createEntry({
      href: routes.facturacion,
      description:
        "Motor empresarial dedicado para Facturacion, compras, inventario y crecimiento financiero.",
      features: [
        "Inventario empresarial",
        "Compras y proveedores",
        "Kardex y bodegas",
        "Reportes avanzados",
        "Entorno dedicado por tenant",
      ],
      statusLabel: "Gestion dedicada activa",
      statusVariant: "active",
      actionLabel: "Abrir Facturacion",
      buttonVariant: "default",
      helperText: "La suite dedicada ya esta operativa para este tenant.",
      isEnabled: true,
      isVisible: true,
    });
  } else if (tenantMode.effectiveOperatingMode === "SHARED_ERP") {
    advancedErp = createEntry({
      href: routes.facturacion,
      description:
        "Motor empresarial compartido para Facturacion, inventario, compras y reportes avanzados sin requerir una instancia dedicada.",
      features: [
        "Inventario compartido",
        "POS avanzado",
        "Compras y proveedores",
        "Bodegas y kardex",
        "Reportes avanzados",
      ],
      statusLabel: "Gestion compartida activa",
      statusVariant: "active",
      actionLabel: "Abrir Facturacion",
      buttonVariant: "default",
      helperText: "El tenant ya opera en la suite compartida.",
      isEnabled: true,
      isVisible: true,
    });
  } else if (isDedicatedPending) {
    advancedErp = createEntry({
      href: routes.billing,
      description:
        "Gestion Empresarial dedicada en preparacion. Mientras termina la activacion, la operacion sigue en Core con un fallback seguro.",
      features: [
        "Provisioning dedicado",
        "Seguimiento de activacion",
        "Preparacion por tenant",
        "Cambio automatico al estar listo",
        "Continuidad operativa en Core",
      ],
      statusLabel: "Gestion dedicada pendiente",
      statusVariant: "pending",
      actionLabel: "Ver estado",
      buttonVariant: "outline",
      helperText: "La suite dedicada aun no esta lista; el tenant sigue operando en Core por ahora.",
      isEnabled: false,
      isVisible: true,
    });
  } else if (advancedErpIncluded) {
    advancedErp = createEntry({
      href: routes.billing,
      description:
        "Gestion Empresarial incluida por plan o configuracion, pendiente de activacion operativa para usar inventario y ventas avanzadas.",
      features: [
        "Inventario avanzado",
        "Compras",
        "Bodegas",
        "Kardex",
        "Reportes avanzados",
      ],
      statusLabel: "Activacion pendiente",
      statusVariant: "pending",
      actionLabel: "Revisar activacion",
      buttonVariant: "outline",
      helperText: "Este tenant tiene acceso potencial a la suite, pero aun no opera ahi.",
      isEnabled: false,
      isVisible: true,
    });
  } else {
    advancedErp = createEntry({
      href: routes.billing,
      description:
        "Gestion Empresarial para compras, inventario complejo, bodegas, kardex y reportes de mayor profundidad.",
      features: [
        "Inventario avanzado",
        "Compras y proveedores",
        "Kardex",
        "Bodegas",
        "Reportes avanzados",
      ],
      statusLabel: "Disponible en un plan superior",
      statusVariant: "locked",
      actionLabel: "Ver planes",
      buttonVariant: "outline",
      helperText: "Este tenant opera en Core y no tiene acceso a Gestion Empresarial.",
      isEnabled: false,
      isVisible: true,
    });
  }

  return {
    inventory,
    sales,
    reports,
    invoicing,
    sriConfiguration,
    advancedErp,
    inventoryHref: inventory.href,
    productsHref: routes.facturacionProducts,
    stockHref: routes.facturacionInventory,
    movementsHref: routes.facturacionInventory,
    salesHref: sales.href,
    posHref: sales.href,
    reportsHref: reports.href,
    inventoryDescription: inventory.description,
    salesDescription: sales.description,
    inventoryFeatures: inventory.features,
    salesFeatures: sales.features,
    inventoryStatusLabel: inventory.statusLabel,
    inventoryStatusVariant: inventory.statusVariant,
    salesStatusLabel: sales.statusLabel,
    salesStatusVariant: sales.statusVariant,
    erpStatusLabel: advancedErp.statusLabel,
    erpStatusVariant: advancedErp.statusVariant,
    erpActionHref: advancedErp.href,
    erpActionLabel: advancedErp.actionLabel,
    erpHelperText: advancedErp.helperText,
    hasActiveErp: isAdvancedMode,
    shouldShowFacturacion: invoicing.isVisible,
    shouldShowSriConfiguration: sriConfiguration.isVisible,
    shouldShowAdvancedErp: advancedErp.isVisible,
    shouldShowReports: reports.isVisible,
  };
}
