"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextItem, ErpnextItemGroup, ErpnextUom } from "@/types/erpnext";
import {
  ConfirmModal,
  ErpToast,
  type ErpToastState,
  getFriendlyDeleteError,
} from "./erp-feedback";

type ItemsTableProps = {
  items: ErpnextItem[];
  itemGroups: ErpnextItemGroup[];
  uoms: ErpnextUom[];
};

type UpdateItemResponse = ApiResponse<{ item: ErpnextItem }>;
type DeleteItemResponse = ApiResponse<{
  action: "deleted" | "disabled";
  name?: string;
  item?: ErpnextItem;
}>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function formatFlag(value: 0 | 1 | undefined) {
  return value === 1 ? "Si" : "No";
}

export function ItemsTable({ items, itemGroups, uoms }: ItemsTableProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ErpToastState>(null);
  const [editingItem, setEditingItem] = useState<ErpnextItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ErpnextItem | null>(null);
  const [isPending, setIsPending] = useState(false);

  function showToast(nextToast: Exclude<ErpToastState, null>) {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 3500);
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingItem) {
      return;
    }

    setIsPending(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/erpnext/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingItem.name,
          item_name: String(formData.get("item_name") ?? "").trim(),
          item_group: String(formData.get("item_group") ?? "").trim(),
          stock_uom: String(formData.get("stock_uom") ?? "").trim(),
          is_stock_item: formData.get("is_stock_item") === "on",
        }),
      });
      const result = (await response.json()) as UpdateItemResponse;

      if (!result.success) {
        showToast({ type: "error", message: result.error.message });
        return;
      }

      showToast({ type: "success", message: "Producto actualizado." });
      setEditingItem(null);
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
    if (!deletingItem) {
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/erpnext/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deletingItem.name }),
      });
      const result = (await response.json()) as DeleteItemResponse;

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
            ? "Producto eliminado."
            : "El producto fue deshabilitado.",
      });
      setDeletingItem(null);
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
        <CardTitle>Productos</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No hay productos registrados. Crea el primer producto desde el
            formulario.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Codigo</th>
                  <th className="py-2 pr-4 font-medium">Nombre</th>
                  <th className="py-2 pr-4 font-medium">Unidad</th>
                  <th className="py-2 pr-4 font-medium">Stock</th>
                  <th className="py-2 pr-4 font-medium">Deshabilitado</th>
                  <th className="py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.name}>
                    <td className="py-2 pr-4 font-medium">{item.item_code}</td>
                    <td className="py-2 pr-4">{item.item_name}</td>
                    <td className="py-2 pr-4">{item.stock_uom ?? "-"}</td>
                    <td className="py-2 pr-4">
                      {formatFlag(item.is_stock_item)}
                    </td>
                    <td className="py-2 pr-4">{formatFlag(item.disabled)}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeletingItem(item)}
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

      {editingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-lg">
            <h2 className="text-lg font-semibold">Editar producto</h2>
            <form className="mt-4 space-y-3" onSubmit={handleEdit}>
              <div className="space-y-2">
                <Label htmlFor="edit_item_name">Nombre</Label>
                <Input
                  id="edit_item_name"
                  name="item_name"
                  defaultValue={editingItem.item_name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_item_group">Categoria</Label>
                <select
                  id="edit_item_group"
                  name="item_group"
                  className={selectClassName}
                  defaultValue={editingItem.item_group ?? ""}
                  required
                >
                  <option value="">Selecciona una categoria</option>
                  {itemGroups.map((group) => (
                    <option key={group.name} value={group.name}>
                      {group.item_group_name ?? group.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_stock_uom">Unidad</Label>
                <select
                  id="edit_stock_uom"
                  name="stock_uom"
                  className={selectClassName}
                  defaultValue={editingItem.stock_uom ?? ""}
                  required
                >
                  <option value="">Selecciona una unidad</option>
                  {uoms.map((uom) => (
                    <option key={uom.name} value={uom.name}>
                      {uom.uom_name ?? uom.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_stock_item"
                  defaultChecked={editingItem.is_stock_item !== 0}
                  className="size-4"
                />
                Maneja inventario
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingItem(null)}
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

      {deletingItem ? (
        <ConfirmModal
          title="Eliminar producto"
          description={`Si "${deletingItem.item_name}" ya tiene movimientos, se intentara deshabilitar en lugar de eliminar.`}
          confirmLabel="Eliminar"
          isPending={isPending}
          onCancel={() => setDeletingItem(null)}
          onConfirm={handleDelete}
        />
      ) : null}
    </Card>
  );
}
