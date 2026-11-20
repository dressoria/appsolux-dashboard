export type InvoiceSeller = { id: string; name: string; email: string | null };
export type InvoiceSellerContext = {
  sellers: InvoiceSeller[];
  defaultSellerId: string;
  canSelectSeller: boolean;
};

export type InvoiceJournal = {
  id: string;
  number: string;
  status: "DRAFT" | "POSTED" | "REVERSED";
  description: string;
  lines: Array<{ id: string; accountCode: string; accountName: string; debit: string; credit: string }>;
  totalDebit: string;
  totalCredit: string;
  difference: string;
};
