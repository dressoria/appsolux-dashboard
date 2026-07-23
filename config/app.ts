export const appConfig = {
  name: "Facturom",
  description: "Facturación electrónica simple para negocios en Ecuador.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://facturom.com",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ??
    process.env.SUPPORT_EMAIL ??
    "soporte@facturom.com",
};

export const siteConfig = {
  name: "Facturom",
  tagline: "Facturación electrónica simple para negocios en Ecuador.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://facturom.com",
  description:
    "Emite comprobantes electrónicos, vende desde POS y gestiona productos, clientes, inventario y documentos en una sola plataforma.",
  whatsapp:
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ??
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ??
    "593988523538",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ??
    process.env.SUPPORT_EMAIL ??
    "soporte@facturom.com",
  operator: "Facturom",
};
