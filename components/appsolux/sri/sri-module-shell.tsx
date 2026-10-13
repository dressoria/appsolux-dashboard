import Link from "next/link";
import { SRI_CONFIGURATION_NAVIGATION } from "@/config/sri-tax-navigation";

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
  activeHref,
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
      <nav aria-label="Configuración SRI" className="flex flex-wrap gap-3 border-b bg-white px-4 py-3 text-sm sm:px-6 lg:px-8">
        <Link href="/facturacion/configuration" className="font-medium text-blue-600">Empresa → Configuración</Link>
        {SRI_CONFIGURATION_NAVIGATION.map((item) => <Link key={item.href} href={item.href} aria-current={item.href === activeHref ? "page" : undefined} className="text-slate-600 hover:text-blue-600">{item.title}</Link>)}
      </nav>
      <main className="flex-1 overflow-auto bg-facturom-bg p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </>
  );
}
