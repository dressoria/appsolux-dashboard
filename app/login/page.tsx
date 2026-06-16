import Link from "next/link";
import { Building2 } from "lucide-react";

import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function getLoginErrorMessage(error: string | undefined) {
  if (error === "membership") {
    return "Tu usuario no tiene una empresa activa asignada.";
  }

  if (error === "login") {
    return "No pudimos iniciar sesion. Intenta de nuevo.";
  }

  if (error) {
    return "Correo o contrasena incorrectos.";
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const message = getLoginErrorMessage(resolvedSearchParams.error);

  return (
    <main className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 flex-col justify-between bg-slate-900 p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-base font-semibold text-white">Suite empresarial</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight text-white">
            Centro de operaciones<br />para tu negocio
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Gestiona inventario, ventas, facturacion electronica y reportes desde un solo lugar.
          </p>
        </div>

        <p className="text-xs text-slate-600">
          Plataforma empresarial &copy; {new Date().getFullYear()}
        </p>
      </div>

      <div className="flex w-full lg:w-1/2 xl:w-3/5 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900">Suite empresarial</span>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Iniciar sesion
            </h2>
            <p className="text-sm text-slate-500">
              Ingresa tus credenciales para acceder al panel.
            </p>
          </div>

          <form action={loginAction} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Correo electronico
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="correo@empresa.com"
                required
                autoComplete="email"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Contrasena
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-10"
              />
            </div>

            {message ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {message}
              </div>
            ) : null}

            <Button type="submit" className="w-full h-10">
              Entrar al panel
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500">
            Aun no tienes cuenta?{" "}
            <Link className="font-medium text-slate-900 underline underline-offset-4" href="/register">
              Solicitar acceso
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
