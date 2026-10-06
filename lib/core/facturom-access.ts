/**
 * Temporary product-access policy used while the complete Facturom experience
 * is being stabilized. This is intentionally independent from billing, plans,
 * subscriptions, and the tenant's technical data source.
 */
export type FacturomAccess = Readonly<{
  fullAccess: boolean;
  invoicing: boolean;
  customers: boolean;
  products: boolean;
  sri: boolean;
  inventory: boolean;
  purchases: boolean;
  treasury: boolean;
  accounting: boolean;
  reports: boolean;
  usersAndPermissions: boolean;
}>;

export const facturomAccess: FacturomAccess = Object.freeze({
  fullAccess: true,
  invoicing: true,
  customers: true,
  products: true,
  sri: true,
  inventory: true,
  purchases: true,
  treasury: true,
  accounting: true,
  reports: true,
  usersAndPermissions: true,
});

export function getFacturomAccess(): FacturomAccess {
  return facturomAccess;
}
