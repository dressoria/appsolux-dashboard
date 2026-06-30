import ErpAccountingBalanceSheetPage from "@/app/erp/accounting/balance-sheet/page";

type Props = { searchParams: Promise<{ to?: string; company?: string }> };

export default async function FacturacionAccountingBalanceSheetPage({ searchParams }: Props) {
  return <ErpAccountingBalanceSheetPage searchParams={searchParams} />;
}
