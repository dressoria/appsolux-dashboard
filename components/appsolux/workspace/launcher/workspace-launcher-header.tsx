export function WorkspaceLauncherHeader({
  userName,
  tenantName,
}: {
  userName: string;
  tenantName: string;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#588100]">
        Facturom
      </p>
      <div className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-[#0d0f12] sm:text-5xl">
          Bienvenido, {userName}
        </h1>
        <p className="text-base text-slate-600 sm:text-lg">Elige qué quieres hacer hoy.</p>
      </div>
      <p className="text-sm text-slate-500">Empresa: {tenantName}</p>
    </div>
  );
}
