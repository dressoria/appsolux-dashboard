import Link from "next/link";
import {
  Boxes,
  FileCheck,
  LayoutGrid,
  MessageSquareText,
  MessageSquareWarning,
  Settings2,
  ShoppingCart,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { routes } from "@/config/routes";
import { resolveTenantAppRouting } from "@/lib/core/tenant-app-routing";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { cn } from "@/lib/utils";
import type { AppsoluxUser } from "@/types/user";

export async function Sidebar({ user }: { user: AppsoluxUser }) {
  const tenantMode = await getTenantModeState(user.tenant);
  const appRouting = resolveTenantAppRouting(tenantMode);
  const navigationGroups = [
    {
      title: "Operacion",
      items: [
        { title: "Inventario", href: appRouting.inventoryHref, icon: Boxes },
        { title: "POS / Ventas", href: appRouting.salesHref, icon: ShoppingCart },
        { title: "Facturacion", href: routes.sriDocuments, icon: FileCheck },
        { title: "ERP Avanzado", href: appRouting.erpActionHref, icon: Sparkles },
      ],
    },
    {
      title: "Configuracion",
      items: [
        { title: "Configuracion SRI", href: routes.sri, icon: Settings2 },
        { title: "Ajustes", href: routes.settings, icon: MessageSquareWarning },
      ],
    },
    {
      title: "Comunicacion",
      items: [
        { title: "Conversaciones", href: routes.conversations, icon: MessageSquareText },
        { title: "Canales", href: routes.channels, icon: LayoutGrid },
        { title: "Automatizaciones", href: routes.automations, icon: Sparkles },
      ],
    },
    {
      title: "Cuenta",
      items: [{ title: "Mi Plan", href: routes.billing, icon: WalletCards }],
    },
  ];

  return (
    <aside className="hidden min-h-screen w-72 border-r border-slate-200 bg-linear-to-b from-slate-50 via-white to-slate-50/60 px-4 py-6 lg:block">
      <div className="mb-6 rounded-2xl border border-sky-100 bg-white px-4 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Workspace</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
          Panel empresarial
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {appRouting.hasActiveErp
            ? "Operacion ERP, facturacion y canales en una navegacion mas clara."
            : "Operacion basica, facturacion y canales en una navegacion mas clara."}
        </p>
      </div>

      <div className="mb-4">
        <Link
          href={routes.workspace}
          className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
        >
          <div className="rounded-xl bg-white p-2 text-sky-700 shadow-sm">
            <LayoutGrid className="h-4 w-4" />
          </div>
          Mis Aplicaciones
        </Link>
      </div>

      <nav className="space-y-5">
        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {group.title}
            </p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className="h-4 w-4 text-slate-400" />
                {item.title}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
