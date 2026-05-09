"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type CustomerSnap = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  balance: number;
};

type SaleSnap = {
  id: string;
  total: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
};

type CommerceSummary = {
  totalSales: number;
  totalPurchased: number;
  pendingBalance: number;
  lastSaleAt: string | null;
  lastSaleId: string | null;
};

type CommerceData = {
  matchedCustomer: CustomerSnap | null;
  candidateCustomers: CustomerSnap[];
  summary: CommerceSummary | null;
  recentSales: SaleSnap[];
};

type LoadState = "idle" | "loading" | "done" | "error";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function paymentStatusLabel(status: string) {
  if (status === "paid") return "Pagado";
  if (status === "partial") return "Parcial";
  return "Pendiente";
}

function paymentStatusColor(status: string) {
  if (status === "paid") return "text-green-600";
  if (status === "partial") return "text-yellow-600";
  return "text-red-600";
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

type Props = {
  conversationId: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
};

export function CommercePanel({
  conversationId,
  contactName,
  contactPhone,
  contactEmail,
}: Props) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<CommerceData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formName, setFormName] = useState(contactName ?? "");
  const [formPhone, setFormPhone] = useState(contactPhone ?? "");
  const [formEmail, setFormEmail] = useState(contactEmail ?? "");

  const [prevId, setPrevId] = useState(conversationId);

  const load = useCallback(async () => {
    async function doLoad() {
      setLoadState("loading");
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (contactName) params.set("name", contactName);
        if (contactPhone) params.set("phone", contactPhone);
        if (contactEmail) params.set("email", contactEmail);
        const res = await fetch(
          `/api/conversations/${conversationId}/commerce?${params.toString()}`
        );
        const json = (await res.json()) as {
          success: boolean;
          data?: CommerceData;
          error?: { message: string };
        };
        if (!json.success) throw new Error(json.error?.message ?? "Error");
        setData(json.data ?? null);
        setLoadState("done");
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Error al cargar informacion comercial."
        );
        setLoadState("error");
      }
    }
    void doLoad();
  }, [conversationId, contactName, contactPhone, contactEmail]);

  if (prevId !== conversationId) {
    setPrevId(conversationId);
    setData(null);
    setLoadState("idle");
    setShowForm(false);
    setCreateError(null);
    setFormName(contactName ?? "");
    setFormPhone(contactPhone ?? "");
    setFormEmail(contactEmail ?? "");
  }

  useEffect(() => {
    void load();
  }, [load]);

  function handleCreate() {
    async function doCreate() {
      setCreating(true);
      setCreateError(null);
      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/commerce/customer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: formName.trim(),
              phone: formPhone.trim(),
              email: formEmail.trim(),
            }),
          }
        );
        const json = (await res.json()) as {
          success: boolean;
          data?: { customer: CustomerSnap; created: boolean };
          error?: { message: string };
        };
        if (!json.success) throw new Error(json.error?.message ?? "Error");
        setShowForm(false);
        void load();
      } catch (err) {
        setCreateError(
          err instanceof Error ? err.message : "No se pudo crear el cliente."
        );
      } finally {
        setCreating(false);
      }
    }
    void doCreate();
  }

  if (loadState === "loading") {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  if (loadState === "error") {
    return <p className="text-sm text-muted-foreground">{loadError}</p>;
  }

  if (!data) return null;

  const { matchedCustomer, candidateCustomers, summary, recentSales } = data;

  const createForm = showForm ? (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs font-semibold text-muted-foreground">Nuevo cliente</p>
      <input
        className="w-full rounded border px-2 py-1 text-sm"
        placeholder="Nombre"
        value={formName}
        onChange={(e) => setFormName(e.target.value)}
        maxLength={100}
      />
      <input
        className="w-full rounded border px-2 py-1 text-sm"
        placeholder="Teléfono"
        value={formPhone}
        onChange={(e) => setFormPhone(e.target.value)}
        maxLength={30}
      />
      <input
        className="w-full rounded border px-2 py-1 text-sm"
        placeholder="Email"
        value={formEmail}
        onChange={(e) => setFormEmail(e.target.value)}
        maxLength={100}
      />
      {createError && <p className="text-xs text-red-600">{createError}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={creating || (!formName.trim() && !formPhone.trim())}
          onClick={handleCreate}
        >
          {creating ? "Guardando..." : "Guardar"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setShowForm(false);
            setCreateError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  ) : null;

  // Matched customer
  if (matchedCustomer) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          <p className="font-semibold text-sm">{matchedCustomer.name}</p>
          {matchedCustomer.phone && (
            <p className="text-xs text-muted-foreground">{matchedCustomer.phone}</p>
          )}
          {matchedCustomer.email && (
            <p className="text-xs text-muted-foreground">{matchedCustomer.email}</p>
          )}
        </div>

        {summary && (
          <div className="space-y-2">
            <SummaryRow label="Ventas realizadas" value={String(summary.totalSales)} />
            <SummaryRow label="Total comprado" value={formatMoney(summary.totalPurchased)} />
            <SummaryRow label="Saldo pendiente" value={formatMoney(summary.pendingBalance)} />
            {summary.lastSaleAt && (
              <SummaryRow label="Última compra" value={formatDate(summary.lastSaleAt)} />
            )}
          </div>
        )}

        {recentSales.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Ventas recientes
            </p>
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{formatMoney(sale.total)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(sale.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium ${paymentStatusColor(sale.paymentStatus)}`}
                  >
                    {paymentStatusLabel(sale.paymentStatus)}
                  </span>
                  <Link
                    href={`/basic/sales/${sale.id}`}
                    className="text-xs text-primary underline-offset-2 hover:underline"
                  >
                    Ver
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este cliente aún no tiene ventas registradas.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href="/basic/customers">Ver cliente</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/basic/sales">Ver ventas</Link>
          </Button>
          <Button asChild size="sm" variant="default">
            <Link href={`/basic/pos?customerId=${matchedCustomer.id}`}>
              Crear venta
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Candidates
  if (candidateCustomers.length > 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Posibles coincidencias</p>
        <div className="space-y-2">
          {candidateCustomers.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.name}</p>
                {c.phone && (
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                )}
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/basic/customers">Ver cliente</Link>
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Si ninguno es el cliente, puedes crear uno nuevo.
        </p>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            Crear cliente
          </Button>
        )}
        {createForm}
      </div>
    );
  }

  // No customer
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Este contacto aún no está registrado como cliente.
      </p>
      {!showForm && (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          Crear cliente
        </Button>
      )}
      {createForm}
    </div>
  );
}
