import Link from "next/link";
import { ArrowRight, BarChart3, Bot, Building2, MessageCircle, ReceiptText, ShieldCheck } from "lucide-react";

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

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(141,182,0,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(188,78,216,0.16),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_42%,_#f4f7fb_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40" />

      <header className="relative z-10 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={routes.workspace} className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#588100] via-[#8db600] to-[#7f00b2] text-white shadow-lg shadow-[#588100]/20">
                <span className="text-[11px] font-black uppercase tracking-[0.22em]">FT</span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Facturom
                </p>
                <p className="truncate text-base font-black text-slate-950">
                  Portal principal
                </p>
              </div>
            </Link>
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-500 shadow-sm md:inline-flex">
              <Building2 className="h-3.5 w-3.5 text-[#588100]" />
              Empresa activa: {tenant.name}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-500 shadow-sm sm:block">
              {workspaceMode}
            </div>
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">Tu acceso en Facturom</p>
            </div>
            {clerkActive ? <ClerkUserMenu /> : <LogoutButton />}
          </div>
        </div>
      </header>

      <div className="relative z-10 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl">
          <section className="overflow-hidden rounded-[36px] border border-white/70 bg-white/75 px-6 py-8 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-8 sm:py-10">
            <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
              <WorkspaceLauncherHeader tenantName={tenant.name} />

              <div className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl shadow-slate-900/15">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#8db600]" />
                  Operación actual
                </div>
                <h2 className="mt-4 text-2xl font-black">
                  Gestiona tu operación desde un solo lugar.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Facturación es tu módulo principal, mientras chats, automatizaciones y reportes
                  acompañan la operación diaria de tu empresa.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                    {workspaceMode}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                    Empresa: {tenant.name}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <WorkspaceServiceCard
              icon={ReceiptText}
              title="Facturación"
              description="Emite comprobantes, vende desde POS y gestiona clientes, productos e inventario."
              tags={["Ventas", "SRI", "POS", "Inventario"]}
              badge={workspaceMode}
              eyebrow="Módulo principal"
              ctaLabel="Abrir facturación"
              href={routes.facturacion}
              tone="facturacion"
              featured
              className="lg:col-span-2"
            />
            <WorkspaceServiceCard
              icon={MessageCircle}
              title="Chats"
              description="Centraliza conversaciones, canales y atención al cliente en un solo lugar."
              tags={["WhatsApp", "Canales", "Atención"]}
              badge="Disponible"
              eyebrow="Comunicación"
              ctaLabel="Abrir chats"
              href={routes.conversations}
              tone="chats"
            />
            <WorkspaceServiceCard
              icon={Bot}
              title="Automatizaciones"
              description="Conecta procesos, tareas y flujos inteligentes para ahorrar tiempo en tu operación."
              tags={["Flujos", "Integraciones", "Procesos"]}
              badge="Disponible"
              eyebrow="Automatización"
              ctaLabel="Ver automatizaciones"
              href={routes.automations}
              tone="mixed"
            />
            <WorkspaceServiceCard
              icon={BarChart3}
              title="Reportes"
              description="Consulta ventas, documentos, inventario y resultados de tu negocio."
              tags={["Ventas", "Documentos", "Resultados"]}
              badge="Análisis"
              eyebrow="Visibilidad"
              ctaLabel="Abrir reportes"
              href={routes.reports}
              tone="reports"
            />
          </section>

          <section className="mt-8 flex flex-col items-start justify-between gap-4 rounded-[32px] border border-slate-200 bg-white/80 px-6 py-5 shadow-sm backdrop-blur-sm md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-900">¿Necesitas más detalle operativo?</p>
              <p className="text-sm text-slate-500">
                Revisa tu panel completo para acceder a configuraciones, métricas y herramientas complementarias.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="rounded-full bg-gradient-to-r from-[#588100] to-[#8db600] px-5 text-white shadow-md shadow-[#588100]/20 hover:opacity-95"
              >
                <Link href={routes.facturacion}>
                  Abrir facturación
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-slate-200 bg-white px-5 text-slate-700 hover:border-[#7f00b2]/20 hover:text-[#7f00b2]"
              >
                <Link href="/workspace/panel">
                  Panel completo
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
