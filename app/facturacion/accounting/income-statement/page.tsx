import ErpAccountingProfitAndLossPage from "@/app/erp/accounting/profit-and-loss/page";

type Props = { searchParams: Promise<{ from?: string; to?: string; company?: string }> };

export default async function FacturacionAccountingIncomeStatementPage({ searchParams }: Props) {
  return <ErpAccountingProfitAndLossPage searchParams={searchParams} />;
}
