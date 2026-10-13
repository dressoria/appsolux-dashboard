import { redirect } from "next/navigation";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

export default async function FacturacionPurchasesPage() {
  await requireDashboardSession();
  redirect("/facturacion/purchases/documents");
}
