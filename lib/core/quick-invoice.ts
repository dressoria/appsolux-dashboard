import type {
  PriceChannel,
  ProductPricingRecord,
  QuickInvoiceCatalogCompany,
  QuickInvoiceCatalogCustomer,
  QuickInvoiceCatalogItem,
  QuickInvoiceDraftItem,
  QuickInvoiceParsedDraft,
  QuickInvoiceProductCandidate,
} from "@/types/quick-invoice";
import { resolvePriceForChannel } from "@/lib/core/price-channels";

type QuickInvoiceCatalog = {
  items: QuickInvoiceCatalogItem[];
  customers: QuickInvoiceCatalogCustomer[];
  companies: QuickInvoiceCatalogCompany[];
  defaultCompanyName?: string;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toMoney(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 100) / 100
    : null;
}

function detectPriceChannel(text: string): PriceChannel {
  const normalized = normalizeText(text);

  if (normalized.includes("distribuidor")) return "DISTRIBUTOR";
  if (normalized.includes("mayorista") || normalized.includes("por mayor")) {
    return "WHOLESALE";
  }
  if (normalized.includes("minorista")) return "RETAIL";
  if (normalized.includes("manual")) return "MANUAL";

  return "RETAIL";
}

function detectIdentifier(lines: string[]) {
  for (const line of lines) {
    const match = line.match(/\b\d{10,13}\b/);
    if (match) {
      return match[0];
    }
  }

  return "";
}

function detectPhone(lines: string[]) {
  for (const line of lines) {
    const match = line.match(/(?:\+593|0)\d{9,10}\b/);
    if (match) {
      return match[0];
    }
  }

  return "";
}

function detectAddress(lines: string[]) {
  return (
    lines.find((line) => {
      const normalized = normalizeText(line);
      return (
        normalized.length > 12 &&
        !/\b\d{10,13}\b/.test(line) &&
        !/(?:\+593|0)\d{9,10}\b/.test(line) &&
        !normalized.startsWith("facturar") &&
        !normalized.startsWith("a nombre de")
      );
    }) ?? ""
  );
}

function detectCustomerName(lines: string[]) {
  return (
    lines.find((line) => {
      const normalized = normalizeText(line);
      return (
        normalized.length > 4 &&
        !/\b\d{10,13}\b/.test(line) &&
        !/(?:\+593|0)\d{9,10}\b/.test(line) &&
        !normalized.startsWith("facturar") &&
        !normalized.startsWith("a nombre de")
      );
    }) ?? ""
  );
}

function detectCompanyName(
  text: string,
  companies: QuickInvoiceCatalogCompany[],
  defaultCompanyName?: string
) {
  const normalized = normalizeText(text);
  const explicit = normalized.match(/a nombre de ([a-z0-9\s]+)/i);

  if (explicit?.[1]) {
    const requested = explicit[1].trim();
    const companyMatch = companies.find((company) => {
      const companyLabel = normalizeText(company.companyName ?? company.name);
      return (
        companyLabel.includes(requested) ||
        requested.includes(companyLabel)
      );
    });

    return {
      label: companyMatch?.name ?? explicit[1].trim(),
      matchedName: companyMatch?.name ?? null,
    };
  }

  const defaultMatch =
    companies.find((company) => company.name === defaultCompanyName) ??
    companies[0] ??
    null;

  return {
    label: defaultMatch?.name ?? "",
    matchedName: defaultMatch?.name ?? null,
  };
}

function detectExplicitAmount(text: string) {
  const normalized = normalizeText(text);
  const match = normalized.match(
    /(?:por|precio|total)\s+(\d+(?:[.,]\d+)?)/i
  );

  if (!match?.[1]) {
    return null;
  }

  return Number(match[1].replace(",", "."));
}

function detectQuantity(fragment: string) {
  const normalized = normalizeText(fragment);
  const match =
    normalized.match(/\bx\s*(\d+(?:[.,]\d+)?)\b/i) ??
    normalized.match(/\b(\d+(?:[.,]\d+)?)\s*(?:unidades?|uds?|u)\b/i) ??
    normalized.match(/^(\d+(?:[.,]\d+)?)\s+/i);

  if (!match?.[1]) {
    return 1;
  }

  return Math.max(1, Number(match[1].replace(",", ".")));
}

