type BasicModuleShellProps = {
  title: string;
  description: string;
  activeHref?: string;
  children: React.ReactNode;
  appName?: string;
  appDescription?: string;
  badge?: string;
  badgeVariant?: string;
  navItems?: Array<{ title: string; href: string }>;
  action?: React.ReactNode;
};

export function BasicModuleShell({
  title,
  description,
  children,
  action,
  activeHref: _activeHref,
  appName: _appName,
  appDescription: _appDescription,
  badge: _badge,
  badgeVariant: _badgeVariant,
  navItems: _navItems,
}: BasicModuleShellProps) {
  return (
    <>
      <div className="border-b border-slate-200 bg-white px-8 py-5 print:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#004080]">{title}</h1>
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </>
  );
}
