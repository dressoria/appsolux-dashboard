"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextWarehouse } from "@/types/erpnext";
import {
  ConfirmModal,
  ErpToast,
  type ErpToastState,
  getFriendlyDeleteError,
} from "./erp-feedback";

type WarehousesTableProps = {
  warehouses: ErpnextWarehouse[];
};

function formatFlag(value: 0 | 1 | undefined) {
  return value === 1 ? "Si" : "No";
}

type DeleteWarehouseResponse = ApiResponse<{
  action: "deleted" | "disabled";
  name?: string;
  warehouse?: ErpnextWarehouse;
}>;
type UpdateWarehouseResponse = ApiResponse<{ warehouse: ErpnextWarehouse }>;

export function WarehousesTable({ warehouses }: WarehousesTableProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ErpToastState>(null);
  const [editingWarehouse, setEditingWarehouse] =
    useState<ErpnextWarehouse | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] =
    useState<ErpnextWarehouse | null>(null);
  const [isPending, setIsPending] = useState(false);
  const usableWarehouses = warehouses
    .filter((warehouse) => warehouse.is_group !== 1)
    .sort((left, right) =>
      left.warehouse_name.localeCompare(right.warehouse_name)
    );

  function showToast(nextToast: Exclude<ErpToastState, null>) {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 3500);
  }

  async function handleEditWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingWarehouse) {
      return;
    }

    setIsPending(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/erpnext/warehouses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingWarehouse.name,
          warehouse_name: String(formData.get("warehouse_name") ?? "").trim(),
          company: editingWarehouse.company,
        }),
      });
      const result = (await response.json()) as UpdateWarehouseResponse;

      if (!result.success) {
        showToast({ type: "error", message: result.error.message });
        return;
      }

      showToast({ type: "success", message: "Bodega actualizada." });
      setEditingWarehouse(null);
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

  async function handleDeleteWarehouse() {
    if (!deletingWarehouse) {
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/erpnext/warehouses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deletingWarehouse.name }),
      });
      const result = (await response.json()) as DeleteWarehouseResponse;

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
            ? "Bodega eliminada correctamente."
            : "La bodega tiene historial y fue deshabilitada.",
      });
      setDeletingWarehouse(null);
      router.refresh();
    } catch (error) {
      showToast({
        type: "error",
        message: getFriendlyDeleteError(
          error instanceof Error ? error.message : "No se pudo procesar."
        ),
      });
    } finally {
      setIsPending(false);
    }
  }
  const groupWarehouses = warehouses
    .filter((warehouse) => warehouse.is_group === 1)
    .sort((left, right) =>
      left.warehouse_name.localeCompare(right.warehouse_name)
    );

  return (
    <Card>
      <ErpToast toast={toast} />
      <CardHeader>
        <CardTitle>Bodegas</CardTitle>
      </CardHeader>
      <CardContent>
        {warehouses.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No hay bodegas disponibles. Configura una bodega para poder agregar
            stock.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Una bodega o ubicacion es el lugar donde guardas productos: local
              principal, sucursal, mostrador o bodega central.
            </p>
            <p className="text-sm text-muted-foreground">
              Las bodegas utilizables reciben stock. Las bodegas de grupo solo
              organizan la estructura y no se usan directamente para movimientos.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Bodega</th>
                    <th className="py-2 pr-4 font-medium">Empresa</th>
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 pr-4 font-medium">Deshabilitada</th>
                    <th className="py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usableWarehouses.map((warehouse) => (
                    <tr key={warehouse.name}>
                      <td className="py-2 pr-4 font-medium">
                        {warehouse.warehouse_name}
                      </td>
                      <td className="py-2 pr-4">{warehouse.company ?? "-"}</td>
                      <td className="py-2 pr-4">
                        {warehouse.is_group === 1 ? "Grupo" : "Bodega usable"}
                      </td>
                      <td className="py-2 pr-4">
                        {formatFlag(warehouse.disabled)}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingWarehouse(warehouse)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeletingWarehouse(warehouse)}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {groupWarehouses.length > 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="bg-muted/40 py-2 pr-4 text-xs font-medium text-muted-foreground"
                      >
                        Bodegas de grupo / estructura
                      </td>
                    </tr>
                  ) : null}
                  {groupWarehouses.map((warehouse) => (
                    <tr key={warehouse.name}>
                      <td className="py-2 pr-4 font-medium">
                        {warehouse.warehouse_name}
                      </td>
                      <td className="py-2 pr-4">{warehouse.company ?? "-"}</td>
                      <td className="py-2 pr-4">Grupo</td>
                      <td className="py-2 pr-4">
                        {formatFlag(warehouse.disabled)}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingWarehouse(warehouse)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeletingWarehouse(warehouse)}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
      {editingWarehouse ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-lg">
            <h2 className="text-lg font-semibold">Editar bodega</h2>
            <form className="mt-4 space-y-3" onSubmit={handleEditWarehouse}>
              <div className="space-y-2">
                <Label htmlFor="edit_warehouse_name">Nombre</Label>
                <Input
                  id="edit_warehouse_name"
                  name="warehouse_name"
                  defaultValue={editingWarehouse.warehouse_name}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingWarehouse(null)}
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
      {deletingWarehouse ? (
        <ConfirmModal
          title="Eliminar bodega"
          description={`Si "${deletingWarehouse.warehouse_name}" tiene movimientos, se intentara deshabilitar en lugar de eliminar.`}
          confirmLabel="Eliminar"
          isPending={isPending}
          onCancel={() => setDeletingWarehouse(null)}
          onConfirm={handleDeleteWarehouse}
        />
      ) : null}
    </Card>
  );
}
