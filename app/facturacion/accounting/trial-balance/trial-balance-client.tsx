"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Row = {
  code: string;
  name: string;
  rootType: string;
  level: number;
  isGroup: boolean;
  debitTotal: string;
  creditTotal: string;
  debitBalance: string;
  creditBalance: string;
};

export function TrialBalanceClient() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    const res = await fetch(
      `/api/accounting/reports/trial-balance?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    );
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Desde</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Hasta</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <Button onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Generar"}
          </Button>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-3 text-left font-medium">Código</th>
                  <th className="px-3 py-3 text-left font-medium">Cuenta</th>
                  <th className="px-3 py-3 text-right font-medium">Debe</th>
                  <th className="px-3 py-3 text-right font-medium">Haber</th>
                  <th className="px-3 py-3 text-right font-medium">Saldo deudor</th>
                  <th className="px-3 py-3 text-right font-medium">Saldo acreedor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                    <td className="px-3 py-2">
                      <span
                        style={{ paddingLeft: `${(row.level - 1) * 12}px` }}
                        className={row.isGroup ? "font-semibold" : ""}
                      >
                        {row.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{Number(row.debitTotal).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{Number(row.creditTotal).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{Number(row.debitBalance).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{Number(row.creditBalance).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
