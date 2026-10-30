"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditableNumberInput } from "./editable-number-input";
import { COMMERCIAL_LABELS } from "@/lib/core/payment-method-labels";

export type TreasuryAccountOption = {
  id: string;
  name: string;
  type: "CASH" | "BANK" | "CARD";
  bankName: string | null;
  provider: string | null;
  balance: string;
};

export type PaymentEntry = {
  method: string;
  accountId: string;
  accountName: string;
  amount: number;
  referenceNumber: string;
  batchNumber: string;
  voucherNumber: string;
  dueDate: string;
};

type Props = {
  method: string;
  accounts: TreasuryAccountOption[];
  invoiceTotal: number;
  pendingAmount: number;
  customerName: string | null;
  hasCustomer: boolean;
  onSave: (entry: PaymentEntry) => void;
  onClose: () => void;
};

const METHOD_CONFIG: Record<string, {
  title: string;
  notice: string;
  accountType: "CASH" | "BANK" | "CARD" | null;
  accountLabel: string;
  requiresReference: boolean;
  referenceLabel: string;
  requiresBatch: boolean;
  requiresVoucher: boolean;
  requiresDueDate: boolean;
}> = {
  cash: {
    title: "Forma de Pago - EFECTIVO",
    notice: "Para pagos en efectivo debe seleccionar la caja donde ingresará el dinero.",
    accountType: "CASH",
    accountLabel: "Seleccione una caja",
    requiresReference: false,
    referenceLabel: "",
    requiresBatch: false,
    requiresVoucher: false,
    requiresDueDate: false,
  },
  check: {
    title: "Forma de Pago - CHEQUE",
    notice: "Para pagos con cheque debe seleccionar la caja e ingresar el número de cheque.",
    accountType: "CASH",
    accountLabel: "Seleccione una caja",
    requiresReference: true,
    referenceLabel: "Número de cheque",
    requiresBatch: false,
    requiresVoucher: false,
    requiresDueDate: false,
  },
  deposit: {
    title: "Forma de Pago - DEPOSITO",
    notice: "Para pagos con depósito debe seleccionar el banco e ingresar el número de depósito.",
    accountType: "BANK",
    accountLabel: "Seleccione un banco",
    requiresReference: true,
    referenceLabel: "Número de depósito",
    requiresBatch: false,
    requiresVoucher: false,
    requiresDueDate: false,
  },
  transfer: {
    title: "Forma de Pago - TRANSFERENCIA",
    notice: "Para pagos con transferencia debe seleccionar el banco e ingresar el número de transferencia.",
    accountType: "BANK",
    accountLabel: "Seleccione un banco",
    requiresReference: true,
    referenceLabel: "Número de transferencia",
    requiresBatch: false,
    requiresVoucher: false,
    requiresDueDate: false,
  },
  debit_card: {
    title: "Forma de Pago - DEBITO",
    notice: "Para pagos con tarjeta de débito debe seleccionar el banco e ingresar el número de débito.",
    accountType: "BANK",
    accountLabel: "Seleccione un banco",
    requiresReference: true,
    referenceLabel: "Número de débito",
    requiresBatch: false,
    requiresVoucher: false,
    requiresDueDate: false,
  },
  credit_card: {
    title: "Forma de Pago - TARJETA",
    notice: "Para pagos con tarjeta de crédito debe seleccionar la tarjeta e ingresar lote y voucher.",
    accountType: "CARD",
    accountLabel: "Seleccione una tarjeta",
    requiresReference: false,
    referenceLabel: "",
    requiresBatch: true,
    requiresVoucher: true,
    requiresDueDate: false,
  },
  credit: {
    title: "Forma de Pago - CREDITO",
    notice: "Para pagos a crédito debe ingresar la fecha de vencimiento.",
    accountType: null,
    accountLabel: "",
    requiresReference: false,
    referenceLabel: "",
    requiresBatch: false,
    requiresVoucher: false,
    requiresDueDate: true,
  },
};

