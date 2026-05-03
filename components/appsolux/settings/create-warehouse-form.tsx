"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { cleanSettingsErrorMessage } from "./settings-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextCompany, ErpnextWarehouse } from "@/types/erpnext";

type CreateWarehouseFormProps = {
  companies: ErpnextCompany[];
  parentWarehouses: ErpnextWarehouse[];
  defaultCompany?: string;
};

type WarehouseResponse = ApiResponse<{
  warehouse: ErpnextWarehouse;
}>;

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

export function CreateWarehouseForm({
  companies,
  parentWarehouses,
  defaultCompany,
}: CreateWarehouseFormProps) {
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

    try {
      const response = await fetch("/api/erpnext/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_name: String(formData.get("warehouse_name") ?? "").trim(),
          company: String(formData.get("company") ?? "").trim(),
          parent_warehouse:
            String(formData.get("parent_warehouse") ?? "").trim() || undefined,
        }),
      });
      const result = (await response.json()) as WarehouseResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(cleanSettingsErrorMessage(result.error.message));
        return;
      }

      setMessage("Bodega creada correctamente.");
      form.reset();
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        cleanSettingsErrorMessage(
          error instanceof Error ? error.message : "No se pudo crear la bodega"
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-3 rounded-lg border bg-background p-3" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-sm font-semibold">Crear bodega / ubicacion</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea una ubicacion real para local, sucursal, mostrador o bodega
          central.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="warehouse_name">Nombre</Label>
          <Input id="warehouse_name" name="warehouse_name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="warehouse_company">Empresa</Label>
          <select
            id="warehouse_company"
            name="company"
            className={selectClassName}
            defaultValue={defaultCompany ?? ""}
            required
          >
            <option value="">Selecciona empresa</option>
            {companies.map((company) => (
              <option key={company.name} value={company.name}>
                {company.company_name ?? company.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="parent_warehouse">Bodega padre</Label>
          <select
            id="parent_warehouse"
            name="parent_warehouse"
            className={selectClassName}
          >
            <option value="">Sin bodega padre</option>
            {parentWarehouses.map((warehouse) => (
              <option key={warehouse.name} value={warehouse.name}>
                {warehouse.warehouse_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message ? (
        <div
          className={
            isError
              ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              : "rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
          }
        >
          {message}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creando..." : "Crear bodega"}
      </Button>
    </form>
  );
}
