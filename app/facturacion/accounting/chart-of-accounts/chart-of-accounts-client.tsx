"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Account = {
  id: string;
  code: string;
  name: string;
  rootType: string;
  level: number;
  isGroup: boolean;
  allowsPosting: boolean;
  active: boolean;
  parentId: string | null;
};

type Props = {
  initialAccounts: Account[];
  hasPlan: boolean;
  planName: string | null;
};

export function ChartOfAccountsClient({ initialAccounts, hasPlan, planName }: Props) {
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  if (!hasPlan) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            No hay un plan de cuentas activo. Crea uno nuevo o importa desde un archivo XLSX.
          </p>
          <Button className="mt-4" onClick={() => {
            fetch("/api/accounting/plans", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: "Plan de cuentas principal" }),
            }).then(() => window.location.reload());
          }}>
            Crear plan de cuentas
          </Button>
        </CardContent>
      </Card>
    );
  }

  const filtered = search.trim()
    ? initialAccounts.filter(
        (a) =>
          a.code.toLowerCase().includes(search.toLowerCase()) ||
          a.name.toLowerCase().includes(search.toLowerCase()),
      )
    : initialAccounts;

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isVisible(account: Account): boolean {
    if (!account.parentId) return true;
    if (search.trim()) return true;
    const parent = initialAccounts.find((a) => a.id === account.parentId);
    if (!parent) return true;
    return expandedGroups.has(parent.id) && isVisible(parent);
  }

  const visible = filtered.filter(isVisible);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Plan activo: {planName}</p>
        </div>
        <Input
          placeholder="Buscar cuenta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-center font-medium">Movimiento</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((account) => (
                <tr key={account.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">
                    <span style={{ paddingLeft: `${(account.level - 1) * 16}px` }}>
                      {account.isGroup ? (
                        <button
                          type="button"
                          onClick={() => toggleGroup(account.id)}
                          className="mr-1 text-muted-foreground hover:text-foreground"
                        >
                          {expandedGroups.has(account.id) ? "▼" : "▶"}
                        </button>
                      ) : (
                        <span className="mr-1 inline-block w-[12px]" />
                      )}
                      {account.code}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={account.isGroup ? "font-semibold" : ""}>
                      {account.name}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{account.rootType}</td>
                  <td className="px-4 py-2 text-center text-xs">
                    {account.allowsPosting ? "Sí" : "—"}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    {search ? "Sin resultados" : "Plan de cuentas vacío. Importa un archivo XLSX o crea cuentas manualmente."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