export function PaymentModal({ method, accounts, invoiceTotal, pendingAmount, customerName, hasCustomer, onSave, onClose }: Props) {
  const config = METHOD_CONFIG[method];
  if (!config) return null;

  const filteredAccounts = useMemo(
    () => config.accountType ? accounts.filter((a) => a.type === config.accountType) : [],
    [accounts, config.accountType],
  );

  const [accountId, setAccountId] = useState(() =>
    filteredAccounts.length === 1 ? filteredAccounts[0].id : "",
  );
  const [amount, setAmount] = useState(pendingAmount);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [voucherNumber, setVoucherNumber] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  useEffect(() => {
    if (filteredAccounts.length === 1 && !accountId) {
      setAccountId(filteredAccounts[0].id);
    }
  }, [filteredAccounts, accountId]);

  const selectedAccount = filteredAccounts.find((a) => a.id === accountId);

  function canSave(): boolean {
    if (amount <= 0) return false;
    if (config.accountType && !accountId) return false;
    if (config.requiresReference && !referenceNumber.trim()) return false;
    if (config.requiresBatch && !batchNumber.trim()) return false;
    if (config.requiresVoucher && !voucherNumber.trim()) return false;
    if (config.requiresDueDate && !dueDate) return false;
    if (method === "credit" && !hasCustomer) return false;
    return true;
  }

  function handleSave() {
    if (!canSave()) return;
    onSave({
      method,
      accountId: accountId || "",
      accountName: selectedAccount?.name ?? (method === "credit" ? "Crédito" : ""),
      amount,
      referenceNumber: referenceNumber.trim(),
      batchNumber: batchNumber.trim(),
      voucherNumber: voucherNumber.trim(),
      dueDate: config.requiresDueDate ? dueDate : "",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-semibold text-[#172033]">{config.title}</h3>
        <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{config.notice}</p>

        <div className="space-y-3">
          {config.accountType && (
            <>
              <div>
                <Label>{config.accountLabel}</Label>
                <select
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-sm"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">— Seleccionar —</option>
                  {filteredAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.bankName ? ` · ${a.bankName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {selectedAccount && (
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">Saldo</span>
                  <span className="font-medium">${selectedAccount.balance}</span>
                </div>
              )}
            </>
          )}

          {method === "credit" && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-500">Cliente: </span>
              <span className="font-medium">{hasCustomer ? customerName : "No seleccionado"}</span>
              {!hasCustomer && (
                <p className="mt-1 text-xs text-red-600">No se permite crédito a Consumidor Final.</p>
              )}
            </div>
          )}

          {config.requiresReference && (
            <div>
              <Label>{config.referenceLabel}</Label>
              <Input className="mt-1" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
            </div>
          )}

          {config.requiresBatch && (
            <div>
              <Label>Número de lote</Label>
              <Input className="mt-1" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
            </div>
          )}

          {config.requiresVoucher && (
            <div>
              <Label>Número de voucher</Label>
              <Input className="mt-1" value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)} />
            </div>
          )}

          {config.requiresDueDate && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dueDate === new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const d = new Date();
                      setDueDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
                    }
                  }}
                  className="size-4 rounded border-slate-300"
                />
                Vence hoy
              </label>
              <div>
                <Label>Fecha de vencimiento</Label>
                <Input className="mt-1" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </>
          )}

          <div>
            <Label>Valor</Label>
            <EditableNumberInput
              className="mt-1"
              value={amount}
              onChange={setAmount}
              min={0.01}
              step="0.01"
              fallback={pendingAmount}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="bg-[#1E52F1] text-white" disabled={!canSave()} onClick={handleSave}>Guardar</Button>
        </div>
      </div>
    </div>
  );
}

export function MultiplePaymentModal({
  accounts,
  invoiceTotal,
  customerName,
  hasCustomer,
  initialPayments,
  onSave,
  onClose,
}: {
  accounts: TreasuryAccountOption[];
  invoiceTotal: number;
  customerName: string | null;
  hasCustomer: boolean;
  initialPayments: PaymentEntry[];
  onSave: (payments: PaymentEntry[]) => void;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<PaymentEntry[]>(initialPayments);
  const [addingMethod, setAddingMethod] = useState<string | null>(null);

  const assigned = payments.reduce((s, p) => s + p.amount, 0);
  const pending = Math.max(0, invoiceTotal - assigned);

  function addPayment(entry: PaymentEntry) {
    setPayments((prev) => [...prev, entry]);
    setAddingMethod(null);
  }

  function removePayment(index: number) {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }

  const canSave = Math.abs(assigned - invoiceTotal) < 0.005 ||
    (assigned < invoiceTotal && payments.some((p) => p.method === "credit"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl rounded-xl border bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-[#172033]">Formas de pago</h3>

        <div className="mb-4 flex gap-4 rounded-lg bg-slate-50 p-3 text-sm">
          <div><span className="text-slate-500">Total:</span> <b>${invoiceTotal.toFixed(2)}</b></div>
          <div><span className="text-slate-500">Asignado:</span> <b>${assigned.toFixed(2)}</b></div>
          <div><span className="text-slate-500">Pendiente:</span> <b>${pending.toFixed(2)}</b></div>
        </div>

        {payments.length > 0 && (
          <div className="mb-4 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Método</th>
                  <th className="px-3 py-2 font-medium">Cuenta</th>
                  <th className="px-3 py-2 font-medium">Referencia</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{COMMERCIAL_LABELS[p.method] ?? p.method}</td>
                    <td className="px-3 py-2">{p.accountName || "—"}</td>
                    <td className="px-3 py-2">{p.referenceNumber || p.batchNumber || "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">${p.amount.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="icon-sm" onClick={() => removePayment(i)}>✕</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {addingMethod ? (
          <PaymentModal
            method={addingMethod}
            accounts={accounts}
            invoiceTotal={invoiceTotal}
            pendingAmount={pending}
            customerName={customerName}
            hasCustomer={hasCustomer}
            onSave={addPayment}
            onClose={() => setAddingMethod(null)}
          />
        ) : (
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="self-center text-sm text-slate-500">+ Agregar:</span>
            {PAYMENT_METHODS.map((m) => (
              <Button key={m.value} variant="outline" size="sm" onClick={() => setAddingMethod(m.value)}>
                {m.label}
              </Button>
            ))}
          </div>
        )}

        {assigned > invoiceTotal + 0.005 && (
          <p className="mb-3 text-sm text-red-600">
            El monto asignado (${assigned.toFixed(2)}) supera el total de la factura (${invoiceTotal.toFixed(2)}).
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            className="bg-[#1E52F1] text-white"
            disabled={!canSave}
            onClick={() => onSave(payments)}
          >
            Confirmar pagos
          </Button>
        </div>
      </div>
    </div>
  );
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "check", label: "Cheque" },
  { value: "deposit", label: "Depósito" },
  { value: "transfer", label: "Transferencia" },
  { value: "debit_card", label: "Débito" },
  { value: "credit_card", label: "Tarjeta" },
  { value: "credit", label: "Crédito" },
];

export { COMMERCIAL_LABELS, COMMERCIAL_TO_SRI } from "@/lib/core/payment-method-labels";
