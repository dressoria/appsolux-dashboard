"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextSupplier } from "@/types/erpnext";

type Props = {
  supplier: ErpnextSupplier;
};

type SupplierResponse = ApiResponse<{ supplier: ErpnextSupplier }>;
type DeleteSupplierResponse = ApiResponse<{
  action: "deleted" | "disabled";
  name?: string;
  supplier?: ErpnextSupplier;
}>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

export function SupplierActions({ supplier }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [supplierName, setSupplierName] = useState(supplier.supplier_name);
  const [supplierType, setSupplierType] = useState(
    supplier.supplier_type ?? "Company"
  );
  const [taxId, setTaxId] = useState(supplier.tax_id ?? "");
  const [mobileNo, setMobileNo] = useState(supplier.mobile_no ?? "");
  const [emailId, setEmailId] = useState(supplier.email_id ?? "");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function resetEditState() {
    setSupplierName(supplier.supplier_name);
    setSupplierType(supplier.supplier_type ?? "Company");
    setTaxId(supplier.tax_id ?? "");
    setMobileNo(supplier.mobile_no ?? "");
    setEmailId(supplier.email_id ?? "");
    setMessage(null);
    setIsError(false);
  }

  async function handleSave() {
    setMessage(null);
    setIsError(false);

    if (!supplierName.trim()) {
      setIsError(true);
      setMessage("El nombre del proveedor es requerido.");
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch(
        `/api/erpnext/suppliers/${encodeURIComponent(supplier.name)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplier_name: supplierName.trim(),
            supplier_type: supplierType,
            tax_id: taxId.trim() || undefined,
            mobile_no: mobileNo.trim() || undefined,
            email_id: emailId.trim() || undefined,
          }),
        }
      );
      const result = (await response.json()) as SupplierResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage("Proveedor actualizado.");
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo actualizar."
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleDisable() {
    setMessage(null);
    setIsError(false);
    setIsPending(true);

    try {
      const response = await fetch(
        `/api/erpnext/suppliers/${encodeURIComponent(supplier.name)}`,
        { method: "DELETE" }
      );
      const result = (await response.json()) as DeleteSupplierResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        setConfirmingDisable(false);
        return;
      }

      setMessage(
        result.data.action === "deleted"
          ? "Proveedor eliminado."
          : "Proveedor desactivado."
      );
      setConfirmingDisable(false);
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("No se pudo desactivar el proveedor.");
      setConfirmingDisable(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => {
            resetEditState();
            setIsEditing(true);
          }}
          disabled={isPending}
        >
          Editar
        </Button>
        {supplier.disabled !== 1 ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            onClick={() => setConfirmingDisable(true)}
            disabled={isPending}
          >
            Desactivar
          </Button>
        ) : null}
      </div>

      {message ? (
        <p className={isError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {message}
        </p>
      ) : null}

      {confirmingDisable ? (
        <div className="rounded-lg border bg-card p-2 text-xs shadow-sm">
          <p className="mb-2 text-muted-foreground">
            Si tiene transacciones, ERPNext lo mantendra como inactivo.
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              size="xs"
              variant="destructive"
              onClick={handleDisable}
              disabled={isPending}
            >
              Confirmar
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setConfirmingDisable(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {isEditing ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-xl rounded-xl border bg-card p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Editar proveedor</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={isPending}
              >
                Cerrar
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre del proveedor</Label>
                  <Input
                    value={supplierName}
                    onChange={(event) => setSupplierName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select
                    className={selectClassName}
                    value={supplierType}
                    onChange={(event) => setSupplierType(event.target.value)}
                  >
                    <option value="Company">Empresa</option>
                    <option value="Individual">Persona</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>RUC / Cedula</Label>
                  <Input
                    value={taxId}
                    onChange={(event) => setTaxId(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefono</Label>
                  <Input
                    value={mobileNo}
                    onChange={(event) => setMobileNo(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={emailId}
                  onChange={(event) => setEmailId(event.target.value)}
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

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSave} disabled={isPending}>
                  {isPending ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
