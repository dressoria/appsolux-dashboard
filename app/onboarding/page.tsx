import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/appsolux/layout/logout-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";
import { requireAppUser } from "@/lib/auth/require-app-user";
import { bootstrapAuthenticatedUserTenant } from "@/lib/onboarding/bootstrap-authenticated-user";

async function createTenantAction(formData: FormData) {
  "use server";

  const user = await requireAppUser();

  if (user.tenant?.id) {
    redirect(routes.workspace);
  }

  const companyName = String(formData.get("company_name") ?? "").trim();
  const ruc = String(formData.get("ruc") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const businessType = String(formData.get("business_type") ?? "").trim();

  if (!companyName) {
    throw new Error("El nombre de empresa es requerido.");
  }

  await bootstrapAuthenticatedUserTenant({
    userId: user.id,
    email: user.email,
    name: user.name,
    companyName,
    ruc: ruc || undefined,
    phone: phone || undefined,
    businessType: businessType || undefined,
  });

  redirect(routes.workspace);
}

export default async function OnboardingPage() {
  const user = await requireAppUser();

  if (user.tenant?.id) {
    redirect(routes.workspace);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-sky-50 px-4 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <Link href={routes.home} className="text-sm font-semibold text-slate-700 hover:text-slate-900">
            Facturom
          </Link>
          <LogoutButton />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-3xl font-black tracking-tight text-slate-950">
                Bienvenido a Facturom
              </CardTitle>
              <p className="text-sm text-slate-500">
                Para continuar, crea tu empresa o solicita acceso a una empresa existente.
              </p>
            </CardHeader>
            <CardContent>
              <form action={createTenantAction} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Nombre de empresa o negocio</Label>
                  <Input id="company_name" name="company_name" placeholder="Ej. Comercial Andrade" required />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ruc">RUC</Label>
                    <Input id="ruc" name="ruc" placeholder="Opcional" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" name="phone" placeholder="Opcional" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business_type">Tipo de negocio</Label>
                  <Input id="business_type" name="business_type" placeholder="Opcional" />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" className="bg-facturom-primary hover:bg-facturom-primary-soft text-white">
                    Crear empresa
                  </Button>
                  <Button asChild type="button" variant="outline">
                    <Link href={`${routes.contacto}?servicio=acceso-empresa`}>Contactar soporte</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-black text-slate-950">Acceso seguro por tenant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p>
                Tu cuenta autenticada aún no está vinculada a una empresa. Por seguridad, no te mostramos módulos,
                documentos, productos ni datos de otro tenant.
              </p>
              <ul className="space-y-2">
                <li>Crear empresa: genera tu tenant propio y te asigna como owner.</li>
                <li>Contactar soporte: si debes entrar a una empresa existente, te ayudamos a vincularte correctamente.</li>
                <li>Cerrar sesión: sales sin tocar ningún workspace interno.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
