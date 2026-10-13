"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type WithholdingLine = {
  taxType: "RENTA" | "IVA";
  code: string;
  taxBase: string;
  percentage: string;
  retainedAmount: string;
};

export function NewWithholdingClient() {
  const router = useRouter();
  const [purchaseDocumentId, setPurchaseDocumentId] = useState("");
  const [lines, setLines] = useState<WithholdingLine[]>([
    { taxType: "RENTA", code: "", taxBase: "0", percentage: "0", retainedAmount: "0" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addLine() {
    setLines([...lines, { taxType: "RENTA", code: "", taxBase: "0", percentage: "0", retainedAmount: "0" }]);
  }

  function updateLine(index: number, field: keyof WithholdingLine, value: string) {
    const next = [...lines];
    const line = { ...next[index]!, [field]: value };
    if (field === "taxBase" || field === "percentage") {
      line.retainedAmount = (Number(line.taxBase) * Number(line.percentage) / 100).toFixed(2);
    }
    next[index] = line;
    setLines(next);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  const totalRetained = lines.reduce((sum, l) => sum + Number(l.retainedAmount), 0);

  async function handleSubmit() {
    if (!purchaseDocumentId.trim()) {
      setError("Selecciona una compra.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/purchases/withholdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseDocumentId,
          lines: lines.map((l) => ({
            taxType: l.taxType,
            code: l.code,
            taxBase: Number(l.taxBase),
            percentage: Number(l.percentage),
            retainedAmount: Number(l.retainedAmount),
          })),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Error al crear retención.");
      router.push("/facturacion/purchases/withholdings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva retención</h1>
        <p className="text-sm text-muted-foreground">Emitir comprobante de retención electrónico</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-medium">Compra asociada</h3>
          <Input placeholder="ID de la compra" value={purchaseDocumentId} onChange={(e) => setPurchaseDocumentId(e.target.value)} className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground">Ingresa el ID del documento de compra al cual aplicar la retención.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Líneas de retención</h3>
            <Button variant="outline" size="sm" onClick={addLine}>+ Agregar línea</Button>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-6 items-end">
              <select value={line.taxType} onChange={(e) => updateLine(i, "taxType", e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                <option value="RENTA">Renta</option>
                <option value="IVA">IVA</option>
              </select>
              <Input placeholder="Código" value={line.code} onChange={(e) => updateLine(i, "code", e.target.value)} />
              <Input type="number" placeholder="Base imponible" value={line.taxBase} onChange={(e) => updateLine(i, "taxBase", e.target.value)} />
              <Input type="number" placeholder="%" value={line.percentage} onChange={(e) => updateLine(i, "percentage", e.target.value)} />
              <div className="text-sm font-medium py-2">${Number(line.retainedAmount).toFixed(2)}</div>
              <Button variant="ghost" size="sm" onClick={() => removeLine(i)} disabled={lines.length <= 1}>✕</Button>
            </div>
          ))}
          <div className="flex justify-end font-medium">Total retenido: ${totalRetained.toFixed(2)}</div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => router.push("/facturacion/purchases/withholdings")}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving}>{saving ? "Guardando..." : "Guardar borrador"}</Button>
      </div>
    </div>
  );
}
