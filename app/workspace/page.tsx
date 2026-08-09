import Link from "next/link";
import {
  Bot,
  Building2,
  FileCheck2,
  MessageCircle,
  Package,
  ReceiptText,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";

import { ClerkUserMenu } from "@/components/appsolux/layout/clerk-user-menu";
import { LogoutButton } from "@/components/appsolux/layout/logout-button";
import { WorkspaceLauncherHeader } from "@/components/appsolux/workspace/launcher/workspace-launcher-header";
import { WorkspaceServiceCard } from "@/components/appsolux/workspace/launcher/workspace-service-card";
import { FacturomBrand } from "@/components/public/facturom-brand";
import { routes } from "@/config/routes";
import { isClerkAuth } from "@/lib/auth/provider";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

function getWorkspaceModeLabel(canUseAdvancedErp: boolean) {
  return canUseAdvancedErp ? "Gestión empresarial" : "Plan básico";
}

const billingShortcuts: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Nueva venta", href: routes.facturacionPos, icon: ShoppingCart },
  { label: "Documentos", href: routes.facturacionDocuments, icon: FileCheck2 },
  { label: "Clientes", href: routes.facturacionCustomers, icon: Users },
  { label: "Productos", href: routes.facturacionProducts, icon: Package },
];

export default async function WorkspacePage() {
  const { user, tenant } = await requireDashboardSession();
  const clerkActive = isClerkAuth();
  const tenantMode = await getTenantModeState(tenant);
  const workspaceMode = getWorkspaceModeLabel(tenantMode.canUseAdvancedErp);
  const userName = user.name?.trim() || "Usuario";
  const tenantName = tenant.name?.trim() || "Tu empresa";

  return (
    <main className="min-h-screen bg-facturom-bg text-facturom-text">
      <header className="relative z-10 bg-facturom-primary-dark text-white shadow-[0_10px_30px_rgba(42,6,72,0.2)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={routes.workspace} aria-label="Ir al inicio de Facturom">
              <FacturomBrand variant="white" imageClassName="h-9 w-auto sm:h-10" />
            </Link>
            <div className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 md:inline-flex">
              <Building2 className="h-3.5 w-3.5 text-facturom-yellow" />
              {tenantName}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 sm:block">
              {workspaceMode}
            </div>
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold text-white">{userName}</p>
              <p className="text-xs text-white/55">Cuenta activa</p>
            </div>
            {clerkActive ? <ClerkUserMenu /> : <LogoutButton />}
          </div>
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-[28px] bg-facturom-primary px-6 py-6 text-white shadow-[0_16px_40px_rgba(59,10,103,0.18)] sm:px-8">
            <WorkspaceLauncherHeader userName={userName} />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <WorkspaceServiceCard
              icon={ReceiptText}
              title="Facturación"
              description="Ventas, clientes, inventario y comprobantes SRI."
              ctaLabel="Abrir"
              href={routes.facturacion}
              tone="facturacion"
              eyebrow={workspaceMode}
            />
            <WorkspaceServiceCard
              icon={MessageCircle}
              title="Chats"
              description="Conversa con clientes y centraliza canales de atención."
              eyebrow="Comunicación"
              ctaLabel="Abrir"
              href={routes.conversations}
              tone="chats"
            />
            <WorkspaceServiceCard
              icon={Bot}
              title="Automatizaciones"
              description="Conecta procesos y tareas repetitivas de tu operación."
              eyebrow="Operación"
              ctaLabel="Abrir"
              href={routes.automations}
              tone="automation"
            />
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-facturom-accent" />
              <h2 className="text-sm font-bold text-facturom-primary">Accesos de facturación</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {billingShortcuts.map(({ label, href, icon: Icon }) => (
                <Link key={label} href={href} className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(59,10,103,0.07)] transition hover:-translate-y-0.5 hover:bg-facturom-primary hover:text-white">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-facturom-primary/10 text-facturom-primary group-hover:bg-white/15 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold">{label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
