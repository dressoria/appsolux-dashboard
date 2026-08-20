export type CommercialPlanCode = "BASIC" | "BUSINESS" | "ENTERPRISE";
export type CommercialPlanKey = "free" | "pro" | "enterprise";

export type CommercialComparisonKey =
  | "electronicBilling"
  | "invoices"
  | "users"
  | "products"
  | "issuePoints"
  | "warehouses"
  | "inventory"
  | "purchases"
  | "suppliers"
  | "reports"
  | "accounting"
  | "automations"
  | "api"
  | "support";

type CommercialPlan = {
  code: CommercialPlanCode;
  planKey: CommercialPlanKey;
  displayName: string;
  description: string;
  monthly: number;
  yearly: number;
  highlighted: boolean;
  badge: string | null;
  highlights: readonly string[];
  comparison: Readonly<Record<CommercialComparisonKey, string | boolean>>;
};

export const commercialPlans = [
  {
    code: "BASIC",
    planKey: "free",
    displayName: "Básico",
    description: "Todo lo necesario para empezar a facturar y controlar tu negocio.",
    monthly: 6.99,
    yearly: 69,
    highlighted: false,
    badge: null,
    highlights: [
      "Facturas electrónicas ilimitadas",
      "Clientes, productos, servicios y combos",
      "Notas de crédito, XML y RIDE",
      "POS, caja e inventario básico",
      "1 usuario y 1 punto de emisión",
      "Hasta 200 productos y tres precios de venta",
    ],
    comparison: {
      electronicBilling: true,
      invoices: "Ilimitadas",
      users: "1",
      products: "200",
      issuePoints: "1",
      warehouses: "1",
      inventory: "Básico",
      purchases: false,
      suppliers: false,
      reports: "Básicos",
      accounting: false,
      automations: false,
      api: false,
      support: "Estándar",
    },
  },
  {
    code: "BUSINESS",
    planKey: "pro",
    displayName: "Negocio",
    description: "Más control para negocios que están creciendo.",
    monthly: 12.99,
    yearly: 129,
    highlighted: true,
    badge: "MÁS POPULAR",
    highlights: [
      "Todo lo incluido en Básico",
      "Hasta 5 usuarios y 3 puntos de emisión",
      "Hasta 5.000 productos",
      "Inventario avanzado y múltiples bodegas",
      "Compras, proveedores y cuentas por cobrar",
      "Reportes avanzados e importaciones",
    ],
    comparison: {
      electronicBilling: true,
      invoices: "Ilimitadas",
      users: "Hasta 5",
      products: "5.000",
      issuePoints: "Hasta 3",
      warehouses: "Hasta 3",
      inventory: "Avanzado",
      purchases: true,
      suppliers: true,
      reports: "Avanzados",
      accounting: false,
      automations: false,
      api: false,
      support: "Prioritario",
    },
  },
  {
    code: "ENTERPRISE",
    planKey: "enterprise",
    displayName: "Empresarial",
    description: "Gestión avanzada para equipos y operaciones más grandes.",
    monthly: 29.99,
    yearly: 299,
    highlighted: false,
    badge: null,
    highlights: [
      "Todo lo incluido en Negocio",
      "Hasta 100 usuarios y 50 puntos de emisión",
      "Catálogo de alta capacidad",
      "Múltiples bodegas y operaciones",
      "Gestión financiera y contabilidad",
      "Reportes empresariales y soporte prioritario",
    ],
    comparison: {
      electronicBilling: true,
      invoices: "Ilimitadas",
      users: "Hasta 100",
      products: "100.000",
      issuePoints: "Hasta 50",
      warehouses: "Hasta 50",
      inventory: "Avanzado",
      purchases: "Avanzadas",
      suppliers: true,
      reports: "Empresariales",
      accounting: true,
      automations: false,
      api: false,
      support: "Prioritario",
    },
  },
] as const satisfies readonly CommercialPlan[];

export const commercialComparisonRows = [
  { key: "electronicBilling", label: "Facturación electrónica SRI" },
  { key: "invoices", label: "Facturas" },
  { key: "users", label: "Usuarios" },
  { key: "products", label: "Productos" },
  { key: "issuePoints", label: "Puntos de emisión" },
  { key: "warehouses", label: "Bodegas / locales" },
  { key: "inventory", label: "Inventario" },
  { key: "purchases", label: "Compras" },
  { key: "suppliers", label: "Proveedores" },
  { key: "reports", label: "Reportes" },
  { key: "accounting", label: "Contabilidad" },
  { key: "automations", label: "Automatizaciones" },
  { key: "api", label: "API" },
  { key: "support", label: "Soporte" },
] as const satisfies readonly { key: CommercialComparisonKey; label: string }[];

export function getCommercialPlanByInternalKey(planKey: string | null | undefined) {
  const normalizedKey = planKey === "trial" ? "free" : planKey;
  return commercialPlans.find((plan) => plan.planKey === normalizedKey) ?? commercialPlans[0];
}

export function calculateAnnualSavings(monthly: number, yearly: number) {
  return Number((monthly * 12 - yearly).toFixed(2));
}
