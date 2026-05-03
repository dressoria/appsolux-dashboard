"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextCompany, ErpnextWarehouse } from "@/types/erpnext";

type CreateWarehouseDialogProps = {
  companies: ErpnextCompany[];
};

type CreateWarehouseResponse = ApiResponse<{ warehouse: ErpnextWarehouse }>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

export function CreateWarehouseDialog({
  companies,
}: CreateWarehouseDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);
    const payload = {
      warehouse_name: String(formData.get("warehouse_name") ?? "").trim(),
      company: String(formData.get("company") ?? "").trim() || undefined,
    };

    try {
      const response = await fetch("/api/erpnext/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CreateWarehouseResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(`Bodega creada: ${result.data.warehouse.warehouse_name}`);
      router.refresh();
      window.setTimeout(() => setIsOpen(false), 700);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear la bodega"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setIsOpen(true)}>
        Nueva Bodega
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-lg">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Nueva Bodega</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Crea una ubicacion donde guardar productos, como local,
                sucursal, mostrador o bodega central.
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="warehouse_name">Nombre</Label>
                <Input id="warehouse_name" name="warehouse_name" required />
              </div>

              {companies.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <select
                    id="company"
                    name="company"
                    className={selectClassName}
                    defaultValue={companies[0]?.name ?? ""}
                  >
                    {companies.map((company) => (
                      <option key={company.name} value={company.name}>
                        {company.company_name ?? company.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

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

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creando..." : "Crear bodega"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
