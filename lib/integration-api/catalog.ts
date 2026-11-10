import type { AppsoluxPermission, AppsoluxUser } from "@/types/user";

export const API_CATALOG_VERSION = 1;
export const API_MODULES = {
  customers: "Clientes", suppliers: "Proveedores", products: "Productos y servicios",
  inventory: "Inventario", sales: "Ventas", proformas: "Proformas",
  invoices: "Facturación electrónica", sri: "SRI Ecuador", purchases: "Compras",
  treasury: "Tesorería", accounting: "Contabilidad", reports: "Reportes",
  settings: "Configuración operativa", users: "Usuarios de la empresa",
} as const;
type Module = keyof typeof API_MODULES;
function scope<const S extends string>(id: S, module: Module, label: string, permission: AppsoluxPermission) {
  return { id, module, label, permission };
}
export const API_SCOPES = [
  scope("customers:read", "customers", "Consultar clientes e información comercial", "erp:read"),
  scope("customers:create", "customers", "Crear clientes", "erp:manage"),
  scope("customers:update", "customers", "Actualizar clientes", "erp:manage"),
  scope("customers:deactivate", "customers", "Desactivar clientes", "erp:manage"),
  scope("suppliers:read", "suppliers", "Consultar proveedores", "erp:read"),
  scope("suppliers:create", "suppliers", "Crear proveedores", "erp:manage"),
  scope("suppliers:update", "suppliers", "Actualizar proveedores", "erp:manage"),
  scope("suppliers:deactivate", "suppliers", "Desactivar proveedores", "erp:manage"),
  scope("products:read", "products", "Consultar productos y servicios", "erp:read"),
  scope("products:create", "products", "Crear productos y servicios", "erp:manage"),
  scope("products:update", "products", "Actualizar productos", "erp:manage"),
  scope("products:deactivate", "products", "Desactivar productos", "erp:manage"),
  scope("categories:read", "products", "Consultar categorías", "erp:read"),
  scope("categories:manage", "products", "Administrar categorías", "erp:manage"),
  scope("prices:manage", "products", "Administrar precios", "erp:manage"),
  scope("stock:read", "inventory", "Consultar existencias", "erp:read"),
  scope("warehouses:read", "inventory", "Consultar bodegas", "erp:read"),
  scope("warehouses:create", "inventory", "Crear bodegas", "erp:manage"),
  scope("warehouses:update", "inventory", "Actualizar bodegas", "erp:manage"),
  scope("movements:read", "inventory", "Consultar movimientos", "erp:read"),
  scope("stock:adjust", "inventory", "Registrar ajustes de stock", "erp:manage"),
  scope("transfers:read", "inventory", "Consultar transferencias", "erp:read"),
  scope("transfers:create", "inventory", "Registrar transferencias", "erp:manage"),
  scope("transfers:complete", "inventory", "Completar transferencias", "erp:manage"),
  scope("kardex:read", "inventory", "Consultar Kardex", "erp:read"),
  scope("valuation:read", "inventory", "Consultar valoración", "erp:read"),
  scope("counts:read", "inventory", "Consultar conteos físicos", "erp:read"),
  scope("counts:create", "inventory", "Registrar conteos físicos", "erp:manage"),
  scope("counts:update", "inventory", "Registrar cantidades contadas", "erp:manage"),
  scope("counts:complete", "inventory", "Completar conteos físicos", "erp:manage"),
  scope("brands:read", "inventory", "Consultar marcas", "erp:read"),
  scope("brands:manage", "inventory", "Administrar marcas", "erp:manage"),
  scope("units:read", "inventory", "Consultar unidades", "erp:read"),
  scope("units:manage", "inventory", "Administrar unidades", "erp:manage"),
  scope("guides:read", "inventory", "Consultar guías de remisión operativas", "erp:read"),
  scope("guides:create", "inventory", "Crear guías de remisión operativas", "erp:manage"),
  scope("guides:update", "inventory", "Emitir o anular guías operativas en borrador", "erp:manage"),
  scope("vehicles:read", "inventory", "Consultar vehículos", "erp:read"),
  scope("vehicles:manage", "inventory", "Administrar vehículos", "erp:manage"),
  scope("sales:read", "sales", "Consultar ventas y documentos", "erp:read"),
  scope("sales:create", "sales", "Crear ventas", "pos:sell"),
  scope("sales:cancel", "sales", "Anular ventas", "erp:manage"),
  scope("orders:update", "sales", "Confirmar y anular órdenes de venta", "erp:manage"),
  scope("orders:create", "sales", "Crear órdenes de venta", "erp:manage"),
  scope("orders:read", "sales", "Consultar órdenes de venta", "erp:read"),
  scope("proformas:read", "proformas", "Consultar proformas y estados", "erp:read"),
  scope("proformas:create", "proformas", "Crear proformas", "pos:sell"),
  scope("proformas:update", "proformas", "Actualizar proformas", "pos:sell"),
  scope("invoices:read", "invoices", "Consultar facturas y pendientes", "erp:read"),
  scope("invoices:create", "invoices", "Crear facturas mediante el flujo SRI", "pos:sell"),
  scope("invoices:files", "invoices", "Descargar XML autorizado y RIDE", "erp:read"),
  scope("credit-notes:create", "invoices", "Crear notas de crédito en borrador", "erp:manage"),
  scope("credit-notes:read", "invoices", "Consultar notas de crédito", "erp:read"),
  scope("debit-notes:create", "invoices", "Crear notas de débito en borrador", "erp:manage"),
  scope("debit-notes:read", "invoices", "Consultar notas de débito", "erp:read"),
  scope("sri:read", "sri", "Consultar comprobantes y autorizaciones", "erp:read"),
  scope("sri:jobs", "sri", "Consultar sincronizaciones y resultados", "erp:read"),
  scope("sri:cancel", "sri", "Solicitar anulación mediante el proceso autorizado", "erp:manage"),
  scope("sri:sync", "sri", "Solicitar sincronización de documentos recibidos", "erp:manage"),
  scope("sri:sign", "sri", "Solicitar firma mediante el worker existente", "erp:manage"),
  scope("sri:submit", "sri", "Solicitar transmisión mediante el worker existente", "erp:manage"),
  scope("purchases:read", "purchases", "Consultar compras y documentos", "erp:read"),
  scope("purchases:create", "purchases", "Registrar compras", "erp:manage"),
  scope("purchases:update", "purchases", "Actualizar clasificación de compras", "erp:manage"),
  scope("purchases:cancel", "purchases", "Anular compras", "erp:manage"),
  scope("purchase-orders:read", "purchases", "Consultar pedidos de inventario", "erp:read"),
  scope("purchase-orders:create", "purchases", "Crear pedidos de inventario", "erp:manage"),
  scope("receipts:read", "purchases", "Consultar recepciones", "erp:read"),
  scope("receipts:create", "purchases", "Registrar recepciones", "erp:manage"),
  scope("receipts:confirm", "purchases", "Confirmar recepción de inventario", "erp:manage"),
  scope("treasury:read", "treasury", "Consultar cajas, bancos y movimientos", "erp:read"),
  scope("collections:read", "treasury", "Consultar cobros y cuentas por cobrar", "erp:read"),
  scope("collections:create", "treasury", "Registrar cobros", "erp:manage"),
  scope("payments:read", "treasury", "Consultar pagos y cuentas por pagar", "erp:read"),
  scope("payments:create", "treasury", "Registrar pagos", "erp:manage"),
  scope("treasury:manage", "treasury", "Administrar cuentas operativas y sesiones de caja", "erp:manage"),
  scope("treasury:transfer", "treasury", "Transferir entre cuentas propias", "erp:manage"),
  scope("accounts:read", "accounting", "Consultar catálogo de cuentas", "erp:read"),
  scope("journal:read", "accounting", "Consultar asientos", "erp:read"),
  scope("journal:create", "accounting", "Crear asientos en borrador", "erp:manage"),
  scope("journal:post", "accounting", "Contabilizar asientos", "erp:manage"),
  scope("journal:reverse", "accounting", "Revertir asientos mediante el flujo contable", "erp:manage"),
  scope("periods:read", "accounting", "Consultar períodos", "erp:read"),
  scope("accounting-reports:read", "accounting", "Consultar balances y libros", "erp:read"),
  scope("reports:sales", "reports", "Consultar reportes de ventas y clientes", "reports:read"),
  scope("reports:inventory", "reports", "Consultar reportes de productos e inventario", "reports:read"),
  scope("reports:purchases", "reports", "Consultar reportes de compras", "reports:read"),
  scope("reports:financial", "reports", "Consultar reportes financieros", "reports:read"),
  scope("settings:read", "settings", "Consultar configuración operativa delegable", "settings:read"),
  scope("users:read", "users", "Consultar usuarios de esta empresa", "settings:manage"),
] as const;
export type ApiScope = (typeof API_SCOPES)[number]["id"];
export type ApiScopeDefinition = (typeof API_SCOPES)[number];

// Use the same permission resolver as web operations; injected to keep catalogue portable.
export function authorizedScopes(user: AppsoluxUser, check: (user: AppsoluxUser, permission: AppsoluxPermission) => boolean) {
  return API_SCOPES.filter(s => check(user, s.permission));
}
export function selectScopes(input: { scopes?: unknown; fullAccess?: unknown }, available: readonly ApiScopeDefinition[]) {
  const allowed = new Set<string>(available.map(s => s.id));
  const requested = input.fullAccess === true ? [...allowed] : input.scopes;
  if (!Array.isArray(requested) || !requested.length || requested.some(s => typeof s !== "string" || !allowed.has(s))) {
    throw new Error("Selecciona permisos válidos autorizados para tu usuario.");
  }
  const scopes = [...new Set(requested as ApiScope[])].sort();
  return { scopes, fullAccess: scopes.length === allowed.size };
}
