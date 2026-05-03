"use client";

import { FormEvent, useState } from "react";
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
import type { ErpnextCustomer, ErpnextTerritory } from "@/types/erpnext";

type CreateCustomerFormProps = {
  territories: ErpnextTerritory[];
};

type CreateCustomerResponse = ApiResponse<{ customer: ErpnextCustomer }>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function getTerritoryLabel(territory: ErpnextTerritory) {
  return territory.territory_name ?? territory.name;
}

export function CreateCustomerForm({ territories }: CreateCustomerFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canCreateCustomer = territories.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);
    const payload = {
      customer_name: String(formData.get("customer_name") ?? "").trim(),
      customer_type: String(formData.get("customer_type") ?? "").trim(),
      territory: String(formData.get("territory") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/erpnext/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CreateCustomerResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(`Cliente creado: ${result.data.customer.customer_name}`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear el cliente"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear cliente</CardTitle>
        <CardDescription>
          Registra un cliente real en ERPNext para ventas, seguimiento y
          facturacion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!canCreateCustomer ? (
          <div className="mb-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Primero configura territorios en ERPNext.
          </div>
        ) : null}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="customer_name">Nombre del cliente</Label>
            <Input
              id="customer_name"
              name="customer_name"
              disabled={!canCreateCustomer}
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer_type">Tipo</Label>
              <select
                id="customer_type"
                name="customer_type"
                className={selectClassName}
                disabled={!canCreateCustomer}
                defaultValue="Individual"
              >
                <option value="Individual">Individual</option>
                <option value="Company">Empresa</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="territory">Territorio</Label>
              <select
                id="territory"
                name="territory"
                className={selectClassName}
                disabled={!canCreateCustomer}
                required
              >
                <option value="">Selecciona un territorio</option>
                {territories.map((territory) => (
                  <option key={territory.name} value={territory.name}>
                    {getTerritoryLabel(territory)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {message ? (
            <p
              className={
                isError
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {message}
            </p>
          ) : null}

          <Button type="submit" disabled={!canCreateCustomer || isSubmitting}>
            {isSubmitting ? "Creando..." : "Crear cliente"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
