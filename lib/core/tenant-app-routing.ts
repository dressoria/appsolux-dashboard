import { routes } from "@/config/routes";
import type { ErpProvisioningState } from "@/lib/core/erp-provisioning-status";

type TenantAppRoutingInput = {
  canRequestDedicatedErp: boolean;
  erpProvisioning: ErpProvisioningState;
};

export type TenantAppRouting = {
  inventoryHref: string;
  productsHref: string;
  stockHref: string;
  movementsHref: string;
  salesHref: string;
  posHref: string;
  inventoryDescription: string;
  salesDescription: string;
  inventoryFeatures: string[];
  salesFeatures: string[];
  inventoryStatusLabel: string;
  inventoryStatusVariant: "active" | "pending";
  salesStatusLabel: string;
  salesStatusVariant: "active" | "pending";
  erpStatusLabel: string;
  erpStatusVariant: "active" | "pending" | "locked";
  erpActionHref: string;
  erpActionLabel: string;
  erpHelperText: string;
  hasActiveErp: boolean;
};

export function resolveTenantAppRouting({
  canRequestDedicatedErp,
  erpProvisioning,
}: TenantAppRoutingInput): TenantAppRouting {
  const hasActiveErp = erpProvisioning.isRealActive;
  const erpActionHref = canRequestDedicatedErp ? routes.erp : routes.billing;

  if (hasActiveErp) {
    return {
      inventoryHref: routes.erpInventory,
      productsHref: routes.erpInventoryProducts,
      stockHref: routes.erpInventoryStock,
      movementsHref: routes.erpInventoryKardex,
      salesHref: routes.pos,
      posHref: routes.pos,
      inventoryDescription:
        "Inventario empresarial conectado al ERP: productos, stock, bodegas, ajustes y kardex como fuente principal.",
      salesDescription:
        "Punto de venta avanzado conectado al ERP para vender, cobrar y seguir pedidos, facturas y pagos.",
      inventoryFeatures: [
        "Catalogo ERP de productos",
        "Stock por bodega",
        "Kardex y movimientos",
        "Ajustes y transferencias",
        "Inventario valorizado",
      ],
      salesFeatures: [
        "POS avanzado",
        "Pedidos y facturas",
        "Cobros y pagos",
        "Clientes ERP",
        "Operacion integrada con inventario",
      ],
      inventoryStatusLabel: "ERP activo",
      inventoryStatusVariant: "active",
      salesStatusLabel: "ERP activo",
      salesStatusVariant: "active",
      erpStatusLabel: "ERP activo",
      erpStatusVariant: "active",
      erpActionHref: routes.erp,
      erpActionLabel: "Abrir app",
      erpHelperText: "Tu tenant ya opera inventario y ventas desde ERPNext.",
      hasActiveErp: true,
    };
  }

  const erpPending =
    canRequestDedicatedErp &&
    (erpProvisioning.isPending ||
      erpProvisioning.isSimulated ||
      erpProvisioning.isFailed ||
      erpProvisioning.status === "not_configured");

  return {
    inventoryHref: routes.basicStock,
    productsHref: routes.basicProducts,
    stockHref: routes.basicStock,
    movementsHref: routes.basicStock,
    salesHref: routes.sales,
    posHref: routes.basicPos,
    inventoryDescription:
      "Inventario liviano para productos, stock simple y movimientos basicos mientras el ERP no esta activo.",
    salesDescription:
      "Flujo operativo liviano para vender, cobrar y emitir recibos o facturas SRI desde el modo basico.",
    inventoryFeatures: [
      "Catalogo basico de productos",
      "Control de stock simple",
      "Entradas y salidas",
      "Alertas por stock critico",
      "Base para ventas basicas",
    ],
    salesFeatures: [
      "POS basico",
      "Cobros y caja",
      "Clientes y fiados",
      "Ventas y recibos internos",
      "Puente a factura electronica",
    ],
    inventoryStatusLabel: "Modo basico",
    inventoryStatusVariant: "pending",
    salesStatusLabel: "Modo basico",
    salesStatusVariant: "pending",
    erpStatusLabel: canRequestDedicatedErp
      ? erpProvisioning.isPending
        ? "Configuracion pendiente"
        : "ERP incluido en tu plan"
      : "Plan Pro",
    erpStatusVariant: canRequestDedicatedErp
      ? "pending"
      : "locked",
    erpActionHref,
    erpActionLabel: canRequestDedicatedErp ? "Ver estado ERP" : "Mejorar plan",
    erpHelperText: canRequestDedicatedErp
      ? erpPending
        ? "Tu plan incluye ERP. Activalo o revisa su estado para pasar de modo basico a ERP real."
        : "Tu plan incluye ERP y puedes revisar su activacion desde el modulo avanzado."
      : "Tu plan actual mantiene Inventario y Ventas en modo basico hasta activar un plan con ERP.",
    hasActiveErp: false,
  };
}
