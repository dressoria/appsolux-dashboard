export function WorkspaceLauncherHeader({ tenantName }: { tenantName: string }) {
  return (
    <div className="space-y-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#007BFF]">
        Fase 3
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-[#004080] sm:text-4xl">
        Bienvenido a tu Espacio de Trabajo
      </h1>
      <p className="mx-auto max-w-sm text-base leading-7 text-slate-500">
        Selecciona el servicio con el que deseas trabajar hoy.
      </p>
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-sm text-slate-500 shadow-sm backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {tenantName}
      </div>
    </div>
  );
}
