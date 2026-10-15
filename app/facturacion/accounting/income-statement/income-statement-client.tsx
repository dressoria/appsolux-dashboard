"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Row = {
  code: string;
  name: string;
  level: number;
  isGroup: boolean;
  balance: string;
};

type Result = {
  rows: Row[];
  netIncome: string;
};

export function IncomeStatementClient() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    const res = await fetch(
      `/api/accounting/reports/income-statement?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    );
    if (res.ok) setResult(await res.json());
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

      {result && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Código</th>
                  <th className="px-4 py-3 text-left font-medium">Cuenta</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{row.code}</td>
                    <td className="px-4 py-2">
                      <span
                        style={{ paddingLeft: `${(row.level - 1) * 12}px` }}
                        className={row.isGroup ? "font-semibold" : ""}
                      >
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {Number(row.balance).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/50 font-semibold">
                  <td className="px-4 py-3" colSpan={2}>
                    {Number(result.netIncome) >= 0 ? "Utilidad neta" : "Pérdida neta"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {Number(result.netIncome).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
