"use client";

import { Button } from "@/components/ui/button";

export type ErpToastState = {
  type: "success" | "error";
  message: string;
} | null;

export function ErpToast({ toast }: { toast: ErpToastState }) {
  if (!toast) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 max-w-sm rounded-xl border bg-card p-3 text-sm shadow-lg">
      <p
        className={
          toast.type === "error" ? "text-destructive" : "text-muted-foreground"
        }
      >
        {toast.message}
      </p>
    </div>
  );
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = "Confirmar",
  isPending,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-lg">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Procesando..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function getFriendlyDeleteError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("403") ||
    lowerMessage.includes("permission") ||
    lowerMessage.includes("not permitted") ||
    lowerMessage.includes("forbidden")
  ) {
    return "No se puede eliminar este registro (posiblemente porque ya tiene movimientos asociados).";
  }

  return message;
}
