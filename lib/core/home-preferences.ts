import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";
import { routes } from "@/config/routes";

export type ShortcutEntry = {
  key: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  tone: "blue" | "orange";
  optional?: boolean;
};

const SHORTCUT_CATALOG: ShortcutEntry[] = [
  { key: "emit_invoice", title: "Emitir factura", description: "Una nueva venta, lista en minutos", icon: "ReceiptText", href: routes.facturacionPos, tone: "orange" },
  { key: "create_purchase", title: "Crear compra", description: "Registra una compra de tu negocio", icon: "ShoppingCart", href: routes.facturacionPurchasesNew, tone: "blue" },
  { key: "journal", title: "Libro diario", description: "Consulta tus asientos contables", icon: "BookOpen", href: routes.facturacionAccountingJournal, tone: "blue" },
  { key: "documents", title: "Documentos", description: "Revisa facturas y comprobantes", icon: "FileCheck2", href: routes.facturacionDocuments, tone: "orange" },
  { key: "products", title: "Productos", description: "Tu catálogo, siempre a mano", icon: "Package", href: routes.facturacionProducts, tone: "orange" },
  { key: "customers", title: "Clientes", description: "Gestiona tus contactos", icon: "Users", href: routes.facturacionCustomers, tone: "blue" },
  { key: "cash", title: "Caja", description: "Consulta los movimientos de caja", icon: "Wallet", href: routes.facturacionCash, tone: "orange" },
  { key: "company", title: "Empresa", description: "La configuración de tu negocio", icon: "Building2", href: routes.facturacionSettings, tone: "blue" },
  { key: "sri", title: "SRI", description: "Comprobantes y gestión tributaria", icon: "ShieldCheck", href: routes.facturacionSri, tone: "blue", optional: true },
  { key: "configuration", title: "Configuración", description: "Configura Facturom para tu negocio", icon: "Settings2", href: routes.facturacionConfiguration, tone: "blue", optional: true },
];

const CATALOG_MAP = new Map(SHORTCUT_CATALOG.map((s) => [s.key, s]));
const VALID_KEYS = new Set(SHORTCUT_CATALOG.map((s) => s.key));

export const DEFAULT_SHORTCUT_KEYS = [
  "emit_invoice",
  "create_purchase",
  "journal",
  "documents",
  "products",
  "customers",
  "cash",
  "company",
];

export function getShortcutCatalog(): ShortcutEntry[] {
  return SHORTCUT_CATALOG;
}

export function resolveShortcuts(keys: string[]): ShortcutEntry[] {
  const seen = new Set<string>();
  const result: ShortcutEntry[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = CATALOG_MAP.get(key);
    if (entry) result.push(entry);
  }
  return result;
}

export function isValidShortcutKey(key: unknown): key is string {
  return typeof key === "string" && VALID_KEYS.has(key);
}

export function validateShortcutKeys(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  if (input.length > SHORTCUT_CATALOG.length) return null;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of input) {
    if (!isValidShortcutKey(item)) return null;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

export async function getUserShortcutKeys(
  userId: string,
  tenantId: string,
): Promise<string[]> {
  const prisma = getPrismaClient();
  const pref = await prisma.userHomePreference.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
  if (!pref) return DEFAULT_SHORTCUT_KEYS;
  const keys = pref.shortcutKeys;
  if (!Array.isArray(keys)) return DEFAULT_SHORTCUT_KEYS;
  const valid = keys.filter((k): k is string => isValidShortcutKey(k));
  return valid.length > 0 ? valid : DEFAULT_SHORTCUT_KEYS;
}

export async function saveUserShortcutKeys(
  userId: string,
  tenantId: string,
  keys: string[],
): Promise<void> {
  const validated = validateShortcutKeys(keys);
  if (!validated) throw new Error("Shortcut keys inválidos.");
  const prisma = getPrismaClient();
  await prisma.userHomePreference.upsert({
    where: { userId_tenantId: { userId, tenantId } },
    create: { userId, tenantId, shortcutKeys: validated },
    update: { shortcutKeys: validated },
  });
}
