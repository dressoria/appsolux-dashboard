import Link from "next/link";
import { routes } from "@/config/routes";

const appItems = [
  { title: "Inventario & POS", href: routes.basic },
  { title: "Ventas", href: routes.sales },
  { title: "Facturacion SRI", href: routes.sri },
  { title: "ERP Avanzado", href: routes.erp },
];

const comunicacionItems = [
  { title: "Conversaciones", href: routes.conversations },
  { title: "Canales", href: routes.channels },
  { title: "Automatizaciones", href: routes.automations },
];

const cuentaItems = [
  { title: "Mi Plan", href: routes.billing },
  { title: "Ajustes", href: routes.settings },
];

const navigationGroups = [
  { title: "Mis Apps", items: appItems },
  { title: "Comunicacion", items: comunicacionItems },
  { title: "Cuenta", items: cuentaItems },
];

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-64 border-r bg-background px-4 py-6 lg:block">
      <div className="mb-6 px-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Appsolux</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">Suite Empresarial</h2>
      </div>

      <div className="mb-4">
        <Link
          href={routes.workspace}
          className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/10"
        >
          <span className="text-base">⊞</span>
          Mis Aplicaciones
        </Link>
      </div>

      <nav className="space-y-5">
        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {item.title}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
