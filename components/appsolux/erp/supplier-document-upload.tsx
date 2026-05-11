"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type {
  ErpnextFileAttachment,
  ErpnextPurchaseInvoice,
  ErpnextPurchaseOrder,
} from "@/types/erpnext";

type Props = {
  purchaseOrders: ErpnextPurchaseOrder[];
  purchaseInvoices: ErpnextPurchaseInvoice[];
};

type UploadResponse = ApiResponse<{ file: ErpnextFileAttachment }>;
type FilesResponse = ApiResponse<{ files: ErpnextFileAttachment[] }>;

type Target = {
  doctype: "Purchase Invoice" | "Purchase Order";
  name: string;
  label: string;
};

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function buildTargets(
  purchaseOrders: ErpnextPurchaseOrder[],
  purchaseInvoices: ErpnextPurchaseInvoice[]
): Target[] {
  return [
    ...purchaseInvoices.map((invoice) => ({
      doctype: "Purchase Invoice" as const,
      name: invoice.name,
      label: `Factura ${invoice.name} - ${invoice.supplier_name ?? invoice.supplier}`,
    })),
    ...purchaseOrders.map((order) => ({
      doctype: "Purchase Order" as const,
      name: order.name,
      label: `Orden ${order.name} - ${order.supplier_name ?? order.supplier}`,
    })),
  ];
}

function parseTarget(value: string): Target | null {
  const [doctype, ...nameParts] = value.split("::");
  const name = nameParts.join("::");

  if (
    (doctype === "Purchase Invoice" || doctype === "Purchase Order") &&
    name.trim()
  ) {
    return { doctype, name, label: name };
  }

  return null;
}

export function SupplierDocumentUpload({
  purchaseOrders,
  purchaseInvoices,
}: Props) {
  const router = useRouter();
  const targets = buildTargets(purchaseOrders, purchaseInvoices);
  const [targetValue, setTargetValue] = useState(
    targets[0] ? `${targets[0].doctype}::${targets[0].name}` : ""
  );
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [files, setFiles] = useState<ErpnextFileAttachment[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  useEffect(() => {
    const target = parseTarget(targetValue);

    if (!target) {
      return;
    }
    const activeTarget = target;

    async function loadFiles() {
      setIsLoadingFiles(true);
      try {
        const params = new URLSearchParams({
          doctype: activeTarget.doctype,
          name: activeTarget.name,
        });
        const response = await fetch(
          `/api/erpnext/purchases/attachments?${params.toString()}`
        );
        const result = (await response.json()) as FilesResponse;

        setFiles(result.success ? result.data.files : []);
      } catch {
        setFiles([]);
      } finally {
        setIsLoadingFiles(false);
      }
    }

    void loadFiles();
  }, [targetValue]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setMessage(null);
    setIsError(false);
    setFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage(null);
    setIsError(false);

    const target = parseTarget(targetValue);
    if (!target) {
      setIsError(true);
      setMessage("Selecciona una factura u orden de compra.");
      return;
    }

    if (!file) {
      setIsError(true);
      setMessage("Selecciona un archivo PDF o XML.");
      return;
    }

    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (extension !== ".pdf" && extension !== ".xml") {
      setIsError(true);
      setMessage("Solo se permiten archivos PDF o XML.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setIsError(true);
      setMessage("El archivo no puede superar 5 MB.");
      return;
    }

    setIsPending(true);
    try {
      const payload = new FormData();
      payload.set("doctype", target.doctype);
      payload.set("name", target.name);
      payload.set("file", file);

      const response = await fetch("/api/erpnext/purchases/attachments", {
        method: "POST",
        body: payload,
      });
      const result = (await response.json()) as UploadResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(`Archivo adjuntado: ${result.data.file.file_name ?? file.name}`);
      form.reset();
      setFile(null);
      setFiles((current) => [result.data.file, ...current]);
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo adjuntar el archivo."
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Subir documento proveedor</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjunta PDF o XML al documento de compra en ERPNext. Esto no valida
            XML fiscal ni conecta OCR/SRI.
          </p>
        </div>
        <span className="inline-flex h-6 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
          Attachment real
        </span>
      </div>

      {targets.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Primero registra una orden o factura de compra para adjuntar archivos.
        </div>
      ) : (
        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Documento destino</Label>
            <select
              className={selectClassName}
              value={targetValue}
              onChange={(event) => setTargetValue(event.target.value)}
            >
              {targets.map((target) => (
                <option
                  key={`${target.doctype}-${target.name}`}
                  value={`${target.doctype}::${target.name}`}
                >
                  {target.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Archivo PDF/XML</Label>
            <input
              type="file"
              accept=".pdf,.xml,application/pdf,text/xml,application/xml"
              onChange={handleFileChange}
              className="block h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Subiendo..." : "Adjuntar"}
            </Button>
          </div>
          {message ? (
            <p
              className={
                isError
                  ? "text-sm text-destructive md:col-span-3"
                  : "text-sm text-muted-foreground md:col-span-3"
              }
            >
              {message}
            </p>
          ) : null}
        </form>
      )}

      {targets.length > 0 ? (
        <div className="mt-4 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm font-medium">Adjuntos del documento</p>
          {isLoadingFiles ? (
            <p className="mt-2 text-sm text-muted-foreground">Cargando...</p>
          ) : files.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Este documento todavia no tiene PDF/XML adjunto desde Appsolux.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {files.map((item) => (
                <li
                  key={item.name}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
                >
                  <span>{item.file_name ?? item.name}</span>
                  {item.file_url?.startsWith("http") ? (
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium underline-offset-2 hover:underline"
                    >
                      Ver archivo
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
