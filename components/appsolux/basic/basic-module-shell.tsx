import Link from "next/link";

import { AppModuleShell } from "@/components/appsolux/layout/app-module-shell";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

const basicNavigation = [
  { title: "Resumen", href: routes.basic },
  { title: "POS", href: routes.basicPos },
  { title: "Productos", href: routes.basicProducts },
  { title: "Clientes", href: routes.basicCustomers },
  { title: "Ventas", href: routes.basicSales },
  { title: "Stock", href: routes.basicStock },
  { title: "Caja", href: routes.basicCash },
  { title: "Reportes", href: routes.basicReports },
];

export function BasicModuleShell({
  title,
  description,
  activeHref,
  children,
  appName = "Inventario & POS",
  appDescription = "Productos, stock, clientes, ventas, caja y reportes para operacion diaria.",
  badge = "Modo Basico",
  badgeVariant = "slate",
  navItems = basicNavigation,
  action,
}: {
  title: string;
  description: string;
  activeHref: string;
  children: React.ReactNode;
  appName?: string;
  appDescription?: string;
  badge?: string;
  badgeVariant?: "slate" | "blue" | "emerald" | "amber" | "violet";
  navItems?: Array<{ title: string; href: string }>;
  action?: React.ReactNode;
}) {
  return (
    <AppModuleShell
      appName={appName}
      appDescription={appDescription}
      badge={badge}
      badgeVariant={badgeVariant}
      navItems={navItems}
      activeHref={activeHref}
      action={
        action ?? (
          <Button asChild>
            <Link href={routes.basicPos}>Nueva venta</Link>
          </Button>
        )
      }
    >
      {(title || description) && (
        <div className="px-1">
          {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </AppModuleShell>
  );
}
