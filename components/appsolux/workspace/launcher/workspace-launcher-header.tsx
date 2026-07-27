export function WorkspaceLauncherHeader({
  userName,
}: {
  userName: string;
}) {
  return (
    <div className="max-w-3xl space-y-2">
      <h1 className="text-4xl font-black tracking-tight text-[#0d0f12] sm:text-[2.8rem]">
        Bienvenido, {userName}
      </h1>
      <p className="text-base text-slate-600 sm:text-lg">Elige qué quieres hacer hoy.</p>
    </div>
  );
}
