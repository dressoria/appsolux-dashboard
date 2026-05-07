import Link from "next/link";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
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
    <DashboardShell>
      <div className="space-y-6">
        <div className="rounded-md border bg-muted/30 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Appsolux Basico
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                {description}
              </p>
              <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                Este es tu modo basico incluido en el plan. Para inventario
                avanzado, multiples bodegas, POS completo y reportes avanzados,
                activa ERP dedicado desde Mi plan.
              </p>
            </div>
            <Button asChild>
              <Link href={routes.basicPos}>Nueva venta</Link>
            </Button>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {basicNavigation.map((item) => (
              <Button
                key={item.href}
                asChild
                variant={activeHref === item.href ? "default" : "outline"}
                className="shrink-0"
              >
                <Link href={item.href}>{item.title}</Link>
              </Button>
            ))}
          </nav>
        </div>

        {children}
      </div>
    </DashboardShell>
  );
}
