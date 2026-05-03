"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type {
  ErpnextItem,
  ErpnextStockLedgerEntry,
  ErpnextWarehouse,
} from "@/types/erpnext";

type StockLedgerTableProps = {
  entries: ErpnextStockLedgerEntry[];
  items: ErpnextItem[];
  warehouses: ErpnextWarehouse[];
};

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function formatQuantity(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatDate(postingDate?: string, postingTime?: string) {
  if (!postingDate) {
    return "-";
  }

  return [postingDate, postingTime].filter(Boolean).join(" ");
}

export function StockLedgerTable({
  entries,
  items,
  warehouses,
}: StockLedgerTableProps) {
  const [itemCode, setItemCode] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const itemMatches = itemCode ? entry.item_code === itemCode : true;
        const warehouseMatches = warehouse
          ? entry.warehouse === warehouse
          : true;

        return itemMatches && warehouseMatches;
      }),
    [entries, itemCode, warehouse]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movimientos de inventario</CardTitle>
        <CardDescription>
          Aqui se muestra el historial de entradas, salidas, ajustes y
          movimientos por producto y bodega.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Aun no hay movimientos de inventario registrados.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ledger_item_code">Filtrar por producto</Label>
                <select
                  id="ledger_item_code"
                  className={selectClassName}
                  value={itemCode}
                  onChange={(event) => setItemCode(event.target.value)}
                >
                  <option value="">Todos los productos</option>
                  {items.map((item) => (
                    <option key={item.name} value={item.item_code}>
                      {item.item_name} ({item.item_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ledger_warehouse">Filtrar por bodega</Label>
                <select
                  id="ledger_warehouse"
                  className={selectClassName}
                  value={warehouse}
                  onChange={(event) => setWarehouse(event.target.value)}
                >
                  <option value="">Todas las bodegas</option>
                  {warehouses.map((erpWarehouse) => (
                    <option key={erpWarehouse.name} value={erpWarehouse.name}>
                      {erpWarehouse.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay movimientos para los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Producto</th>
                      <th className="py-2 pr-4 font-medium">
                        Bodega / ubicacion
                      </th>
                      <th className="py-2 pr-4 font-medium">Movimiento</th>
                      <th className="py-2 pr-4 font-medium">
                        Stock despues
                      </th>
                      <th className="py-2 pr-4 font-medium">Origen</th>
                      <th className="py-2 font-medium">Referencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredEntries.map((entry) => (
                      <tr key={entry.name}>
                        <td className="py-2 pr-4">
                          {formatDate(entry.posting_date, entry.posting_time)}
                        </td>
                        <td className="py-2 pr-4 font-medium">
                          {entry.item_code}
                        </td>
                        <td className="py-2 pr-4">{entry.warehouse}</td>
                        <td className="py-2 pr-4">
                          {formatQuantity(entry.actual_qty)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatQuantity(entry.qty_after_transaction)}
                        </td>
                        <td className="py-2 pr-4">
                          {entry.voucher_type ?? "-"}
                        </td>
                        <td className="py-2">{entry.voucher_no ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
