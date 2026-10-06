import AdjustmentsPage from "@/app/erp/inventory/adjustments/page";

type Props = { searchParams: Promise<{ item?: string; warehouse?: string }> };

export default async function FacturacionInventoryAdjustmentsPage({ searchParams }: Props) {
  return <AdjustmentsPage searchParams={await searchParams} />;
}
