"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { OnboardingRegisterResponse, OnboardingStatus } from "@/lib/onboarding/types";

type RegisterStatus = "idle" | OnboardingStatus;
type OnboardingApiResponse = ApiResponse<OnboardingRegisterResponse>;

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function getStatusMessage(status: RegisterStatus) {
  if (status === "pending") {
    return "Registro recibido.";
  }

  if (status === "provisioning") {
    return "Estamos configurando tu espacio de trabajo.";
  }

  if (status === "ready") {
    return "Tu entorno esta listo. Te llevaremos al dashboard.";
  }

  if (status === "failed") {
    return "No pudimos completar el registro.";
  }

  return "";
}

export default function RegisterPage() {
  const router = useRouter();
  const [status, setStatus] = useState<RegisterStatus>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("pending");
    setMessage("Registro recibido. Validando datos...");

    const formData = new FormData(event.currentTarget);
    const payload = {
      user_name: String(formData.get("user_name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      password_confirm: String(formData.get("password_confirm") ?? ""),
      company_name: String(formData.get("company_name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      business_type: String(formData.get("business_type") ?? ""),
      country: String(formData.get("country") ?? ""),
      base_currency: String(formData.get("base_currency") ?? ""),
      initial_plan: String(formData.get("initial_plan") ?? ""),
      source: "register_page",
    };

    try {
      setStatus("provisioning");
      setMessage("Configuracion en proceso...");

      const response = await fetch("/api/onboarding/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as OnboardingApiResponse;

      if (!result.success) {
        throw new Error(
          result.error.message || "No se pudo completar el registro"
        );
      }

      setStatus(result.data.status);
      setMessage(result.data.message || getStatusMessage(result.data.status));

      setTimeout(() => {
        router.push(result.data.redirect_to ?? "/dashboard");
      }, 1000);
    } catch (error) {
      setStatus("failed");
      setMessage(
        error instanceof Error
          ? error.message
          : "Ocurrio un error inesperado"
      );
    }
  }

  const isLoading = status === "pending" || status === "provisioning";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Crear cuenta en Appsolux</CardTitle>
          <CardDescription>
            Registra tu empresa para preparar tu dashboard, canales,
            inventario, ventas y automatizaciones.
          </CardDescription>
          <CardAction>
            <span className="text-xs text-muted-foreground">B2B SaaS</span>
          </CardAction>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user_name">Nombre</Label>
                <Input
                  id="user_name"
                  name="user_name"
                  placeholder="Andres Soria"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="andres@appsolux.com"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name">Empresa</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  placeholder="Milusk"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contrasena</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  placeholder="Minimo 8 caracteres"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password_confirm">Confirmar contrasena</Label>
                <Input
                  id="password_confirm"
                  name="password_confirm"
                  type="password"
                  minLength={8}
                  placeholder="Repite tu contrasena"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+593..."
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_type">Tipo de negocio</Label>
                <Input
                  id="business_type"
                  name="business_type"
                  placeholder="Tienda, servicios, ecommerce..."
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Pais</Label>
                <Input
                  id="country"
                  name="country"
                  placeholder="Ecuador"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_currency">Moneda base</Label>
                <select
                  id="base_currency"
                  name="base_currency"
                  className={selectClassName}
                  defaultValue="USD"
                  disabled={isLoading}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="">Definir despues</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initial_plan">Plan inicial</Label>
                <select
                  id="initial_plan"
                  name="initial_plan"
                  className={selectClassName}
                  defaultValue="starter"
                  disabled={isLoading}
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Preparando cuenta..." : "Crear cuenta"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Ya tienes cuenta?{" "}
              <Link className="font-medium text-foreground underline" href="/login">
                Inicia sesion
              </Link>
            </p>

            {message ? (
              <div
                className={
                  status === "failed"
                    ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                    : "rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
                }
              >
                <p className="font-medium">{getStatusMessage(status)}</p>
                <p className="mt-1">{message}</p>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
