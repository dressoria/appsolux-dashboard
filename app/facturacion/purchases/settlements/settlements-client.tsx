"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { routes } from "@/config/routes";

type SettlementDoc = {
  id: string;
  customerName: string;
  customerIdentification: string | null;
  sequentialNumber: number | null;
  status: string;
  grandTotal: string;
  createdAt: string;
  establishment: { code: string } | null;
  issuePoint: { code: string } | null;
  submissionJobs: Array<{ sriAuthorizationNumber: string | null }>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  READY_FOR_TESTING: "Listo para pruebas",
  SIGNED: "Firmado",
  SENT: "Recibido por SRI",
  AUTHORIZED: "Autorizado",
  REJECTED: "Rechazado",
  CANCELLED: "Anulado",
};

export function SettlementsClient() {
  const [docs, setDocs] = useState<SettlementDoc[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/purchases/settlements?${params}`);
    const data = await res.json();
    setDocs(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Liquidaciones de compra</h1>
          <p className="text-sm text-muted-foreground">
            Liquidaciones de compra emitidas electrónicamente
          </p>
        </div>
        <Link href={routes.facturacionPurchasesSettlementsNew}>
          <Button>Nueva liquidación</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : docs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay liquidaciones de compra.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nº Documento</th>
                    <th className="px-4 py-3 font-medium">Proveedor</th>
                    <th className="px-4 py-3 font-medium">RUC/CI</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => {
                    const displayNum =
                      doc.sequentialNumber && doc.establishment && doc.issuePoint
                        ? `${doc.establishment.code}-${doc.issuePoint.code}-${String(doc.sequentialNumber).padStart(9, "0")}`
                        : "—";
                    return (
                      <tr key={doc.id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3 font-mono text-xs">{displayNum}</td>
                        <td className="px-4 py-3">{doc.customerName}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {doc.customerIdentification ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {new Date(doc.createdAt).toLocaleDateString("es-EC")}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${Number(doc.grandTotal).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-muted px-2 py-0.5 text-xs">
                            {STATUS_LABELS[doc.status] ?? doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-primary">Ver</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
