"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ActionForm,
  apiPost,
  child,
  DataTable,
  dateLabel,
  ecuNow,
  moneyLabel,
  Notice,
  selectOptions,
  Status,
  useResource,
  value,
  type List,
  type Options,
  type Row,
} from "./ui";
import { TreasuryImport } from "./treasury-import";

export function ReconciliationClient({ options }: { options: Options | null }) {
  const [selected, setSelected] = useState<string | null>(null),
    [create, setCreate] = useState(false),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null);
  const data = useResource<List & { reconciliation?: Row }>(
    `/api/treasury/banks/reconciliations${selected ? `/${selected}` : ""}?page=${page}&revision=${revision}`,
  );
  const reconciliation = data.data?.reconciliation;
  async function mutate(path: string, body: Row) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiPost(path, body);
      setMessage("Operación registrada.");
      setRevision((n) => n + 1);
      setCreate(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo completar la conciliación.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {selected ? (
          <Button
            variant="outline"
            onClick={() => {
              setSelected(null);
              setPage(1);
            }}
          >
            Volver a conciliaciones
          </Button>
        ) : (
          <Button onClick={() => setCreate((v) => !v)}>
            Nueva conciliación
          </Button>
        )}
        {reconciliation &&
          !["COMPLETED", "CANCELLED"].includes(
            value(reconciliation, "status"),
          ) && (
            <Button
              disabled={busy}
              onClick={() =>
                mutate(`banks/reconciliations/${selected}/complete`, {})
              }
            >
              Completar conciliación
            </Button>
          )}
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {data.error && <Notice error>{data.error}</Notice>}
      {data.loading && <p role="status">Cargando conciliación…</p>}
      {create && (
        <ActionForm
          title="Crear período de conciliación"
          busy={busy}
          close={() => setCreate(false)}
          fields={[
            {
              name: "accountId",
              label: "Banco",
              type: "select",
              options: selectOptions(
                options?.accounts.filter((a) => a.type === "BANK"),
              ),
            },
            {
              name: "periodStart",
              label: "Desde",
              type: "date",
              initial: `${ecuNow().slice(0, 7)}-01`,
            },
            {
              name: "periodEnd",
              label: "Hasta (inclusive)",
              type: "date",
              initial: ecuNow().slice(0, 10),
            },
            {
              name: "statementOpeningBalance",
              label: "Saldo inicial del estado",
              type: "signed-money",
            },
            {
              name: "statementClosingBalance",
              label: "Saldo final del estado",
              type: "signed-money",
            },
            {
              name: "dateToleranceDays",
              label: "Tolerancia de días",
              type: "number",
              min: 0,
              max: 7,
              initial: "2",
            },
          ]}
          submit={(body) => mutate("banks/reconciliations", body)}
        />
      )}
      {reconciliation && (
        <>
          <div className="grid gap-3 rounded-xl border bg-background p-4 text-sm sm:grid-cols-2">
            <p>Banco: {value(child(reconciliation, "bankAccount"), "name")}</p>
            <p>
              Estado: <Status status={value(reconciliation, "status")} />
            </p>
            <p>Inicio: {dateLabel(reconciliation.periodStart)}</p>
            <p>Fin exclusivo: {dateLabel(reconciliation.periodEnd)}</p>
            <p>
              Saldo inicial banco:{" "}
              {moneyLabel(reconciliation.statementOpeningBalance)}
            </p>
            <p>
              Saldo inicial sistema:{" "}
              {moneyLabel(reconciliation.systemOpeningBalance)}
            </p>
            <p>
              Saldo final banco:{" "}
              {moneyLabel(reconciliation.statementClosingBalance)}
            </p>
            <p>
              Saldo final sistema:{" "}
              {moneyLabel(reconciliation.systemClosingBalance)}
            </p>
            <p>Diferencia: {moneyLabel(reconciliation.difference)}</p>
          </div>
          <Notice>
            Las coincidencias se proponen por monto, dirección, fecha y
            referencia. Confirma cada emparejamiento. Los saldos del sistema se
            recalculan antes de completar; un período cerrado bloquea
            movimientos bancarios retroactivos.
          </Notice>
          {!["COMPLETED", "CANCELLED"].includes(
            value(reconciliation, "status"),
          ) && (
            <TreasuryImport
              key={selected}
              kind="statement"
              reconciliationId={selected!}
              onDone={() => setRevision((n) => n + 1)}
            />
          )}
        </>
      )}
      {data.data && (
        <DataTable
          data={data.data}
          page={page}
          setPage={setPage}
          columns={
            selected
              ? [
                  { label: "Fecha", render: (r) => dateLabel(r.date) },
                  {
                    label: "Descripción",
                    render: (r) => value(r, "description"),
                  },
                  { label: "Referencia", render: (r) => value(r, "reference") },
                  {
                    label: "Dirección",
                    render: (r) =>
                      r.direction === "IN" ? "Entrada" : "Salida",
                  },
                  { label: "Monto", render: (r) => moneyLabel(r.amount) },
                  {
                    label: "Conciliación",
                    render: (r) =>
                      r.status === "MATCHED" ? "Conciliado" : "Sin conciliar",
                  },
                  {
                    label: "Coincidencias propuestas",
                    render: (r) =>
                      r.status === "MATCHED" ? (
                        value(r, "matchedMovementId")
                      ) : Array.isArray(r.candidates) && r.candidates.length ? (
                        <div className="grid gap-2">
                          {(r.candidates as Row[]).map((c) => (
                            <Button
                              size="sm"
                              variant="outline"
                              key={value(c, "id")}
                              disabled={busy}
                              onClick={() =>
                                mutate("banks/reconciliations/match", {
                                  lineId: r.id,
                                  movementId: c.id,
                                })
                              }
                            >
                              {c.match === "EXACT"
                                ? "Coincidencia exacta"
                                : "Posible coincidencia"}{" "}
                              · {dateLabel(c.date)} ·{" "}
                              {value(c, "reference") || "Sin referencia"}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        "Sin coincidencias"
                      ),
                  },
                ]
              : [
                  {
                    label: "Banco",
                    render: (r) => value(child(r, "bankAccount"), "name"),
                  },
                  { label: "Desde", render: (r) => dateLabel(r.periodStart) },
                  {
                    label: "Hasta (exclusivo)",
                    render: (r) => dateLabel(r.periodEnd),
                  },
                  {
                    label: "Saldo banco",
                    render: (r) => moneyLabel(r.statementClosingBalance),
                  },
                  {
                    label: "Saldo sistema",
                    render: (r) => moneyLabel(r.systemClosingBalance),
                  },
                  {
                    label: "Diferencia",
                    render: (r) => moneyLabel(r.difference),
                  },
                  {
                    label: "Estado",
                    render: (r) => <Status status={value(r, "status")} />,
                  },
                  {
                    label: "Acción",
                    render: (r) => (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelected(value(r, "id"));
                          setPage(1);
                        }}
                      >
                        Abrir conciliación
                      </Button>
                    ),
                  },
                ]
          }
        />
      )}
    </div>
  );
}
