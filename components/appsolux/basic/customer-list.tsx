"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  balance: string;
};

export function CustomerList({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function updateCustomer(event: FormEvent<HTMLFormElement>, customerId: string) {
    event.preventDefault();
    setMessage("");
    setError("");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/basic/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          email: String(form.get("email") ?? ""),
          address: String(form.get("address") ?? ""),
        }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo actualizar cliente.");
      }

      setEditingId("");
      setMessage("Cliente actualizado.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo actualizar cliente."
      );
    }
  }

  return (
    <div className="space-y-3">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {customers.map((customer) => {
        const isEditing = editingId === customer.id;
        const balance = Number(customer.balance);

        return (
          <div key={customer.id} className="space-y-3 rounded-[22px] border border-slate-200 bg-white p-4 text-sm shadow-sm transition-colors hover:border-[#588100]/30 hover:shadow-[0_14px_40px_rgba(88,129,0,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <p className="text-base font-semibold text-slate-950">{customer.name}</p>
                <p className="text-sm text-slate-500">
                  {customer.phone || "Sin telefono"}
                  {customer.email ? ` · ${customer.email}` : ""}
                </p>
                <p className="text-xs text-slate-400">
                  {customer.address || "Sin direccion"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    balance > 0
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  Saldo ${balance.toFixed(2)}
                </span>
                <Button asChild variant="outline" size="sm" className="rounded-full border-slate-200">
                  <Link href={`/basic/customers/${customer.id}`}>Ver detalle</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-slate-200 hover:border-[#588100]/30 hover:text-[#588100]"
                  onClick={() => setEditingId(isEditing ? "" : customer.id)}
                >
                  Editar
                </Button>
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={(event) => updateCustomer(event, customer.id)} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Nombre</Label>
                  <Input name="name" defaultValue={customer.name} required className="h-10 rounded-xl border-slate-200 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Telefono</Label>
                  <Input name="phone" defaultValue={customer.phone ?? ""} className="h-10 rounded-xl border-slate-200 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Correo</Label>
                  <Input name="email" type="email" defaultValue={customer.email ?? ""} className="h-10 rounded-xl border-slate-200 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Direccion</Label>
                  <Input name="address" defaultValue={customer.address ?? ""} className="h-10 rounded-xl border-slate-200 bg-white" />
                </div>
                <div className="md:col-span-4 flex items-center gap-3">
                  <Button type="submit" className="rounded-full bg-[#588100] px-5 text-white hover:bg-[#4b6f00]">
                    Guardar cambios
                  </Button>
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => setEditingId("")}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}

      {customers.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No hay clientes para mostrar.
        </div>
      ) : null}
    </div>
  );
}
