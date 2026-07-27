export function WorkspaceLauncherHeader({ tenantName }: { tenantName: string }) {
  return (
    <div className="max-w-3xl space-y-5">
      <div className="inline-flex items-center gap-2 rounded-full border border-[#588100]/15 bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#588100] shadow-sm backdrop-blur-sm">
        Portal principal
      </div>
      <div className="space-y-3">
        <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
          Tu centro de trabajo en Facturom
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
          Elige el módulo que necesitas para vender, facturar, atender clientes o automatizar procesos.
          Gestiona tu operación desde un solo lugar.
        </p>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-500 shadow-sm backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-[#8db600]" />
        Empresa activa: {tenantName}
      </div>
    </div>
  );
}
