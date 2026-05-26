import Link from "next/link";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

const sriNavigation = [
  { title: "Resumen", href: routes.sri },
  { title: "Empresa", href: routes.sriCompany },
  { title: "Establecimientos", href: routes.sriEstablishments },
  { title: "Puntos de emision", href: routes.sriIssuePoints },
  { title: "Secuenciales", href: routes.sriSequences },
  { title: "Ambiente", href: routes.sriEnvironment },
  { title: "Firma electronica", href: routes.sriSignature },
  { title: "Comprobantes", href: routes.sriDocuments },
];

export function SriModuleShell({
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
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full border border-blue-200 bg-blue-50 px-2 text-xs font-medium text-blue-700">
                  Ecuador SRI
                </span>
                <p className="text-sm font-medium text-muted-foreground">
                  Facturacion Electronica
                </p>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                {description}
              </p>
              <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                Esta fase prepara la configuracion. La emision real, autorizacion SRI y generacion de RIDE se implementaran en una fase posterior.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={routes.sriCompany}>Configurar empresa</Link>
            </Button>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {sriNavigation.map((item) => (
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
