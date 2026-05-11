"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextUom } from "@/types/erpnext";

type Props = {
  uoms: ErpnextUom[];
};

type UomResponse = ApiResponse<{ uom: ErpnextUom }>;
type DeleteResponse = ApiResponse<{
  action: "deleted" | "disabled";
  name?: string;
  uom?: ErpnextUom;
}>;

export function UomManager({ uoms }: Props) {
  const router = useRouter();
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<ErpnextUom | null>(null);
  const [deleting, setDeleting] = useState<ErpnextUom | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const uomName = String(formData.get("uom_name") ?? "").trim();

    if (!uomName) {
      setIsError(true);
      setMessage("El nombre de la unidad es requerido.");
      return;
    }

    setIsPending(true);
    setIsError(false);
    setMessage(null);

    try {
      const response = await fetch("/api/erpnext/uoms", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing?.name,
          uom_name: uomName,
          enabled: true,
        }),
      });
      const result = (await response.json()) as UomResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(editing ? "Unidad actualizada." : "Unidad creada.");
      setEditing(null);
      setOpenCreate(false);
      form.reset();
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar unidad."
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
      const response = await fetch("/api/erpnext/uoms", {
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
          ? "Unidad eliminada."
          : "Unidad desactivada por dependencias."
      );
      setDeleting(null);
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("No se pudo eliminar o desactivar la unidad.");
    } finally {
      setIsPending(false);
    }
  }

  const modal = openCreate || editing;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button onClick={() => setOpenCreate(true)}>Nueva unidad</Button>
        {message ? (
          <p className={isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {message}
          </p>
        ) : null}
      </div>

      {uoms.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No hay unidades registradas en ERPNext.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Unidad</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {uoms.map((uom) => (
                <tr key={uom.name}>
                  <td className="py-2 pr-4 font-medium">
                    {uom.uom_name ?? uom.name}
                  </td>
                  <td className="py-2 pr-4">
                    {uom.enabled === 0 ? "Inactiva" : "Activa"}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => setEditing(uom)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => setDeleting(uom)}
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
          <div className="my-8 w-full max-w-md rounded-xl border bg-card p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editing ? "Editar unidad" : "Nueva unidad"}
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
                  name="uom_name"
                  defaultValue={editing?.uom_name ?? editing?.name ?? ""}
                  required
                />
              </div>
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
            <h2 className="text-lg font-semibold">Eliminar unidad</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Si la unidad está usada por productos o documentos, ERPNext puede
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
