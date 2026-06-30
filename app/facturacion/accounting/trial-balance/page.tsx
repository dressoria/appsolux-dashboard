import ErpAccountingTrialBalancePage from "@/app/erp/accounting/trial-balance/page";

type Props = { searchParams: Promise<{ from?: string; to?: string; company?: string }> };

export default async function FacturacionAccountingTrialBalancePage({ searchParams }: Props) {
  return <ErpAccountingTrialBalancePage searchParams={searchParams} />;
}
