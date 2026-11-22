export type CommercialPlanCode = "BASIC" | "BUSINESS" | "ENTERPRISE";
export type CommercialPlanKey = "free" | "pro" | "enterprise";

export type CommercialComparisonKey =
  | "electronicBilling"
  | "invoices"
  | "xmlRide"
  | "creditNotes"
  | "pos"
  | "cashRegister"
  | "customers"
  | "products"
  | "servicesCombos"
  | "purchases"
  | "suppliers"
  | "inventoryBasic"
  | "inventoryAdvanced"
  | "warehouses"
  | "movementsTransfers"
  | "receivables"
  | "payables"
  | "chartOfAccounts"
  | "journalEntries"
  | "financialReports"
  | "reportsBasic"
  | "reportsAdvanced"
  | "reportsEnterprise"
  | "users"
  | "issuePoints"
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
      "Documentos electrónicos ilimitados",
      "Facturación electrónica SRI",
      "XML y representación RIDE",
      "Clientes, productos y servicios",
      "Punto de venta",
      "Caja y cobros básicos",
      "Inventario básico",
      "Reportes básicos",
      "1 usuario",
      "1 punto de emisión",
      "Hasta 200 productos",
    ],
    comparison: {
      electronicBilling: true,
      invoices: "Ilimitadas",
      xmlRide: true,
      creditNotes: true,
      pos: true,
      cashRegister: "Básico",
      customers: true,
      products: "Hasta 200",
      servicesCombos: true,
      purchases: false,
      suppliers: false,
      inventoryBasic: true,
      inventoryAdvanced: false,
      warehouses: "1",
      movementsTransfers: false,
      receivables: false,
      payables: false,
      chartOfAccounts: false,
      journalEntries: false,
      financialReports: false,
      reportsBasic: true,
      reportsAdvanced: false,
      reportsEnterprise: false,
      users: "1",
      issuePoints: "1",
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
      "Documentos electrónicos ilimitados",
      "Compras y proveedores",
      "Inventario avanzado y Kardex",
      "Múltiples bodegas",
      "Movimientos y transferencias",
      "Cuentas por cobrar",
      "Cuentas por pagar",
      "Reportes comerciales avanzados",
      "Hasta 5 usuarios",
      "Hasta 3 puntos de emisión",
      "Hasta 5.000 productos",
    ],
    comparison: {
      electronicBilling: true,
      invoices: "Ilimitadas",
      xmlRide: true,
      creditNotes: true,
      pos: true,
      cashRegister: "Avanzado",
      customers: true,
      products: "Hasta 5.000",
      servicesCombos: true,
      purchases: true,
      suppliers: true,
      inventoryBasic: true,
      inventoryAdvanced: true,
      warehouses: "Hasta 3",
      movementsTransfers: true,
      receivables: true,
      payables: true,
      chartOfAccounts: false,
      journalEntries: false,
      financialReports: false,
      reportsBasic: true,
      reportsAdvanced: true,
      reportsEnterprise: false,
      users: "Hasta 5",
      issuePoints: "Hasta 3",
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
      "Documentos electrónicos ilimitados",
      "Contabilidad",
      "Catálogo de cuentas",
      "Asientos y libro diario",
      "Tesorería avanzada",
      "Reportes financieros y gerenciales",
      "Gestión avanzada de usuarios y permisos",
      "Hasta 100 usuarios",
      "Hasta 50 puntos de emisión",
      "Hasta 100.000 productos",
    ],
    comparison: {
      electronicBilling: true,
      invoices: "Ilimitadas",
      xmlRide: true,
      creditNotes: true,
      pos: true,
      cashRegister: "Avanzado",
      customers: true,
      products: "Hasta 100.000",
      servicesCombos: true,
      purchases: "Avanzadas",
      suppliers: true,
      inventoryBasic: true,
      inventoryAdvanced: true,
      warehouses: "Hasta 50",
      movementsTransfers: true,
      receivables: true,
      payables: true,
      chartOfAccounts: true,
      journalEntries: true,
      financialReports: true,
      reportsBasic: true,
      reportsAdvanced: true,
      reportsEnterprise: true,
      users: "Hasta 100",
      issuePoints: "Hasta 50",
      support: "Prioritario",
    },
  },
] as const satisfies readonly CommercialPlan[];

export type ComparisonCategory = {
  category: string;
  rows: readonly { key: CommercialComparisonKey; label: string }[];
};

export const commercialComparisonCategories: readonly ComparisonCategory[] = [
  {
    category: "Facturación",
    rows: [
      { key: "electronicBilling", label: "Facturación electrónica SRI" },
      { key: "invoices", label: "Documentos electrónicos" },
      { key: "xmlRide", label: "XML y representación RIDE" },
      { key: "creditNotes", label: "Notas de crédito" },
    ],
  },
  {
    category: "Ventas",
    rows: [
      { key: "pos", label: "Punto de venta" },
      { key: "cashRegister", label: "Caja y cobros" },
    ],
  },
  {
    category: "Clientes y productos",
    rows: [
      { key: "customers", label: "Gestión de clientes" },
      { key: "products", label: "Productos" },
      { key: "servicesCombos", label: "Servicios y combos" },
    ],
  },
  {
    category: "Compras",
    rows: [
      { key: "purchases", label: "Gestión de compras" },
      { key: "suppliers", label: "Proveedores" },
    ],
  },
  {
    category: "Inventario",
    rows: [
      { key: "inventoryBasic", label: "Inventario básico" },
      { key: "inventoryAdvanced", label: "Inventario avanzado y Kardex" },
      { key: "warehouses", label: "Bodegas" },
      { key: "movementsTransfers", label: "Movimientos y transferencias" },
    ],
  },
  {
    category: "Tesorería",
    rows: [
      { key: "receivables", label: "Cuentas por cobrar" },
      { key: "payables", label: "Cuentas por pagar" },
    ],
  },
  {
    category: "Contabilidad",
    rows: [
      { key: "chartOfAccounts", label: "Plan de cuentas" },
      { key: "journalEntries", label: "Asientos y libro diario" },
      { key: "financialReports", label: "Reportes financieros" },
    ],
  },
  {
    category: "Reportes",
    rows: [
      { key: "reportsBasic", label: "Reportes básicos" },
      { key: "reportsAdvanced", label: "Reportes comerciales avanzados" },
      { key: "reportsEnterprise", label: "Reportes empresariales" },
    ],
  },
  {
    category: "Usuarios y establecimientos",
    rows: [
      { key: "users", label: "Usuarios" },
      { key: "issuePoints", label: "Puntos de emisión" },
      { key: "support", label: "Soporte" },
    ],
  },
];

export const commercialComparisonRows = commercialComparisonCategories.flatMap(
  (cat) => cat.rows,
);

export function getCommercialPlanByInternalKey(planKey: string | null | undefined) {
  const normalizedKey = planKey === "trial" ? "free" : planKey;
  return commercialPlans.find((plan) => plan.planKey === normalizedKey) ?? commercialPlans[0];
}

export function calculateAnnualSavings(monthly: number, yearly: number) {
  return Number((monthly * 12 - yearly).toFixed(2));
}
