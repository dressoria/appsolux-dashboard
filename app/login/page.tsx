import Link from "next/link";

import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    return "No pudimos iniciar sesion.";
  }

  if (error) {
    return "Credenciales incorrectas.";
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const message = getLoginErrorMessage(resolvedSearchParams.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bionvers App</CardTitle>
          <CardDescription>
            Inicia sesion para entrar al panel de gestion de tu negocio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@empresa.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>

            {message ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {message}
              </div>
            ) : null}

            <Button type="submit" className="w-full">
              Entrar
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Aun no tienes cuenta?{" "}
              <Link className="font-medium text-foreground underline" href="/register">
                Crear cuenta
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
