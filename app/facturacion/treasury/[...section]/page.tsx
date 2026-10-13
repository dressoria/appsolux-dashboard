import { notFound, redirect } from "next/navigation";
import { TreasuryPage } from "@/components/appsolux/treasury/treasury-page";
import { TREASURY_NAVIGATION } from "@/config/treasury-navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const view = (await params).section.join("/");
  if (view === "cash") redirect("/facturacion/treasury/cash/accounts");
  const item = TREASURY_NAVIGATION.flatMap((group) => [...group.items]).find(
    (entry) => entry.view === view,
  );
  if (!item) notFound();
  return <TreasuryPage view={item.view} />;
}