function extractProductFragments(rawMessage: string) {
  const lines = rawMessage
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const fragments: string[] = [];

  for (const line of lines) {
    const normalized = normalizeText(line);

    if (normalized.includes("facturar")) {
      const cleaned = line
        .replace(/facturar/gi, "")
        .replace(/a nombre de .*/gi, "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      fragments.push(...cleaned);
    }
  }

  return fragments.length > 0 ? fragments : lines.slice(-1);
}

function buildCandidates(
  fragment: string,
  items: QuickInvoiceCatalogItem[]
): QuickInvoiceProductCandidate[] {
  const normalizedFragment = normalizeText(fragment)
    .replace(/\b(?:x\s*\d+|\d+\s*(?:unidades?|uds?|u))\b/gi, "")
    .replace(/\b(?:por|precio|total)\s+\d+(?:[.,]\d+)?\b/gi, "")
    .trim();

  if (!normalizedFragment) {
    return [];
  }

  return items
    .map((item) => {
      const name = normalizeText(item.itemName);
      const code = normalizeText(item.itemCode);
      let score = 0;

      if (name === normalizedFragment || code === normalizedFragment) score += 100;
      if (name.includes(normalizedFragment)) score += 60;
      if (normalizedFragment.includes(name)) score += 40;
      if (code.includes(normalizedFragment)) score += 50;

      return {
        itemCode: item.itemCode,
        itemName: item.itemName,
        score,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function findExistingCustomer(
  customerName: string,
  taxId: string,
  phone: string,
  customers: QuickInvoiceCatalogCustomer[]
): QuickInvoiceCatalogCustomer | null {
  const byTaxId =
    taxId.trim() &&
    customers.find((customer) => customer.taxId?.trim() === taxId.trim());

  if (byTaxId) {
    return byTaxId;
  }

  const normalizedCustomerName = normalizeText(customerName);
  const byName =
    normalizedCustomerName &&
    customers.find((customer) => {
      const normalized = normalizeText(customer.customerName);
      return (
        normalized === normalizedCustomerName ||
        normalized.includes(normalizedCustomerName) ||
        normalizedCustomerName.includes(normalized)
      );
    });

  if (byName) {
    return byName;
  }

  const byPhone =
    phone.trim() &&
    customers.find((customer) => customer.mobileNo?.trim() === phone.trim());

  return byPhone || null;
}

export function parseQuickInvoiceMessage(
  rawMessage: string,
  catalog: QuickInvoiceCatalog
): QuickInvoiceParsedDraft {
  const lines = rawMessage
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const warnings: string[] = [];
  const customerName = detectCustomerName(lines);
  const taxId = detectIdentifier(lines);
  const phone = detectPhone(lines);
  const address = detectAddress(lines);
  const explicitAmount = detectExplicitAmount(rawMessage);
  const priceChannel = detectPriceChannel(rawMessage);
  const company = detectCompanyName(
    rawMessage,
    catalog.companies,
    catalog.defaultCompanyName
  );
  const existingCustomer = findExistingCustomer(
    customerName,
    taxId,
    phone,
    catalog.customers
  );

  const fragments = extractProductFragments(rawMessage);
  const items: QuickInvoiceDraftItem[] = fragments.map((fragment) => {
    const qty = detectQuantity(fragment);
    const candidates = buildCandidates(fragment, catalog.items);
    const selectedCandidate = candidates[0] ?? null;
    const sourceItem = selectedCandidate
      ? catalog.items.find((item) => item.itemCode === selectedCandidate.itemCode)
      : null;
    const lineWarnings: string[] = [];
    let effectiveChannel = priceChannel;
    let unitPrice =
      sourceItem?.pricing
        ? resolvePriceForChannel(sourceItem.pricing, priceChannel)
        : null;
    const normalUnitPrice =
      sourceItem?.pricing
        ? resolvePriceForChannel(sourceItem.pricing, "RETAIL")
        : null;
    let manualPriceReason: string | null = null;

    if (candidates.length > 1 && (candidates[0]?.score ?? 0) === (candidates[1]?.score ?? -1)) {
      lineWarnings.push(
        `Producto ambiguo en "${fragment}". Revisa las opciones detectadas.`
      );
    }

    if (!selectedCandidate) {
      lineWarnings.push(`No se encontro producto para "${fragment}".`);
    }

    if (explicitAmount != null && fragments.length === 1) {
      effectiveChannel = "MANUAL";
      unitPrice = explicitAmount / qty;
      manualPriceReason = `Importe detectado desde mensaje: ${explicitAmount}`;
      lineWarnings.push(
        'Se interpreto el texto como precio/manual total. Confirma antes de facturar.'
      );
    }

    if (unitPrice == null) {
      lineWarnings.push(
        `El producto ${selectedCandidate?.itemName ?? fragment} no tiene precio configurado.`
      );
    }

    const total = unitPrice != null ? toMoney(unitPrice * qty) : null;
    const discountAmount =
      normalUnitPrice != null && unitPrice != null && unitPrice < normalUnitPrice
        ? toMoney((normalUnitPrice - unitPrice) * qty)
        : null;

    return {
      itemCode: selectedCandidate?.itemCode ?? null,
      itemName: selectedCandidate?.itemName ?? fragment,
      qty,
      unitPrice: toMoney(unitPrice),
      normalUnitPrice: toMoney(normalUnitPrice),
      priceChannel: effectiveChannel,
      manualPriceReason,
      total,
      discountAmount,
      warnings: lineWarnings,
      candidates,
      sourceFragment: fragment,
    };
  });

  if (!customerName) {
    warnings.push("No se detecto un nombre de cliente claro.");
  }

  if (!taxId) {
    warnings.push("No se detecto cedula o RUC.");
  }

  if (!company.label) {
    warnings.push("No se detecto empresa emisora.");
  }

  items.forEach((item) => warnings.push(...item.warnings));

  const totalAmount = toMoney(
    items.reduce((sum, item) => sum + (item.total ?? 0), 0)
  );
  const requiresReview =
    warnings.length > 0 ||
    items.length === 0 ||
    items.some(
      (item) =>
        !item.itemCode || item.unitPrice == null || item.unitPrice <= 0
    );

  return {
    rawMessage,
    customer: {
      customerName: existingCustomer?.customerName ?? customerName,
      taxId: taxId || existingCustomer?.taxId || "",
      phone: phone || existingCustomer?.mobileNo || "",
      address,
      existingCustomerName: existingCustomer?.name ?? null,
    },
    companyName: company.label,
    companyMatchName: company.matchedName,
    priceChannel,
    items,
    warnings,
    totalAmount,
    requiresReview,
  };
}
