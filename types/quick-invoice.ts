export type PriceChannel = "RETAIL" | "WHOLESALE" | "DISTRIBUTOR" | "MANUAL";

export type ProductPricingRecord = {
  itemCode: string;
  itemName?: string | null;
  retailPrice: number;
  wholesalePrice?: number | null;
  distributorPrice?: number | null;
  notes?: string | null;
};

export type QuickInvoiceCatalogItem = {
  itemCode: string;
  itemName: string;
  pricing?: ProductPricingRecord | null;
};

export type QuickInvoiceCatalogCustomer = {
  name: string;
  customerName: string;
  taxId?: string | null;
  mobileNo?: string | null;
};

export type QuickInvoiceCatalogCompany = {
  name: string;
  companyName?: string | null;
};

export type QuickInvoiceProductCandidate = {
  itemCode: string;
  itemName: string;
  score: number;
};

export type QuickInvoiceDraftItem = {
  itemCode: string | null;
  itemName: string;
  qty: number;
  unitPrice: number | null;
  normalUnitPrice: number | null;
  priceChannel: PriceChannel;
  manualPriceReason?: string | null;
  total: number | null;
  discountAmount: number | null;
  warnings: string[];
  candidates: QuickInvoiceProductCandidate[];
  sourceFragment: string;
};

export type QuickInvoiceDraftCustomer = {
  customerName: string;
  taxId: string;
  phone: string;
  address: string;
  existingCustomerName?: string | null;
};

export type QuickInvoiceParsedDraft = {
  rawMessage: string;
  customer: QuickInvoiceDraftCustomer;
  companyName: string;
  companyMatchName?: string | null;
  priceChannel: PriceChannel;
  items: QuickInvoiceDraftItem[];
  warnings: string[];
  totalAmount: number | null;
  requiresReview: boolean;
};
