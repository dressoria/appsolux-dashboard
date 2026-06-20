import Link from "next/link";
import { BarChart3, Building2, MessageSquareText } from "lucide-react";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { WorkspaceLauncherHeader } from "@/components/appsolux/workspace/launcher/workspace-launcher-header";
import { WorkspaceServiceCard } from "@/components/appsolux/workspace/launcher/workspace-service-card";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function WorkspacePage() {
  const user = await getCurrentUser();
  const tenantName = user?.tenant?.name ?? "Tu espacio";

  return (
    <DashboardShell
      mainClassName="px-6 py-20 bg-gradient-to-br from-slate-100 via-white to-sky-50"
      contentClassName="mx-auto max-w-5xl"
    >
      <div className="flex flex-col items-center gap-16">
        <WorkspaceLauncherHeader tenantName={tenantName} />

        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
          <WorkspaceServiceCard
            icon={Building2}
            title="Servicio ERP"
            description="Módulo central de gestión empresarial. Acceso a inventario, ventas, SRI y más."
            detail="Inventario · Ventas · Facturación · SRI"
            href={routes.erp}
          />
          <WorkspaceServiceCard
            icon={MessageSquareText}
            title="Servicio CHAT"
            description="Plataforma de comunicación y atención. Acceso a conversaciones, canales y mensajería."
            detail="Conversaciones · Canales · WhatsApp"
            href={routes.conversations}
          />
          <WorkspaceServiceCard
            icon={BarChart3}
            title="Módulo de Reportería"
            description="Analítica y reportes de rendimiento. Seguimiento de ventas, stock y operación."
            detail="Reportes · Estadísticas · Exportar"
            href={routes.reports}
          />
        </div>

        <div className="flex flex-col items-center gap-3">
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
    </DashboardShell>
  );
}
