export const SRI_TAX_NAVIGATION = [
  { title: "Resumen tributario", href: "/facturacion/sri" },
  { title: "Comprobantes recibidos", href: "/facturacion/sri/received" },
  { title: "Anexo Transaccional (ATS)", href: "/facturacion/sri/ats" },
  { title: "Talón resumen ATS", href: "/facturacion/sri/ats/summary" },
  { title: "Reporte IVA 104", href: "/facturacion/sri/iva-104" },
  { title: "Validaciones tributarias", href: "/facturacion/sri/validations" },
] as const;

export const SRI_SALES_NAVIGATION = [
  { title: "Consolidado", href: "/facturacion/sales/imports" },
  { title: "Importar archivo", href: "/facturacion/sales/imports/file" },
  { title: "Importación automática", href: "/facturacion/sales/imports/automatic" },
] as const;

export const SRI_PURCHASES_NAVIGATION = [
  { title: "Consolidado", href: "/facturacion/purchases/consolidated" },
  { title: "Importar archivo", href: "/facturacion/purchases/txt-import" },
  { title: "Importación automática", href: "/facturacion/purchases/automatic-download" },
] as const;

export const SRI_CONFIGURATION_NAVIGATION = [
  {
    title: "Datos fiscales",
    href: "/facturacion/sri/company",
    description: "RUC, razón social, nombre comercial, régimen y contabilidad.",
  },
  {
    title: "Firma electrónica",
    href: "/facturacion/sri/signature",
    description: "Certificado, carga y estado de la firma.",
  },
  {
    title: "Establecimientos",
    href: "/facturacion/sri/establishments",
    description: "Establecimientos y sus códigos fiscales.",
  },
  {
    title: "Puntos de emisión",
    href: "/facturacion/sri/issue-points",
    description: "Puntos de emisión por establecimiento.",
  },
  {
    title: "Secuenciales",
    href: "/facturacion/sri/sequences",
    description: "Numeración de comprobantes por punto de emisión.",
  },
  {
    title: "Ambiente SRI",
    href: "/facturacion/sri/environment",
    description: "Consulta y gestiona el ambiente fiscal existente.",
  },
  {
    title: "Credenciales SRI",
    href: "/facturacion/configuration",
    description: "Usuario y contraseña para acceso al portal del SRI.",
  },
] as const;
