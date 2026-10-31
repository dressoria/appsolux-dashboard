import Link from "next/link";
import { SRI_PURCHASES_NAVIGATION } from "@/config/sri-tax-navigation";

export function PurchasesImportTabs({ activeHref }: { activeHref: string }) {
  return <nav aria-label="Importación de compras" className="mb-6 flex gap-1 overflow-x-auto border-b">
    {SRI_PURCHASES_NAVIGATION.map(({ href, title }) => <Link key={href} href={href} aria-current={href === activeHref ? "page" : undefined} className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${href === activeHref ? "border-b-2 border-[#1E52F1] text-[#1E52F1]" : "text-slate-500 hover:text-slate-700"}`}>{title}</Link>)}
  </nav>;
}
