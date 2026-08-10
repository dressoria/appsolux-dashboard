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
}: SriModuleShellProps) {
  return (
    <>
      <div className="border-b border-facturom-primary/10 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-facturom-primary">{appName}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {description || appDescription}
            </p>
          </div>
          {action && (
            <div className="flex shrink-0 flex-wrap gap-2">{action}</div>
          )}
        </div>
      </div>
      <main className="flex-1 overflow-auto bg-facturom-bg p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </>
  );
}
