export const TREASURY_NAVIGATION = [
  {
    title: "Caja",
    items: [
      {
        title: "Gestión de caja",
        href: "/facturacion/treasury/cash/accounts",
        view: "cash/accounts",
      },
      {
        title: "Movimientos de caja",
        href: "/facturacion/treasury/cash/movements",
        view: "cash/movements",
      },
      {
        title: "Cheques postfechados",
        href: "/facturacion/treasury/cash/postdated-checks",
        view: "cash/postdated-checks",
      },
    ],
  },
  {
    title: "Bancos",
    items: [
      {
        title: "Gestión de bancos",
        href: "/facturacion/treasury/banks",
        view: "banks",
      },
      {
        title: "Movimientos bancarios",
        href: "/facturacion/treasury/banks/movements",
        view: "banks/movements",
      },
      {
        title: "Conciliación bancaria",
        href: "/facturacion/treasury/banks/reconciliation",
        view: "banks/reconciliation",
      },
    ],
  },
  {
    title: "Cartera",
    items: [
      {
        title: "Cuentas por cobrar",
        href: "/facturacion/treasury/portfolio/receivables",
        view: "portfolio/receivables",
      },
      {
        title: "Cuentas por pagar",
        href: "/facturacion/treasury/portfolio/payables",
        view: "portfolio/payables",
      },
      {
        title: "Importar obligaciones",
        href: "/facturacion/treasury/portfolio/import",
        view: "portfolio/import",
      },
    ],
  },
  {
    title: "Anticipos",
    items: [
      {
        title: "Anticipos de clientes",
        href: "/facturacion/treasury/advances/customers",
        view: "advances/customers",
      },
      {
        title: "Anticipos a proveedores",
        href: "/facturacion/treasury/advances/suppliers",
        view: "advances/suppliers",
      },
    ],
  },
  {
    title: "Tarjetas",
    items: [
      {
        title: "Gestión de tarjetas",
        href: "/facturacion/treasury/cards",
        view: "cards",
      },
      {
        title: "Movimientos de tarjetas",
        href: "/facturacion/treasury/cards/movements",
        view: "cards/movements",
      },
    ],
  },
] as const;
export type TreasuryView =
  (typeof TREASURY_NAVIGATION)[number]["items"][number]["view"] | "summary";
