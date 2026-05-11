"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
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
import type { ApiResponse } from "@/types/api";
import type { ErpnextSupplier } from "@/types/erpnext";

type CreateSupplierResponse = ApiResponse<{ supplier: ErpnextSupplier }>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

export function CreateSupplierForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(form);
    const payload = {
      supplier_name: String(formData.get("supplier_name") ?? "").trim(),
      supplier_type: String(formData.get("supplier_type") ?? "").trim(),
      tax_id: String(formData.get("tax_id") ?? "").trim() || undefined,
      mobile_no: String(formData.get("mobile_no") ?? "").trim() || undefined,
      email_id: String(formData.get("email_id") ?? "").trim() || undefined,
    };

    try {
      const response = await fetch("/api/erpnext/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CreateSupplierResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(`Proveedor creado: ${result.data.supplier.supplier_name}`);
      form.reset();
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear el proveedor"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo proveedor</CardTitle>
        <CardDescription>
          Registra un proveedor para compras, ingresos y cuentas por pagar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier_name">Nombre del proveedor</Label>
              <Input id="supplier_name" name="supplier_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_type">Tipo</Label>
              <select
                id="supplier_type"
                name="supplier_type"
                className={selectClassName}
                defaultValue="Company"
              >
                <option value="Company">Empresa</option>
                <option value="Individual">Persona</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax_id">RUC / Cedula</Label>
              <Input
                id="tax_id"
                name="tax_id"
                placeholder="0000000000001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile_no">Telefono</Label>
              <Input
                id="mobile_no"
                name="mobile_no"
                placeholder="+593 99 000 0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_id">Email</Label>
            <Input
              id="email_id"
              name="email_id"
              type="email"
              placeholder="proveedor@empresa.com"
            />
          </div>

          {message ? (
            <p
              className={
                isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"
              }
            >
              {message}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creando..." : "Crear proveedor"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
