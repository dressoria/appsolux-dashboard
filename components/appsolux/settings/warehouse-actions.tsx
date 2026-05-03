"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cleanSettingsErrorMessage } from "./settings-error-message";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { ErpnextWarehouse } from "@/types/erpnext";

type WarehouseActionsProps = {
  warehouse: ErpnextWarehouse;
};

type WarehouseActionResponse = ApiResponse<
  | { warehouse: ErpnextWarehouse }
  | { action: "deleted"; name: string }
>;

export function WarehouseActions({ warehouse }: WarehouseActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function runAction(action: "disable" | "delete") {
    setIsPending(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch(
        `/api/erpnext/warehouses/${encodeURIComponent(warehouse.name)}`,
        {
          method: action === "delete" ? "DELETE" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body:
            action === "disable"
              ? JSON.stringify({ disabled: true })
              : undefined,
        }
      );
      const result = (await response.json()) as WarehouseActionResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(cleanSettingsErrorMessage(result.error.message));
        return;
      }

      setMessage(
        action === "delete"
          ? "Bodega eliminada correctamente."
          : "Bodega desactivada correctamente."
      );
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        cleanSettingsErrorMessage(
          error instanceof Error ? error.message : "No se pudo procesar bodega"
        )
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || warehouse.disabled === 1}
          onClick={() => runAction("disable")}
        >
          Desactivar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => runAction("delete")}
        >
          Eliminar
        </Button>
      </div>
      {message ? (
        <p
          className={
            isError
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
