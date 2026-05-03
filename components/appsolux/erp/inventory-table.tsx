"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiResponse } from "@/types/api";
import type { ErpnextBin } from "@/types/erpnext";
import {
  ConfirmModal,
  ErpToast,
  type ErpToastState,
  getFriendlyDeleteError,
} from "./erp-feedback";

type InventoryTableProps = {
  inventory: ErpnextBin[];
};

function formatQuantity(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

type DeleteInventoryResponse = ApiResponse<{
  action: "deleted";
  name: string;
}>;

export function InventoryTable({ inventory }: InventoryTableProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ErpToastState>(null);
  const [deletingBin, setDeletingBin] = useState<ErpnextBin | null>(null);
  const [isPending, setIsPending] = useState(false);

  function showToast(nextToast: Exclude<ErpToastState, null>) {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 3500);
  }

  async function handleDeleteInventoryRow() {
    if (!deletingBin) {
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch("/api/erpnext/inventory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deletingBin.name }),
      });
      const result = (await response.json()) as DeleteInventoryResponse;

      if (!result.success) {
        showToast({
          type: "error",
          message: getFriendlyDeleteError(result.error.message),
        });
        return;
      }

      showToast({
        type: "success",
        message: "Registro de inventario eliminado correctamente.",
      });
      setDeletingBin(null);
      router.refresh();
    } catch (error) {
      showToast({
        type: "error",
        message: getFriendlyDeleteError(
          error instanceof Error
            ? error.message
            : "No se pudo eliminar este registro"
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
        <CardTitle>Inventario / Stock</CardTitle>
      </CardHeader>
      <CardContent>
        {inventory.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Aun no hay stock registrado. Usa Agregar stock para registrar
            unidades en una bodega utilizable.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              El inventario se muestra por producto y por bodega. Si un producto
              esta en varias sucursales o ubicaciones, aparecera separado por
              cada una.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Producto</th>
                    <th className="py-2 pr-4 font-medium">
                      Bodega / ubicacion
                    </th>
                    <th className="py-2 pr-4 font-medium">
                      Stock disponible
                    </th>
                    <th className="py-2 pr-4 font-medium">Reservado</th>
                    <th className="py-2 pr-4 font-medium">Proyectado</th>
                    <th className="py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inventory.map((bin) => (
                    <tr key={bin.name}>
                      <td className="py-2 pr-4 font-medium">{bin.item_code}</td>
                      <td className="py-2 pr-4">{bin.warehouse}</td>
                      <td className="py-2 pr-4">
                        {formatQuantity(bin.actual_qty)}
                      </td>
                      <td className="py-2 pr-4">
                        {formatQuantity(bin.reserved_qty)}
                      </td>
                      <td className="py-2 pr-4">
                        {formatQuantity(bin.projected_qty)}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeletingBin(bin)}
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
      {deletingBin ? (
        <ConfirmModal
          title="Eliminar registro de inventario"
          description={`Eliminar "${deletingBin.item_code}" en "${deletingBin.warehouse}" puede fallar si el ERP protege este historial.`}
          confirmLabel="Eliminar"
          isPending={isPending}
          onCancel={() => setDeletingBin(null)}
          onConfirm={handleDeleteInventoryRow}
        />
      ) : null}
    </Card>
  );
}
