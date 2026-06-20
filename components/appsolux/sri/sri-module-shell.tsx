type SriModuleShellProps = {
  title: string;
  description: string;
  activeHref: string;
  children: React.ReactNode;
  appName?: string;
  appDescription?: string;
  badge?: string;
  badgeVariant?: string;
  action?: React.ReactNode;
};

export function SriModuleShell({
  description,
  children,
  action,
  appName = "Configuración SRI",
  appDescription = "Centro de configuración, firma, secuenciales, ambiente y monitoreo tributario.",
  activeHref: _activeHref,
  title: _title,
  badge: _badge,
  badgeVariant: _badgeVariant,
}: SriModuleShellProps) {
  return (
    <>
      <div className="border-b border-slate-200 bg-white px-8 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#004080]">{appName}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {description || appDescription}
            </p>
          </div>
          {action && (
            <div className="flex shrink-0 flex-wrap gap-2">{action}</div>
          )}
        </div>
      </div>
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </>
  );
}
