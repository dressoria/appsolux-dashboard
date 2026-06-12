import Link from "next/link";

import { AppModuleShell } from "@/components/appsolux/layout/app-module-shell";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

const sriNavigation = [
  { title: "Facturacion", href: routes.sriDocuments },
  { title: "Configuracion SRI", href: routes.sri },
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
  appName = "Configuracion SRI",
  appDescription = "Centro de configuracion, firma, secuenciales, ambiente y monitoreo tributario.",
  badge = "Configuracion",
  badgeVariant = "blue",
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
  action?: React.ReactNode;
}) {
  return (
    <AppModuleShell
      appName={appName}
      appDescription={appDescription}
      badge={badge}
      badgeVariant={badgeVariant}
      navItems={sriNavigation}
      activeHref={activeHref}
      action={
        action ?? (
        <Button asChild variant="outline">
          <Link href={routes.sriDocuments}>Ver facturas</Link>
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
