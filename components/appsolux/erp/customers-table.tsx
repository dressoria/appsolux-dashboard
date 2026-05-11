"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextCustomer, ErpnextTerritory } from "@/types/erpnext";
import { routes } from "@/config/routes";
import {
  ConfirmModal,
  ErpToast,
  type ErpToastState,
  getFriendlyDeleteError,
} from "./erp-feedback";

type CustomersTableProps = {
  customers: ErpnextCustomer[];
  territories: ErpnextTerritory[];
};

type UpdateCustomerResponse = ApiResponse<{ customer: ErpnextCustomer }>;
type DeleteCustomerResponse = ApiResponse<{
  action: "deleted" | "disabled";
  name?: string;
  customer?: ErpnextCustomer;
}>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";


export function CustomersTable({
  customers,
  territories,
}: CustomersTableProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ErpToastState>(null);
  const [editingCustomer, setEditingCustomer] =
    useState<ErpnextCustomer | null>(null);
  const [deletingCustomer, setDeletingCustomer] =
    useState<ErpnextCustomer | null>(null);
  const [isPending, setIsPending] = useState(false);

  function showToast(nextToast: Exclude<ErpToastState, null>) {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 3500);
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCustomer) {
      return;
    }

    setIsPending(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/erpnext/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingCustomer.name,
          customer_name: String(formData.get("customer_name") ?? "").trim(),
          customer_type: String(formData.get("customer_type") ?? "").trim(),
          territory: String(formData.get("territory") ?? "").trim(),
          tax_id: String(formData.get("tax_id") ?? "").trim() || undefined,
          mobile_no: String(formData.get("mobile_no") ?? "").trim() || undefined,
        }),
      });
      const result = (await response.json()) as UpdateCustomerResponse;

      if (!result.success) {
        showToast({ type: "error", message: result.error.message });
        return;
      }

      showToast({ type: "success", message: "Cliente actualizado." });
      setEditingCustomer(null);
      router.refresh();
    } catch (error) {
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "No se pudo actualizar.",
      });
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete() {
    if (!deletingCustomer) {
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/erpnext/customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deletingCustomer.name }),
      });
      const result = (await response.json()) as DeleteCustomerResponse;

      if (!result.success) {
        showToast({
          type: "error",
          message: getFriendlyDeleteError(result.error.message),
        });
        return;
      }

      showToast({
        type: "success",
        message:
          result.data.action === "deleted"
            ? "Cliente eliminado."
            : "El cliente fue deshabilitado.",
      });
      setDeletingCustomer(null);
      router.refresh();
    } catch (error) {
      showToast({
        type: "error",
        message: getFriendlyDeleteError(
          error instanceof Error ? error.message : "No se pudo eliminar."
        ),
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <ErpToast toast={toast} />
      <CardHeader>
        <CardTitle>Clientes</CardTitle>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No hay clientes registrados. Crea el primer cliente desde el
            formulario.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Cliente</th>
                  <th className="py-2 pr-4 font-medium">Cedula / RUC</th>
                  <th className="py-2 pr-4 font-medium">Telefono</th>
                  <th className="py-2 pr-4 font-medium">Tipo</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map((customer) => (
                  <tr key={customer.name}>
                    <td className="py-2 pr-4 font-medium">
                      {customer.customer_name}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {customer.tax_id ?? "-"}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {customer.mobile_no ?? "-"}
                    </td>
                    <td className="py-2 pr-4">
                      {customer.customer_type ?? "-"}
                    </td>
                    <td className="py-2 pr-4">
                      {customer.disabled === 1 ? (
                        <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-500">
                          Inactivo
                        </span>
                      ) : (
                        <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                          Activo
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`${routes.erpCustomers}/${encodeURIComponent(customer.name)}`}
                          >
                            Historial
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCustomer(customer)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeletingCustomer(customer)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {editingCustomer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-lg">
            <h2 className="text-lg font-semibold">Editar cliente</h2>
            <form className="mt-4 space-y-3" onSubmit={handleEdit}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit_customer_name">Nombre</Label>
                  <Input
                    id="edit_customer_name"
                    name="customer_name"
                    defaultValue={editingCustomer.customer_name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_tax_id">Cedula / RUC</Label>
                  <Input
                    id="edit_tax_id"
                    name="tax_id"
                    defaultValue={editingCustomer.tax_id ?? ""}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit_mobile_no">Telefono</Label>
                  <Input
                    id="edit_mobile_no"
                    name="mobile_no"
                    defaultValue={editingCustomer.mobile_no ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_customer_type">Tipo</Label>
                  <select
                    id="edit_customer_type"
                    name="customer_type"
                    className={selectClassName}
                    defaultValue={editingCustomer.customer_type ?? "Individual"}
                  >
                    <option value="Individual">Individual</option>
                    <option value="Company">Empresa</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_territory">Ubicacion / territorio</Label>
                <select
                  id="edit_territory"
                  name="territory"
                  className={selectClassName}
                  defaultValue={editingCustomer.territory ?? ""}
                  required
                >
                  <option value="">Selecciona un territorio</option>
                  {territories.map((territory) => (
                    <option key={territory.name} value={territory.name}>
                      {territory.territory_name ?? territory.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingCustomer(null)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deletingCustomer ? (
        <ConfirmModal
          title="Eliminar cliente"
          description={`Si "${deletingCustomer.customer_name}" ya tiene movimientos, se intentara deshabilitar en lugar de eliminar.`}
          confirmLabel="Eliminar"
          isPending={isPending}
          onCancel={() => setDeletingCustomer(null)}
          onConfirm={handleDelete}
        />
      ) : null}
    </Card>
  );
}
