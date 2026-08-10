import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, LockKeyhole } from "lucide-react";

import { LogoutButton } from "@/components/appsolux/layout/logout-button";
import { OnboardingBusinessForm } from "@/components/appsolux/onboarding/onboarding-business-form";
import { FacturomBrand } from "@/components/public/facturom-brand";
import { routes } from "@/config/routes";
import { requireAppUser } from "@/lib/auth/require-app-user";

export default async function OnboardingPage() {
  const user = await requireAppUser();

  if (user.tenant?.id) redirect(routes.workspace);

  return (
    <main className="min-h-screen bg-facturom-bg text-facturom-text">
      <header className="bg-facturom-primary-dark text-white shadow-[0_10px_30px_rgba(42,6,72,0.18)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href={routes.home} aria-label="Ir al inicio de Facturom">
            <FacturomBrand variant="white" imageClassName="h-9 w-auto sm:h-10" />
          </Link>
          <LogoutButton inverted />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="mb-6 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#eee5f7] px-3 py-1 text-xs font-bold text-facturom-primary">
            <span className="h-2 w-2 rounded-full bg-facturom-accent" />
            Configuración inicial
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Configura tu negocio</h1>
          <p className="mt-2 text-base text-slate-600 sm:text-lg">Solo te tomará un minuto. Podrás completar la configuración fiscal después.</p>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="rounded-[28px] bg-white p-5 shadow-[0_16px_42px_rgba(59,10,103,0.09)] sm:p-7">
            <OnboardingBusinessForm defaultEmail={user.email} />
          </section>

          <aside className="rounded-[24px] bg-facturom-primary p-5 text-white shadow-[0_14px_34px_rgba(59,10,103,0.16)] lg:sticky lg:top-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 text-facturom-yellow">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-xl font-black">Tu espacio será privado</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">Tu información comienza limpia y permanece separada de otros negocios.</p>
            <ul className="mt-5 space-y-3 text-sm">
              {["Empresa independiente", "Datos separados", "Tú serás propietario"].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/12 text-facturom-yellow"><Check className="h-3.5 w-3.5" /></span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-white/12 pt-5">
              <p className="text-xs text-white/55">¿Ya perteneces a una empresa?</p>
              <Link href={`${routes.contacto}?servicio=acceso-empresa`} className="mt-1 inline-flex text-sm font-bold text-white underline decoration-white/35 underline-offset-4 hover:decoration-white">
                Solicitar acceso
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
