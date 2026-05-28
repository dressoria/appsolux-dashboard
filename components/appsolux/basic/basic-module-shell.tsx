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
}: {
  title: string;
  description: string;
  activeHref: string;
  children: React.ReactNode;
}) {
  return (
    <AppModuleShell
      appName="Inventario & POS"
      appDescription="Productos, stock, clientes, ventas, caja y reportes para operacion diaria."
      badge="Modo Basico"
      badgeVariant="slate"
      navItems={basicNavigation}
      activeHref={activeHref}
      action={
        <Button asChild>
          <Link href={routes.basicPos}>Nueva venta</Link>
        </Button>
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
