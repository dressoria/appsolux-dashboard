import Link from "next/link";

import { AppModuleShell } from "@/components/appsolux/layout/app-module-shell";
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
    <AppModuleShell
      appName="Facturacion Electronica Ecuador"
      appDescription="Configura empresa, RUC, establecimientos, secuenciales, firma electronica y comprobantes."
      badge="Ecuador SRI"
      badgeVariant="blue"
      navItems={sriNavigation}
      activeHref={activeHref}
      action={
        <Button asChild variant="outline">
          <Link href={routes.sriCompany}>Configurar empresa</Link>
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
