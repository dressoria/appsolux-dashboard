import KardexPage from "@/app/erp/inventory/kardex/page";

type Props = { searchParams: Promise<{ item?: string; warehouse?: string }> };

export default async function FacturacionInventoryKardexPage({ searchParams }: Props) {
  return <KardexPage searchParams={await searchParams} />;
}
