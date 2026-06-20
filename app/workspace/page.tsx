import Link from "next/link";
import { MessageCircle, ReceiptText, Zap } from "lucide-react";

import { ClerkUserMenu } from "@/components/appsolux/layout/clerk-user-menu";
import { WorkspaceLauncherHeader } from "@/components/appsolux/workspace/launcher/workspace-launcher-header";
import { WorkspaceServiceCard } from "@/components/appsolux/workspace/launcher/workspace-service-card";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { isClerkAuth } from "@/lib/auth/provider";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

export default async function WorkspacePage() {
  const { user } = await requireDashboardSession();
  const clerkActive = isClerkAuth();

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-sky-50">
      {/* Top-right: user identity + Clerk UserButton */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-end gap-3 px-6 py-4">
        <span className="hidden text-xs text-slate-400 sm:block">{user.name}</span>
        <div className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-500 backdrop-blur-sm">
          {user.tenant.name}
        </div>
        {clerkActive && <ClerkUserMenu />}
      </header>

      {/* Centered launcher */}
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
        <div className="mx-auto w-full max-w-5xl">
          <WorkspaceLauncherHeader tenantName={user.tenant.name} />

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            <WorkspaceServiceCard
              icon={ReceiptText}
              title="Facturación"
              description="Gestiona ventas, clientes, inventario, comprobantes y reportes financieros."
              detail="Ventas · Inventario · SRI · Reportes"
              href={routes.sales}
            />
            <WorkspaceServiceCard
              icon={MessageCircle}
              title="Chats"
              description="Centraliza conversaciones, canales y atención al cliente."
              detail="Conversaciones · Canales · WhatsApp"
              href={routes.conversations}
            />
            <WorkspaceServiceCard
              icon={Zap}
              title="Automatizaciones"
              description="Conecta procesos, tareas y flujos inteligentes para tu operación."
              detail="Flujos · Integraciones · Procesos"
              href={routes.automations}
            />
          </div>

          <div className="mt-12 flex flex-col items-center gap-3">
            <Button
              asChild
              variant="outline"
              className="rounded-full border-slate-200 px-8 text-slate-600 shadow-sm hover:border-[#004080]/30 hover:text-[#004080]"
            >
              <Link href="/workspace/panel">Panel Completo</Link>
            </Button>
            <p className="text-xs text-slate-400">
              Cargando tus servicios corporativos...
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
