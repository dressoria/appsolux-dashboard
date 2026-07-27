import Link from "next/link";
import { Bot, Building2, MessageCircle, ReceiptText } from "lucide-react";

import { ClerkUserMenu } from "@/components/appsolux/layout/clerk-user-menu";
import { LogoutButton } from "@/components/appsolux/layout/logout-button";
import { WorkspaceLauncherHeader } from "@/components/appsolux/workspace/launcher/workspace-launcher-header";
import { WorkspaceServiceCard } from "@/components/appsolux/workspace/launcher/workspace-service-card";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { isClerkAuth } from "@/lib/auth/provider";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

function getWorkspaceModeLabel(canUseAdvancedErp: boolean) {
  return canUseAdvancedErp ? "Gestión empresarial" : "Plan básico";
}

export default async function WorkspacePage() {
  const { user, tenant } = await requireDashboardSession();
  const clerkActive = isClerkAuth();
  const tenantMode = await getTenantModeState(tenant);
  const workspaceMode = getWorkspaceModeLabel(tenantMode.canUseAdvancedErp);
  const userName = user.name?.trim() || "Usuario";
  const tenantName = tenant.name?.trim() || "Tu empresa";

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-[#0d0f12]">
      <header className="relative z-10 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={routes.workspace} className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[#588100] text-white shadow-md shadow-[#588100]/20">
                <span className="text-[11px] font-black uppercase tracking-[0.22em]">FT</span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Facturom
                </p>
                <p className="truncate text-base font-black text-slate-950">Workspace</p>
              </div>
            </Link>
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 md:inline-flex">
              <Building2 className="h-3.5 w-3.5 text-[#588100]" />
              {tenantName}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 sm:block">
              {workspaceMode}
            </div>
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold text-slate-900">{userName}</p>
              <p className="text-xs text-slate-500">Cuenta activa</p>
            </div>
            {clerkActive ? <ClerkUserMenu /> : <LogoutButton />}
          </div>
        </div>
      </header>

      <div className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-8">
          <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-7 shadow-[0_12px_36px_rgba(15,23,42,0.05)] sm:px-8">
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
              tone="neutral"
            />
            <WorkspaceServiceCard
              icon={Bot}
              title="Automatizaciones"
              description="Conecta procesos y tareas repetitivas de tu operación."
              eyebrow="Operación"
              ctaLabel="Abrir"
              href={routes.automations}
              tone="neutral"
            />
          </section>

          <section className="flex flex-col items-start justify-between gap-4 rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-sm md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-900">¿Necesitas una vista más detallada?</p>
              <p className="text-sm text-slate-500">
                Abre el panel interno para configuraciones y accesos complementarios.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-full bg-[#588100] px-5 text-white shadow-md shadow-[#588100]/20 hover:bg-[#4b6f00]">
                <Link href={routes.facturacion}>Abrir facturación</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-50">
                <Link href="/workspace/panel">Panel completo</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
