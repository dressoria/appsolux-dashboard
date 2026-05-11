"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextItemGroup } from "@/types/erpnext";

type Props = {
  itemGroups: ErpnextItemGroup[];
};

type ItemGroupResponse = ApiResponse<{ itemGroup: ErpnextItemGroup }>;
type DeleteResponse = ApiResponse<{
  action: "deleted" | "disabled";
  name?: string;
  itemGroup?: ErpnextItemGroup;
}>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

export function ItemGroupManager({ itemGroups }: Props) {
  const router = useRouter();
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<ErpnextItemGroup | null>(null);
  const [deleting, setDeleting] = useState<ErpnextItemGroup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const itemGroupName = String(formData.get("item_group_name") ?? "").trim();

    if (!itemGroupName) {
      setIsError(true);
      setMessage("El nombre de la categoria es requerido.");
      return;
    }

    setIsPending(true);
    setIsError(false);
    setMessage(null);

    try {
      const body = {
        name: editing?.name,
        item_group_name: itemGroupName,
        parent_item_group:
          String(formData.get("parent_item_group") ?? "").trim() || undefined,
        is_group: formData.get("is_group") === "on",
      };
      const response = await fetch("/api/erpnext/item-groups", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as ItemGroupResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(editing ? "Categoria actualizada." : "Categoria creada.");
      setEditing(null);
      setOpenCreate(false);
      form.reset();
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar categoria."
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setIsPending(true);
    setIsError(false);
    setMessage(null);

    try {
      const response = await fetch("/api/erpnext/item-groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deleting.name }),
      });
      const result = (await response.json()) as DeleteResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(
        result.data.action === "deleted"
          ? "Categoria eliminada."
          : "Categoria desactivada por dependencias."
      );
      setDeleting(null);
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("No se pudo eliminar o desactivar la categoria.");
    } finally {
      setIsPending(false);
    }
  }

  const modal = openCreate || editing;
  const parentOptions = itemGroups.filter((item) => item.name !== editing?.name);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button onClick={() => setOpenCreate(true)}>Nueva categoria</Button>
        {message ? (
          <p className={isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {message}
          </p>
        ) : null}
      </div>

      {itemGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No hay categorias registradas en ERPNext.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">Padre</th>
                <th className="py-2 pr-4 font-medium">Tipo</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {itemGroups.map((itemGroup) => (
                <tr key={itemGroup.name}>
                  <td className="py-2 pr-4 font-medium">
                    {itemGroup.item_group_name ?? itemGroup.name}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {itemGroup.parent_item_group ?? "-"}
                  </td>
                  <td className="py-2 pr-4">
                    {itemGroup.is_group === 1 ? "Grupo" : "Categoria final"}
                  </td>
                  <td className="py-2 pr-4">
                    {itemGroup.disabled === 1 ? "Inactiva" : "Activa"}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => setEditing(itemGroup)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => setDeleting(itemGroup)}
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

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-lg rounded-xl border bg-card p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editing ? "Editar categoria" : "Nueva categoria"}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpenCreate(false);
                  setEditing(null);
                }}
                disabled={isPending}
              >
                Cerrar
              </Button>
            </div>
            <form className="mt-4 space-y-4" onSubmit={submitForm}>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  name="item_group_name"
                  defaultValue={editing?.item_group_name ?? editing?.name ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria padre</Label>
                <select
                  name="parent_item_group"
                  className={selectClassName}
                  defaultValue={editing?.parent_item_group ?? ""}
                >
                  <option value="">Sin padre / raiz</option>
                  {parentOptions.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.item_group_name ?? item.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_group"
                  defaultChecked={editing?.is_group === 1}
                />
                Es grupo contenedor
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpenCreate(false);
                    setEditing(null);
                  }}
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

      {deleting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-lg">
            <h2 className="text-lg font-semibold">Eliminar categoria</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Si la categoria tiene productos o subcategorias, ERPNext puede
              impedir eliminarla. En ese caso se intentara desactivarla.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleting(null)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? "Procesando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
