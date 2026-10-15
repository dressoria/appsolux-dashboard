"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type LedgerRow = {
  entryNumber: string;
  date: string;
  description: string;
  lineDescription: string | null;
  debit: string;
  credit: string;
  balance: string;
};

export function LedgerClient() {
  const [accountSearch, setAccountSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string }>>([]);

  async function searchAccounts(query: string) {
    setAccountSearch(query);
    if (query.length < 2) { setAccounts([]); return; }
    const res = await fetch(`/api/accounting/accounts/search?q=${encodeURIComponent(query)}`);
    if (res.ok) setAccounts(await res.json());
  }

  async function loadLedger() {
    if (!selectedAccountId || !dateFrom || !dateTo) return;
    setLoading(true);
    const res = await fetch(
      `/api/accounting/reports/ledger?accountId=${selectedAccountId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
    );
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="relative min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cuenta</label>
            <Input
              placeholder="Buscar cuenta..."
              value={accountSearch}
              onChange={(e) => searchAccounts(e.target.value)}
            />
            {accounts.length > 0 && (
              <div className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border bg-white shadow-lg">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => {
                      setSelectedAccountId(a.id);
                      setAccountSearch(`${a.code} ${a.name}`);
                      setAccounts([]);
                    }}
                  >
                    <span className="font-mono">{a.code}</span> {a.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Desde</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Hasta</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <Button onClick={loadLedger} disabled={loading || !selectedAccountId}>
            {loading ? "Cargando..." : "Consultar"}
          </Button>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Asiento</th>
                  <th className="px-4 py-3 text-left font-medium">Descripción</th>
                  <th className="px-4 py-3 text-right font-medium">Débito</th>
                  <th className="px-4 py-3 text-right font-medium">Crédito</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 text-xs">{new Date(row.date).toLocaleDateString("es-EC")}</td>
                    <td className="px-4 py-2 font-mono text-xs">{row.entryNumber}</td>
                    <td className="px-4 py-2 text-xs">{row.lineDescription ?? row.description}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{Number(row.debit).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{Number(row.credit).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs font-semibold">{Number(row.balance).toFixed(2)}</td>
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
