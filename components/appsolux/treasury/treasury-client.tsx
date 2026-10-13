"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { TreasuryView } from "@/config/treasury-navigation";
import {
  ActionForm,
  apiPost,
  child,
  DataTable,
  dateLabel,
  ecuNow,
  fieldClass,
  labels,
  moneyLabel,
  Notice,
  selectOptions,
  Status,
  useResource,
  value,
  type Column,
  type Field,
  type List,
  type Options,
  type Row,
} from "./ui";
import { TreasuryImport } from "./treasury-import";
import { ReconciliationClient } from "./reconciliation-client";

const endpoint = (view: TreasuryView) =>
  view === "cash/postdated-checks"
    ? "checks"
    : view === "cards/movements"
      ? "cards/transactions"
      : view.startsWith("portfolio/")
        ? view.split("/")[1]
        : view;
type Action = { kind: string; row?: Row; status?: string };
const notes: Field = { name: "notes", label: "Notas", required: false };
const reference: Field = {
  name: "reference",
  label: "Referencia",
  required: false,
};
const at: Field = {
  name: "date",
  label: "Fecha y hora (Ecuador; vacío = ahora)",
  type: "datetime-local",
  required: false,
};

export function TreasuryClient({ view }: { view: TreasuryView }) {
  const [revision, setRevision] = useState(0),
    [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [search, setSearch] = useState("");
  const partySearch = useDeferredValue(search);
  const [action, setAction] = useState<Action | null>(null),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null);
  const options = useResource<Options>(
    `/api/treasury/options?q=${encodeURIComponent(partySearch)}&revision=${revision}`,
  );
  const specialized = [
    "summary",
    "portfolio/import",
    "banks/reconciliation",
  ].includes(view);
  const query = new URLSearchParams({
    ...filters,
    page: String(page),
    revision: String(revision),
  });
  const data = useResource<List>(
    specialized ? null : `/api/treasury/${endpoint(view)}?${query}`,
  );
  const customers =
    view === "portfolio/receivables" || view === "advances/customers";
  const accountsView = ["cash/accounts", "banks", "cards"].includes(view);
  const movements = view === "cash/movements" || view === "banks/movements";
  const portfolio =
    view === "portfolio/receivables" || view === "portfolio/payables";
  const advances = view.startsWith("advances/");
  const banks = options.data?.accounts.filter((a) => a.type === "BANK") ?? [];
  const accounts = options.data?.accounts ?? [];
  const parties = customers
    ? (options.data?.customers ?? [])
    : (options.data?.suppliers ?? []);
  const applications = useResource<List>(
    action?.kind === "apply" && action.row
      ? `/api/treasury/${customers ? "receivables" : "payables"}?pageSize=100&partyId=${encodeURIComponent(value(action.row, customers ? "customerId" : "supplierId"))}&revision=${revision}`
      : null,
  );
  async function mutate(path: string, body: Row) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiPost(path, {
        ...body,
        requestKey: body.requestKey ?? crypto.randomUUID(),
      });
      setMessage(
        result.differenceAmount !== undefined
          ? `Caja cerrada. Esperado: ${moneyLabel(result.expectedClosingAmount)} · Contado: ${moneyLabel(result.countedClosingAmount)} · Diferencia: ${moneyLabel(result.differenceAmount)}`
          : "Operación registrada correctamente.",
      );
      setRevision((n) => n + 1);
      setAction(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  const accountSelect = (
    name = "accountId",
    label = "Cuenta de Tesorería",
    list = accounts,
  ): Field => ({
    name,
    label,
    type: "select",
    options: selectOptions(list, (a) => ` · ${labels[value(a, "type")] ?? ""}`),
  });
  const moneyField = (
    name = "amount",
    label = "Monto",
    initial?: string,
  ): Field => ({ name, label, type: "money", initial });
  const fields: Field[] = [];
  let formTitle = "",
    formPath = endpoint(view),
    help = "";
  if (action?.kind === "account") {
    formTitle = action.row
      ? "Editar cuenta"
      : view === "banks"
        ? "Agregar cuenta bancaria"
        : view === "cards"
          ? "Agregar canal de tarjeta"
          : "Agregar caja";
    fields.push(
      { name: "name", label: "Nombre", initial: value(action.row, "name") },
      {
        name: "code",
        label: "Código",
        required: false,
        initial: value(action.row, "code"),
      },
      {
        name: "defaultAccount",
        label: "Usar como cuenta predeterminada",
        type: "checkbox",
        initial: action.row?.defaultAccount === true,
      },
    );
    if (!action.row)
      fields.push(moneyField("openingBalance", "Saldo inicial", "0"), {
        name: "openingDate",
        label: "Fecha del saldo inicial",
        type: "date",
        initial: ecuNow().slice(0, 10),
      });
    if (view === "cash/accounts")
      fields.push({
        name: "responsibleName",
        label: "Responsable (opcional)",
        required: false,
        initial: value(action.row, "responsibleName"),
      });
    if (view === "banks")
      fields.push(
        {
          name: "bankName",
          label: "Banco",
          initial: value(action.row, "bankName"),
        },
        {
          name: "accountName",
          label: "Titular",
          initial: value(action.row, "accountName"),
        },
        {
          name: "accountNumber",
          label: "Número de cuenta (solo se conserva ****1234)",
          required: false,
        },
        {
          name: "bankAccountType",
          label: "Tipo de cuenta",
          type: "select",
          initial: value(action.row, "bankAccountType") || "CHECKING",
          options: [
            { value: "CHECKING", label: "Corriente" },
            { value: "SAVINGS", label: "Ahorros" },
            { value: "OTHER", label: "Otra" },
          ],
        },
      );
    if (view === "cards")
      fields.push(
        {
          name: "provider",
          label: "Proveedor / canal",
          initial: value(action.row, "provider"),
        },
        {
          ...accountSelect(
            "settlementBankAccountId",
            "Banco de acreditación",
            banks,
          ),
          required: false,
          initial: value(action.row, "settlementBankAccountId"),
        },
        moneyField(
          "feePercentage",
          "Comisión porcentual",
          value(action.row, "feePercentage") || "0",
        ),
        moneyField(
          "fixedFee",
          "Comisión fija",
          value(action.row, "fixedFee") || "0",
        ),
        {
          name: "settlementDays",
          label: "Días de acreditación",
          type: "number",
          min: 0,
          max: 90,
          initial: value(action.row, "settlementDays") || "2",
        },
      );
    help =
      "Moneda USD. El saldo inicial se fija al crear la cuenta; las correcciones posteriores requieren movimientos auditados.";
  } else if (action?.kind === "manual") {
    formTitle = view.startsWith("cash")
      ? "Ingreso / egreso manual"
      : "Depósito / retiro";
    fields.push(
      accountSelect(
        "accountId",
        view.startsWith("cash") ? "Caja" : "Banco",
        accounts.filter(
          (a) => a.type === (view.startsWith("cash") ? "CASH" : "BANK"),
        ),
      ),
      {
        name: "direction",
        label: "Acción",
        type: "select",
        options: [
          {
            value: "IN",
            label: view.startsWith("cash") ? "Ingreso" : "Depósito",
          },
          {
            value: "OUT",
            label: view.startsWith("cash") ? "Egreso" : "Retiro",
          },
        ],
      },
      moneyField(),
      { name: "description", label: "Concepto" },
      { ...at },
      reference,
    );
    help =
      "Los ingresos/egresos de caja requieren una sesión abierta. Un movimiento confirmado se corrige con un reverso.";
  } else if (action?.kind === "transfer") {
    formTitle = "Transferencia entre bancos";
    formPath = "banks/transfers";
    fields.push(
      accountSelect("fromAccountId", "Banco origen", banks),
      accountSelect("toAccountId", "Banco destino", banks),
      moneyField(),
      { ...at },
      reference,
      {
        name: "description",
        label: "Concepto",
        initial: "Transferencia interna",
      },
    );
  } else if (action?.kind === "close") {
    formTitle = `Cerrar ${value(action.row, "name")}`;
    formPath = "cash/sessions";
    fields.push(
      moneyField(
        "countedAmount",
        "Efectivo contado",
        value(action.row, "balance"),
      ),
      notes,
    );
    help =
      "El servidor calcula el esperado y la diferencia. Se conserva un snapshot de cierre; una diferencia no modifica silenciosamente el saldo.";
  } else if (action?.kind === "reverse") {
    formTitle = "Reversar movimiento manual";
    formPath = "movements/reverse";
    fields.push({ name: "reason", label: "Motivo del reverso" });
    help =
      "Se agrega un movimiento compensatorio. La caja debe estar abierta si corresponde.";
  } else if (action?.kind === "obligation") {
    formTitle = customers
      ? "Registrar cuenta por cobrar inicial"
      : "Registrar cuenta por pagar inicial";
    fields.push(
      {
        name: "partyId",
        label: customers ? "Cliente" : "Proveedor",
        type: "select",
        options: selectOptions(parties),
      },
      { name: "documentNumber", label: "Documento", required: false },
      {
        name: "issueDate",
        label: "Emisión",
        type: "date",
        initial: ecuNow().slice(0, 10),
      },
      {
        name: "dueDate",
        label: "Vencimiento",
        type: "date",
        initial: ecuNow().slice(0, 10),
      },
      moneyField("originalAmount", "Valor original"),
      moneyField("balance", "Saldo pendiente"),
      notes,
    );
    help =
      "Registra solo el saldo de cartera. No crea una factura, compra, inventario ni entrada/salida de dinero.";
  } else if (action?.kind === "collect") {
    formTitle = customers ? "Registrar cobro" : "Registrar pago";
    formPath = `${customers ? "receivables" : "payables"}/${value(action.row, "id")}/${customers ? "collect" : "pay"}`;
    fields.push(
      moneyField("amount", "Monto", value(action.row, "balance")),
      {
        name: "method",
        label: "Método",
        type: "select",
        options: [
          { value: "cash", label: "Efectivo" },
          { value: "transfer", label: "Transferencia" },
          ...(customers ? [{ value: "card", label: "Tarjeta" }] : []),
        ],
      },
      accountSelect(
        "accountId",
        customers ? "Cuenta destino" : "Cuenta origen",
        accounts.filter((a) => customers || a.type !== "CARD"),
      ),
      { ...at },
      reference,
    );
    help =
      "El saldo se calcula desde la obligación. Los cobros con tarjeta quedan por acreditar y no aumentan el banco hasta la liquidación.";
  } else if (action?.kind === "advance") {
    formTitle = customers
      ? "Registrar anticipo de cliente"
      : "Registrar anticipo a proveedor";
    fields.push(
      {
        name: "partyId",
        label: customers ? "Cliente" : "Proveedor",
        type: "select",
        options: selectOptions(parties),
      },
      moneyField(),
      {
        name: "method",
        label: "Método",
        type: "select",
        options: [
          { value: "cash", label: "Efectivo" },
          { value: "transfer", label: "Transferencia" },
          ...(customers ? [{ value: "card", label: "Tarjeta" }] : []),
        ],
      },
      accountSelect(
        "accountId",
        "Cuenta",
        accounts.filter((a) => customers || a.type !== "CARD"),
      ),
      { ...at },
      reference,
      notes,
    );
  } else if (action?.kind === "apply") {
    formTitle = "Aplicar anticipo a una obligación";
    formPath = `advances/${value(action.row, "id")}/apply`;
    fields.push(
      {
        name: "obligationId",
        label: "Obligación del mismo tercero",
        type: "select",
        options: applications.data?.items
          .filter((o) => !["PAID", "CANCELLED"].includes(value(o, "status")))
          .map((o) => ({
            value: value(o, "id"),
            label: `${value(o, "documentNumber") || value(o, "id")} · Saldo ${moneyLabel(o.balance)}`,
          })),
      },
      moneyField(),
    );
    help =
      "La aplicación reduce ambos saldos y no genera otro movimiento de dinero.";
  } else if (action?.kind === "card-collection") {
    formTitle = "Registrar cobro por tarjeta";
    fields.push(
      accountSelect(
        "accountId",
        "Canal",
        accounts.filter((a) => a.type === "CARD"),
      ),
      moneyField(),
      { ...at },
      reference,
    );
    help =
      "Cobro comercial ya realizado por el canal. No procesa un pago online ni almacena datos de la tarjeta del cliente.";
  } else if (action?.kind === "settle") {
    formTitle = "Confirmar acreditación de tarjeta";
    formPath = `cards/transactions/${value(action.row, "id")}/settle`;
    fields.push(
      {
        ...accountSelect("bankAccountId", "Banco destino", banks),
        initial: value(
          child(action.row!, "cardAccount"),
          "settlementBankAccountId",
        ),
      },
      { ...at },
    );
    help = `Bruto ${moneyLabel(action.row?.grossAmount)} · Comisión ${moneyLabel(action.row?.feeAmount)} · Neto ${moneyLabel(action.row?.netAmount)}. Se registra el neto en el banco y se descarga el canal de tarjeta.`;
  } else if (action?.kind === "check") {
    formTitle = "Registrar cheque postfechado";
    fields.push(
      {
        name: "direction",
        label: "Dirección",
        type: "select",
        options: [
          { value: "RECEIVABLE", label: "Recibido / por cobrar" },
          { value: "PAYABLE", label: "Entregado / por pagar" },
        ],
      },
      { name: "checkNumber", label: "Número" },
      { name: "bankName", label: "Banco" },
      {
        name: "bankLastFour",
        label: "Últimos 4 dígitos de cuenta",
        required: false,
      },
      { name: "issuerName", label: "Emisor" },
      {
        name: "issuerIdentification",
        label: "Identificación emisor",
        required: false,
      },
      { name: "beneficiaryName", label: "Beneficiario", required: false },
      moneyField(),
      {
        name: "issueDate",
        label: "Emisión",
        type: "date",
        initial: ecuNow().slice(0, 10),
      },
      { name: "dueDate", label: "Vencimiento", type: "date" },
      {
        name: "obligationId",
        label: "ID de obligación (opcional)",
        required: false,
      },
      notes,
    );
    help =
      "No aumenta efectivo ni liquida una deuda hasta confirmar clearing. Puedes vincular una obligación de cartera por su ID.";
  } else if (action?.kind === "check-transition") {
    formTitle = `Cheque: ${labels[action.status ?? ""]}`;
    formPath = `checks/${value(action.row, "id")}/transition`;
    if (action.status === "CLEARED")
      fields.push(
        accountSelect(
          "accountId",
          "Banco donde se confirma el clearing",
          banks,
        ),
      );
    if (action.status === "BOUNCED")
      fields.push({ name: "reason", label: "Motivo de devolución" });
    help =
      "Solo el clearing mueve dinero y liquida la obligación. Una devolución después de clearing registra un compensatorio y restaura la deuda.";
  }
  const columns: Column[] = [];
  const actionsCell = (buttons: React.ReactNode) => (
    <div className="flex flex-wrap gap-2">{buttons}</div>
  );
  if (accountsView) {
    columns.push(
      {
        label: "Nombre",
        render: (r) => (
          <div>
            {value(r, "name")}
            {r.defaultAccount === true && (
              <span className="ml-2 text-xs text-muted-foreground">
                Predeterminada
              </span>
            )}
          </div>
        ),
      },
      {
        label:
          view === "banks"
            ? "Banco / cuenta"
            : view === "cards"
              ? "Proveedor"
              : "Responsable",
        render: (r) =>
          view === "banks"
            ? `${value(r, "bankName")} ${value(r, "accountNumberMasked")}`
            : value(r, view === "cards" ? "provider" : "responsibleName") ||
              "Sin asignar",
      },
      { label: "Saldo inicial", render: (r) => moneyLabel(r.openingBalance) },
      { label: "Saldo actual", render: (r) => moneyLabel(r.balance) },
      { label: "Estado", render: (r) => (r.active ? "Activa" : "Inactiva") },
    );
    if (view === "cash/accounts")
      columns.push({
        label: "Última apertura / cierre",
        render: (r) => (
          <div>
            {dateLabel(child(r, "lastSession").openedAt, true)}
            <br />
            {dateLabel(child(r, "lastClosedSession").closedAt, true)}
          </div>
        ),
      });
    if (view === "cash/accounts")
      columns.push({
        label: "Último contado / diferencia",
        render: (r) => (
          <div>
            {moneyLabel(child(r, "lastClosedSession").countedClosingAmount)}
            <p className="text-xs text-amber-800">
              Diferencia:{" "}
              {moneyLabel(child(r, "lastClosedSession").differenceAmount)}
            </p>
          </div>
        ),
      });
    columns.push({
      label: "Acciones",
      render: (r) =>
        actionsCell(
          <>
            {view === "cash/accounts" &&
              r.active === true &&
              (child(r, "lastSession").status === "OPEN" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setAction({ kind: "close", row: r })}
                >
                  Cerrar caja
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    mutate("cash/sessions", { accountId: r.id, action: "open" })
                  }
                >
                  Abrir caja
                </Button>
              ))}
            <Link
              className="text-blue-600"
              href={`/facturacion/treasury/${view === "cash/accounts" ? "cash" : view}/movements`}
            >
              Ver movimientos
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAction({ kind: "account", row: r })}
            >
              Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                mutate(endpoint(view), { id: r.id, active: r.active !== true })
              }
            >
              {r.active ? "Desactivar" : "Activar"}
            </Button>
          </>,
        ),
    });
  } else if (movements) {
    columns.push(
      { label: "Fecha/hora", render: (r) => dateLabel(r.date, true) },
      { label: "Cuenta", render: (r) => value(child(r, "account"), "name") },
      {
        label: "Tipo / origen",
        render: (r) =>
          `${labels[value(r, "movementType")] ?? value(r, "movementType")} · ${labels[value(r, "sourceType")] ?? value(r, "sourceType")}`,
      },
      { label: "Concepto", render: (r) => value(r, "description") },
      {
        label: "Entrada / crédito",
        render: (r) => (r.direction === "IN" ? moneyLabel(r.amount) : "—"),
      },
      {
        label: "Salida / débito",
        render: (r) => (r.direction === "OUT" ? moneyLabel(r.amount) : "—"),
      },
      { label: "Saldo", render: (r) => moneyLabel(r.runningBalance) },
      {
        label: "Usuario / referencia",
        render: (r) =>
          `${options.data?.users.find((u) => u.id === r.createdByUserId)?.name ?? r.createdByUserId} · ${value(r, "reference") || "Sin referencia"}`,
      },
      {
        label: "Estado",
        render: (r) => <Status status={value(r, "status")} />,
      },
      {
        label: "Acción",
        render: (r) =>
          r.sourceType === "MANUAL" &&
          r.status === "CONFIRMED" &&
          !r.reversal &&
          !r.cancelledAt ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAction({ kind: "reverse", row: r })}
            >
              Reversar
            </Button>
          ) : r.cancelledAt ? (
            "Reversado con compensatorio"
          ) : (
            "—"
          ),
      },
    );
  } else if (portfolio) {
    columns.push(
      {
        label: customers ? "Cliente" : "Proveedor",
        render: (r) =>
          value(child(r, customers ? "customer" : "supplier"), "name"),
      },
      {
        label: "Documento / ID",
        render: (r) => (
          <div>
            {value(r, "documentNumber") || "Sin número"}
            <p className="max-w-64 break-all font-mono text-xs text-muted-foreground">
              {value(r, "id")}
            </p>
          </div>
        ),
      },
      { label: "Emisión", render: (r) => dateLabel(r.issueDate) },
      { label: "Vencimiento", render: (r) => dateLabel(r.dueDate) },
      { label: "Valor original", render: (r) => moneyLabel(r.originalAmount) },
      {
        label: customers ? "Cobrado" : "Pagado",
        render: (r) => moneyLabel(r.paidAmount),
      },
      { label: "Saldo", render: (r) => moneyLabel(r.balance) },
      { label: "Días vencidos", render: (r) => value(r, "daysOverdue") },
      {
        label: "Estado",
        render: (r) => (
          <Status status={r.overdue ? "OVERDUE" : value(r, "status")} />
        ),
      },
      {
        label: "Acción",
        render: (r) =>
          !["PAID", "CANCELLED"].includes(value(r, "status")) ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAction({ kind: "collect", row: r })}
            >
              {customers ? "Registrar cobro" : "Registrar pago"}
            </Button>
          ) : (
            "—"
          ),
      },
    );
  } else if (advances) {
    columns.push(
      {
        label: customers ? "Cliente" : "Proveedor",
        render: (r) =>
          value(child(r, customers ? "customer" : "supplier"), "name"),
      },
      { label: "Fecha", render: (r) => dateLabel(r.date) },
      {
        label: "Cuenta",
        render: (r) => value(child(r, "treasuryAccount"), "name"),
      },
      { label: "Monto", render: (r) => moneyLabel(r.amount) },
      { label: "Aplicado", render: (r) => moneyLabel(r.appliedAmount) },
      { label: "Saldo", render: (r) => moneyLabel(r.balance) },
      { label: "Referencia", render: (r) => value(r, "reference") },
      {
        label: "Estado",
        render: (r) => <Status status={value(r, "status")} />,
      },
      {
        label: "Acción",
        render: (r) =>
          ["AVAILABLE", "PARTIALLY_APPLIED"].includes(value(r, "status")) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAction({ kind: "apply", row: r })}
            >
              Aplicar
            </Button>
          ) : (
            "—"
          ),
      },
    );
  } else if (view === "cards/movements") {
    columns.push(
      { label: "Fecha", render: (r) => dateLabel(r.transactionDate) },
      {
        label: "Proveedor",
        render: (r) => value(child(r, "cardAccount"), "provider"),
      },
      {
        label: "Venta / documento",
        render: (r) =>
          value(r, "saleId") || value(r, "obligationId") || "Cobro directo",
      },
      { label: "Referencia", render: (r) => value(r, "reference") },
      { label: "Bruto", render: (r) => moneyLabel(r.grossAmount) },
      { label: "Comisión", render: (r) => moneyLabel(r.feeAmount) },
      { label: "Neto", render: (r) => moneyLabel(r.netAmount) },
      {
        label: "Estado",
        render: (r) => <Status status={value(r, "status")} />,
      },
      {
        label: "Acreditación",
        render: (r) => dateLabel(r.settledAt ?? r.expectedSettlementDate),
      },
      {
        label: "Banco destino",
        render: (r) =>
          value(
            accounts.find(
              (a) => a.id === child(r, "cardAccount").settlementBankAccountId,
            ),
            "name",
          ) || "Por seleccionar",
      },
      {
        label: "Acción",
        render: (r) =>
          r.status === "PENDING" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAction({ kind: "settle", row: r })}
            >
              Acreditar
            </Button>
          ) : (
            "—"
          ),
      },
    );
  } else if (view === "cash/postdated-checks") {
    columns.push(
      { label: "Cheque", render: (r) => value(r, "checkNumber") },
      { label: "Tipo", render: (r) => labels[value(r, "direction")] },
      {
        label: "Banco / emisor",
        render: (r) => `${value(r, "bankName")} · ${value(r, "issuerName")}`,
      },
      { label: "Emisión", render: (r) => dateLabel(r.issueDate) },
      { label: "Vencimiento", render: (r) => dateLabel(r.dueDate) },
      { label: "Monto", render: (r) => moneyLabel(r.amount) },
      {
        label: "Estado",
        render: (r) => <Status status={value(r, "status")} />,
      },
      {
        label: "Acciones",
        render: (r) => {
          const states =
            r.direction === "RECEIVABLE"
              ? ({
                  PENDING: ["READY_TO_DEPOSIT", "CANCELLED"],
                  READY_TO_DEPOSIT: ["DEPOSITED", "CANCELLED"],
                  DEPOSITED: ["CLEARED", "BOUNCED"],
                  CLEARED: ["BOUNCED"],
                } as Record<string, string[]>)
              : ({
                  PENDING: ["DELIVERED", "CANCELLED"],
                  DELIVERED: ["CLEARED", "BOUNCED", "CANCELLED"],
                  CLEARED: ["BOUNCED"],
                } as Record<string, string[]>);
          return actionsCell(
            states[value(r, "status")]?.map((status) => (
              <Button
                size="sm"
                variant="outline"
                key={status}
                onClick={() =>
                  setAction({ kind: "check-transition", row: r, status })
                }
              >
                {labels[status]}
              </Button>
            )),
          );
        },
      },
    );
  }
  return (
    <div className="space-y-5">
      {error && <Notice error>{error}</Notice>}
      {message && (
        <p
          role="status"
          className="rounded-xl border bg-background p-3 text-sm"
        >
          {message}
        </p>
      )}
      {view === "summary" && (
        <label className="grid max-w-md gap-1 text-sm">
          Buscar proveedor para vincular compras pendientes
          <input
            className={fieldClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre o identificación"
          />
        </label>
      )}
      {view === "summary" ? (
        <TreasurySummary
          revision={revision}
          options={options.data}
          mutate={mutate}
          busy={busy}
        />
      ) : view === "portfolio/import" ? (
        <TreasuryImport
          kind="obligations"
          onDone={() => setRevision((n) => n + 1)}
        />
      ) : view === "banks/reconciliation" ? (
        <ReconciliationClient options={options.data} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {accountsView && (
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setAction({ kind: "account" })}
              >
                {view === "banks"
                  ? "Agregar cuenta bancaria"
                  : view === "cards"
                    ? "Agregar canal de tarjeta"
                    : "Agregar caja"}
              </Button>
            )}
            {movements && (
              <Button onClick={() => setAction({ kind: "manual" })}>
                {view.startsWith("cash")
                  ? "Ingreso / egreso"
                  : "Depósito / retiro"}
              </Button>
            )}
            {view === "banks/movements" && (
              <Button
                variant="outline"
                onClick={() => setAction({ kind: "transfer" })}
              >
                Transferencia interna
              </Button>
            )}
            {portfolio && (
              <Button onClick={() => setAction({ kind: "obligation" })}>
                Registrar obligación inicial
              </Button>
            )}
            {advances && (
              <Button onClick={() => setAction({ kind: "advance" })}>
                Registrar anticipo
              </Button>
            )}
            {view === "cards/movements" && (
              <Button onClick={() => setAction({ kind: "card-collection" })}>
                Registrar cobro con tarjeta
              </Button>
            )}
            {view === "cash/postdated-checks" && (
              <Button onClick={() => setAction({ kind: "check" })}>
                Registrar cheque
              </Button>
            )}
          </div>
          {(portfolio ||
            advances ||
            action?.kind === "obligation" ||
            action?.kind === "advance") && (
            <label className="grid max-w-md gap-1 text-sm">
              Buscar cliente/proveedor para los formularios
              <input
                className={fieldClass}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre o identificación"
              />
              <span className="text-xs text-muted-foreground">
                Se muestran hasta 100 coincidencias. Escribe para localizar otro
                tercero.
              </span>
            </label>
          )}
          {action && (
            <ActionForm
              key={`${action.kind}-${value(action.row, "id")}-${action.status ?? ""}`}
              title={formTitle}
              fields={fields}
              busy={busy}
              close={() => setAction(null)}
              help={help}
              submit={(body) =>
                mutate(formPath, {
                  ...body,
                  ...(action.kind === "account" && action.row
                    ? { id: action.row.id }
                    : {}),
                  ...(action.kind === "close"
                    ? { accountId: action.row?.id, action: "close" }
                    : {}),
                  ...(action.kind === "reverse" ? { id: action.row?.id } : {}),
                  ...(action.kind === "check-transition"
                    ? { status: action.status }
                    : {}),
                })
              }
            />
          )}
          <form
            className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-3"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters(
                Object.fromEntries(
                  new FormData(e.currentTarget).entries(),
                ) as Record<string, string>,
              );
              setPage(1);
            }}
          >
            <label className="grid gap-1 text-sm">
              {accountsView ? "Nombre" : "Documento / referencia / concepto"}
              <input className={fieldClass} name="q" />
            </label>
            {movements && (
              <>
                <label className="grid gap-1 text-sm">
                  Cuenta
                  <select className={fieldClass} name="accountId">
                    <option value="">Todas</option>
                    {accounts
                      .filter(
                        (a) =>
                          a.type ===
                          (view.startsWith("cash") ? "CASH" : "BANK"),
                      )
                      .map((a) => (
                        <option value={value(a, "id")} key={value(a, "id")}>
                          {value(a, "name")}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Dirección
                  <select className={fieldClass} name="direction">
                    <option value="">Todas</option>
                    <option value="IN">Entradas</option>
                    <option value="OUT">Salidas</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Tipo
                  <select className={fieldClass} name="movementType">
                    <option value="">Todos</option>
                    {[
                      "CASH_IN",
                      "CASH_OUT",
                      "SALE_COLLECTION",
                      "PURCHASE_PAYMENT",
                      "BANK_DEPOSIT",
                      "BANK_WITHDRAWAL",
                      "BANK_TRANSFER",
                      "CUSTOMER_ADVANCE",
                      "SUPPLIER_ADVANCE",
                      "CARD_SETTLEMENT",
                      "CARD_FEE",
                      "CHECK_CLEARED",
                      "CHECK_BOUNCED",
                      "ADJUSTMENT",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {labels[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Usuario
                  <select className={fieldClass} name="userId">
                    <option value="">Todos</option>
                    {options.data?.users.map((u) => (
                      <option key={value(u, "id")} value={value(u, "id")}>
                        {value(u, "name")}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {(portfolio || movements) && (
              <>
                <label className="grid gap-1 text-sm">
                  Desde
                  <input className={fieldClass} type="date" name="from" />
                </label>
                <label className="grid gap-1 text-sm">
                  Hasta
                  <input className={fieldClass} type="date" name="to" />
                </label>
              </>
            )}
            {portfolio && (
              <>
                <label className="grid gap-1 text-sm">
                  Tercero
                  <select className={fieldClass} name="partyId">
                    <option value="">Todos</option>
                    {parties.map((p) => (
                      <option key={value(p, "id")} value={value(p, "id")}>
                        {value(p, "name")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Vencimiento
                  <select className={fieldClass} name="due">
                    <option value="">Todos</option>
                    <option value="soon">Por vencer (7 días)</option>
                  </select>
                </label>
              </>
            )}
            {!accountsView && (
              <label className="grid gap-1 text-sm">
                Estado
                <select className={fieldClass} name="status">
                  <option value="">Todos</option>
                  {(portfolio
                    ? ["OPEN", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]
                    : advances
                      ? [
                          "AVAILABLE",
                          "PARTIALLY_APPLIED",
                          "APPLIED",
                          "CANCELLED",
                        ]
                      : view === "cards/movements"
                        ? ["PENDING", "SETTLED", "DISPUTED", "CANCELLED"]
                        : view === "cash/postdated-checks"
                          ? [
                              "PENDING",
                              "READY_TO_DEPOSIT",
                              "DEPOSITED",
                              "CLEARED",
                              "BOUNCED",
                              "CANCELLED",
                              "DELIVERED",
                            ]
                          : ["CONFIRMED", "RECONCILED"]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {labels[s]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {view === "cash/postdated-checks" && (
              <label className="grid gap-1 text-sm">
                Alerta
                <select className={fieldClass} name="alert">
                  <option value="">Todas</option>
                  <option value="soon">Por vencer</option>
                  <option value="today">Vence hoy</option>
                  <option value="overdue">Vencidos</option>
                </select>
              </label>
            )}
            <Button type="submit" variant="outline">
              Filtrar
            </Button>
          </form>
          {data.loading && (
            <p role="status" className="text-sm text-muted-foreground">
              Cargando Tesorería…
            </p>
          )}
          {data.error && <Notice error>{data.error}</Notice>}
          {data.data && (
            <DataTable
              data={data.data}
              columns={columns}
              page={page}
              setPage={setPage}
              empty={
                accountsView
                  ? "No tienes cuentas registradas. Usa el botón Agregar para comenzar."
                  : "No hay registros para estos filtros."
              }
            />
          )}
          {options.error && <Notice error>{options.error}</Notice>}
          {applications.error && <Notice error>{applications.error}</Notice>}
        </>
      )}
    </div>
  );
}

function TreasurySummary({
  revision,
  options,
  mutate,
  busy,
}: {
  revision: number;
  options: Options | null;
  mutate: (path: string, body: Row) => Promise<void>;
  busy: boolean;
}) {
  const summary = useResource<Record<string, string | number>>(
    `/api/treasury/summary?revision=${revision}`,
  );
  const [page, setPage] = useState(1);
  const sources = useResource<{
    sales: Row[];
    purchases: Row[];
    unlinkedPurchases?: Row[];
    hasMore?: boolean;
    activation: string | null;
  }>(`/api/treasury/sources?page=${page}&revision=${revision}`);
  return (
    <div className="space-y-5">
      {summary.error && <Notice error>{summary.error}</Notice>}
      {summary.loading && <p role="status">Cargando resumen…</p>}
      {summary.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["cash", "Efectivo disponible"],
            ["banks", "Bancos"],
            ["pendingCards", "Por acreditar tarjetas"],
            ["receivables", "CxC"],
            ["payables", "CxP"],
            ["customerAdvances", "Anticipos clientes"],
            ["supplierAdvances", "Anticipos proveedores"],
            ["dueChecks", "Cheques por vencer / vencidos"],
          ].map(([key, label]) => (
            <div
              className="space-y-2 rounded-xl border bg-background p-4"
              key={key}
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold tabular-nums">
                {key === "dueChecks"
                  ? summary.data?.[key]
                  : moneyLabel(summary.data?.[key])}
              </p>
            </div>
          ))}
        </div>
      )}
      <Notice>
        La integración automática empieza al crear la primera cuenta de
        Tesorería. Configura las cuentas predeterminadas y abre caja antes de
        operar. Los saldos anteriores se incorporan mediante saldo inicial e
        importación de obligaciones.
      </Notice>
      <section className="space-y-3">
        <h2 className="font-semibold">
          Pagos nuevos pendientes de asignar a una cuenta
        </h2>
        <p className="text-sm text-muted-foreground">
          Pagos comerciales ya registrados que aún no tienen movimiento de
          Tesorería. Asignar una cuenta reutiliza el pago existente.
        </p>
        {sources.error && <Notice error>{sources.error}</Notice>}
        {sources.data &&
          !sources.data.sales.length &&
          !sources.data.purchases.length && (
            <p className="text-sm text-muted-foreground">
              No hay pagos nuevos pendientes de asignación.
            </p>
          )}
        {sources.data &&
          [
            ...sources.data.sales.map<Row>((p) => ({ ...p, kind: "SALE" })),
            ...sources.data.purchases.map<Row>((p) => ({
              ...p,
              kind: "PURCHASE",
            })),
          ].map((payment) => (
            <form
              key={value(payment, "id")}
              className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const accountId = new FormData(event.currentTarget).get(
                  "accountId",
                );
                void mutate("sources/allocate", {
                  kind: payment.kind,
                  paymentId: payment.id,
                  accountId,
                });
              }}
            >
              <div className="min-w-48 flex-1 text-sm">
                {payment.kind === "SALE" ? "Cobro de venta" : "Pago de compra"}{" "}
                · {moneyLabel(payment.amount)} · {value(payment, "method")}
                <p className="font-mono text-xs text-muted-foreground">
                  {value(payment, "id")}
                </p>
              </div>
              <label className="grid gap-1 text-sm">
                Cuenta
                <select className={fieldClass} name="accountId" required>
                  <option value="">Seleccionar</option>
                  {options?.accounts
                    .filter(
                      (a) =>
                        a.type ===
                        (payment.method === "cash"
                          ? "CASH"
                          : payment.method === "card"
                            ? "CARD"
                            : "BANK"),
                    )
                    .map((a) => (
                      <option value={value(a, "id")} key={value(a, "id")}>
                        {value(a, "name")}
                      </option>
                    ))}
                </select>
              </label>
              <Button type="submit" variant="outline" disabled={busy}>
                Asignar
              </Button>
            </form>
          ))}
        {sources.data?.unlinkedPurchases?.map((purchase) => (
          <form
            key={value(purchase, "id")}
            className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void mutate("sources/create-payable", {
                purchaseId: purchase.id,
                supplierId: new FormData(event.currentTarget).get("supplierId"),
              });
            }}
          >
            <div className="min-w-48 flex-1 text-sm">
              Compra pendiente de vincular a CxP:{" "}
              {value(purchase, "documentNumber") || value(purchase, "id")} ·{" "}
              {moneyLabel(purchase.remainingBalance)}
              <p className="text-xs text-muted-foreground">
                {value(purchase, "supplierName")} ·{" "}
                {value(purchase, "supplierIdentification")}
              </p>
            </div>
            <label className="grid gap-1 text-sm">
              Proveedor registrado
              <select className={fieldClass} name="supplierId" required>
                <option value="">Seleccionar</option>
                {options?.suppliers
                  .filter(
                    (s) =>
                      !purchase.supplierIdentification ||
                      s.identification === purchase.supplierIdentification,
                  )
                  .map((s) => (
                    <option value={value(s, "id")} key={value(s, "id")}>
                      {value(s, "name")}
                    </option>
                  ))}
              </select>
            </label>
            <Button variant="outline" type="submit" disabled={busy}>
              Vincular y generar CxP
            </Button>
          </form>
        ))}
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((n) => n - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            disabled={!sources.data || !sources.data.hasMore}
            onClick={() => setPage((n) => n + 1)}
          >
            Siguiente
          </Button>
        </div>
      </section>
    </div>
  );
}
