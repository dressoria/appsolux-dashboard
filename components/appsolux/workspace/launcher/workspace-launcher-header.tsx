export function WorkspaceLauncherHeader({
  userName,
}: {
  userName: string;
}) {
  return (
    <div className="relative max-w-3xl space-y-1.5">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-facturom-yellow">Tu espacio de trabajo</p>
      <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
        Hola, {userName} <span aria-hidden="true">👋</span>
      </h1>
      <p className="text-base text-white/72 sm:text-lg">¿Qué quieres hacer hoy?</p>
    </div>
  );
}
