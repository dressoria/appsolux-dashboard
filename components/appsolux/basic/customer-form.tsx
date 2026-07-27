"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CustomerForm({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      address: String(form.get("address") ?? ""),
    };

    try {
      const response = await fetch("/api/basic/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo crear cliente.");
      }

      event.currentTarget.reset();
      setMessage("Cliente creado.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear cliente."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-slate-700">Cliente</Label>
        <Input
          id="name"
          name="name"
          required
          disabled={isLoading || disabled}
          className="h-11 rounded-2xl border-slate-200 bg-white"
          placeholder="Nombre del cliente"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-slate-700">Telefono</Label>
        <Input
          id="phone"
          name="phone"
          disabled={isLoading || disabled}
          className="h-11 rounded-2xl border-slate-200 bg-white"
          placeholder="0999999999"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-slate-700">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          disabled={isLoading || disabled}
          className="h-11 rounded-2xl border-slate-200 bg-white"
          placeholder="cliente@correo.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address" className="text-slate-700">Direccion</Label>
        <Input
          id="address"
          name="address"
          disabled={isLoading || disabled}
          className="h-11 rounded-2xl border-slate-200 bg-white"
          placeholder="Dirección del cliente"
        />
      </div>
      <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-1">
        <Button
          type="submit"
          disabled={isLoading || disabled}
          className="rounded-full bg-[#588100] px-5 text-white hover:bg-[#4b6f00]"
        >
          {isLoading ? "Guardando..." : "Crear cliente"}
        </Button>
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </form>
  );
}
