"use client";

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
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {customers.map((customer) => {
        const isEditing = editingId === customer.id;
        const balance = Number(customer.balance);

        return (
          <div key={customer.id} className="space-y-3 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{customer.name}</p>
                <p className="text-muted-foreground">
                  {customer.phone || "Sin telefono"}
                  {customer.email ? ` · ${customer.email}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {customer.address || "Sin direccion"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-1 text-xs ${
                    balance > 0
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  Saldo ${balance.toFixed(2)}
                </span>
                <Button type="button" variant="outline" onClick={() => setEditingId(isEditing ? "" : customer.id)}>
                  Editar
                </Button>
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={(event) => updateCustomer(event, customer.id)} className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label>Nombre</Label>
                  <Input name="name" defaultValue={customer.name} required />
                </div>
                <div className="space-y-1">
                  <Label>Telefono</Label>
                  <Input name="phone" defaultValue={customer.phone ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Correo</Label>
                  <Input name="email" type="email" defaultValue={customer.email ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Direccion</Label>
                  <Input name="address" defaultValue={customer.address ?? ""} />
                </div>
                <div className="md:col-span-4">
                  <Button type="submit">Guardar cambios</Button>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}

      {customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay clientes para mostrar.</p>
      ) : null}
    </div>
  );
}
