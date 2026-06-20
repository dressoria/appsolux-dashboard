"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  ReceiptText,
  UserPlus,
  X,
} from "lucide-react";

import { SimpleReceipt } from "@/components/appsolux/basic/simple-receipt";
import {
  CheckoutModeCard,
  SaleStatusBadge,
} from "@/components/appsolux/basic/sales-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";

type Product = {
  id: string;
  name: string;
  price: string;
  stock: number;
  barcode?: string | null;
};

type Customer = {
  id: string;
  name: string;
};

type CartItem = {
  productId: string;
  quantity: number;
};

type SaleResponse = {
  id: string;
  createdAt: string;
  total: string;
  status: string;
  paymentStatus: string;
  customer?: { name: string } | null;
  items: Array<{
    quantity: number;
    price: string;
    total: string;
    product: { name: string };
  }>;
  payments: Array<{
    method: string;
    amount: string;
  }>;
};

type SaleOutputResult = {
  mode: "internal_receipt" | "sri_invoice";
  status: "completed" | "partial";
  saleId: string;
  errorMessage?: string;
  sri?: {
    documentId: string;
    flowState: "preparing" | "sending" | "received" | "authorized" | "rejected";
    flowLabel: string;
    message: string;
    documentStatus: string;
  };
};

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export function BasicPosClient({
  tenantName,
  products,
  customers: initialCustomers,
  initialCustomerId,
  hasSriConfig = false,
}: {
  tenantName: string;
  products: Product[];
  customers: Customer[];
  initialCustomerId?: string;
  hasSriConfig?: boolean;
}) {
  const router = useRouter();

  // Cart & sale state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [outputMode, setOutputMode] = useState<"internal_receipt" | "sri_invoice">("internal_receipt");
  const [paidAmount, setPaidAmount] = useState("");
  const [search, setSearch] = useState("");
  const [lastSale, setLastSale] = useState<SaleResponse | null>(null);
  const [lastOutput, setLastOutput] = useState<SaleOutputResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  // Transfer fields (UI-only — no DB field available without migration)
  const [transferBank, setTransferBank] = useState("");
  const [transferRef, setTransferRef] = useState("");

  // Customer state — mutable so new customers can be added from the modal
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);

  // Quick-create customer modal
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddr, setNewCustomerAddr] = useState("");
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState("");

  const productById = new Map(products.map((p) => [p.id, p]));
  const total = cart.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return sum + toNumber(product?.price ?? 0) * item.quantity;
  }, 0);
  const filteredProducts = products.filter((product) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      product.name.toLowerCase().includes(term) ||
      (product.barcode ?? "").toLowerCase().includes(term)
    );
  });

  const creditWithoutCustomer = paymentMethod === "credit" && !customerId;
  const sriNotReady = outputMode === "sri_invoice" && !hasSriConfig;

  function addProduct(productId: string) {
    setError("");
    setCart((current) => {
      const product = productById.get(productId);
      if (!product || product.stock <= 0) return current;

      const existing = current.find((item) => item.productId === productId);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setError(`Stock insuficiente para ${product.name}.`);
          return current;
        }
        return current.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { productId, quantity: 1 }];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((current) => current.filter((item) => item.productId !== productId));
      return;
    }
    const product = productById.get(productId);
    const safeQuantity = product ? Math.min(quantity, product.stock) : quantity;
    setCart((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, quantity: safeQuantity } : item
      )
    );
  }

  async function submitSale() {
    setIsLoading(true);
    setError("");

    try {
      if (creditWithoutCustomer) {
        throw new Error("Para vender a crédito debes seleccionar o crear un cliente.");
      }

      for (const item of cart) {
        const product = productById.get(item.productId);
        if (!product || item.quantity > product.stock) {
          throw new Error(`Stock insuficiente para ${product?.name ?? "producto"}.`);
        }
      }

      const response = await fetch("/api/basic/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          paymentMethod,
          paidAmount:
            paymentMethod === "credit" ? 0 : paidAmount ? Number(paidAmount) : total,
          outputMode,
          items: cart,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        sale?: SaleResponse;
        output?: SaleOutputResult;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo confirmar venta.");
      }

      setCart([]);
      setCustomerId("");
      setPaidAmount("");
      setTransferBank("");
      setTransferRef("");
      setShowReceipt(false);
      setLastSale(result.sale ?? null);
      setLastOutput(result.output ?? null);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "No se pudo confirmar venta."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNewCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewCustomerLoading(true);
    setNewCustomerError("");

    try {
      const response = await fetch("/api/basic/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || undefined,
          email: newCustomerEmail.trim() || undefined,
          address: newCustomerAddr.trim() || undefined,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        customer?: Customer;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo crear cliente.");
      }

      if (result.customer) {
        setCustomers((prev) => [...prev, result.customer!]);
        setCustomerId(result.customer.id);
      }

      setShowNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      setNewCustomerAddr("");
    } catch (err) {
      setNewCustomerError(err instanceof Error ? err.message : "No se pudo crear cliente.");
    } finally {
      setNewCustomerLoading(false);
    }
  }

  function startNewSale() {
    setLastSale(null);
    setLastOutput(null);
    setShowReceipt(false);
    setError("");
  }

  return (
    <div className="space-y-4">

      {/* Quick-create customer modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Nuevo cliente</h3>
              <button
                type="button"
                onClick={() => setShowNewCustomer(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleNewCustomer} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nc-name">Nombre / Razón social</Label>
                <Input
                  id="nc-name"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  required
                  disabled={newCustomerLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-phone">Teléfono</Label>
                <Input
                  id="nc-phone"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="0999000000"
                  disabled={newCustomerLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-email">Email</Label>
                <Input
                  id="nc-email"
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  disabled={newCustomerLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-addr">Dirección</Label>
                <Input
                  id="nc-addr"
                  value={newCustomerAddr}
                  onChange={(e) => setNewCustomerAddr(e.target.value)}
                  placeholder="Opcional"
                  disabled={newCustomerLoading}
                />
              </div>
              {newCustomerError && (
                <p className="text-sm text-destructive">{newCustomerError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={newCustomerLoading}
                  className="flex-1 bg-[#004080] hover:bg-[#003060]"
                >
                  {newCustomerLoading ? "Guardando..." : "Crear cliente"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCustomer(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compact success strip */}
      {lastOutput && lastSale ? (
        <div className="space-y-3 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">
                {lastOutput.mode === "sri_invoice"
                  ? lastOutput.status === "partial"
                    ? "Venta creada · Factura SRI con observaciones"
                    : "Venta finalizada · Factura SRI iniciada"
                  : "Venta finalizada · Recibo interno listo"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lastOutput.mode === "internal_receipt" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowReceipt((v) => !v)}
                >
                  {showReceipt ? "Ocultar recibo" : "Ver recibo"}
                </Button>
              )}
              {lastOutput.mode === "sri_invoice" && lastOutput.sri?.documentId && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/sri/documents/${lastOutput.sri.documentId}`}>
                    Ver factura SRI
                  </Link>
                </Button>
              )}
              <Button asChild size="sm" variant="outline">
                <Link href={`/basic/sales/${lastSale.id}`}>Ver venta</Link>
              </Button>
              <Button
                size="sm"
                className="bg-[#004080] hover:bg-[#003060]"
                onClick={startNewSale}
              >
                Nueva venta
              </Button>
            </div>
          </div>

          {lastOutput.mode === "sri_invoice" &&
            lastOutput.status === "partial" &&
            lastOutput.errorMessage && (
              <p className="text-xs text-amber-700">{lastOutput.errorMessage}</p>
            )}

          {showReceipt && lastOutput.mode === "internal_receipt" && (
            <div className="pt-1">
              <SimpleReceipt tenantName={tenantName} sale={lastSale} />
            </div>
          )}
        </div>
      ) : null}

      {/* POS grid — always visible so user can start next sale immediately */}
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">

        {/* Left: product search + grid */}
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-medium text-slate-900">Productos</Label>
              <SaleStatusBadge
                label={`${filteredProducts.length} disponibles`}
                variant="info"
              />
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar producto o codigo"
              className="rounded-2xl border-slate-200 bg-white"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product.id)}
                className="rounded-[22px] border border-slate-200 bg-white p-4 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading || product.stock <= 0}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="block font-medium text-slate-900">{product.name}</span>
                    <span className="text-slate-500">
                      ${toNumber(product.price).toFixed(2)} · stock {product.stock}
                    </span>
                  </div>
                  <SaleStatusBadge
                    label={product.stock > 0 ? "Disponible" : "Agotado"}
                    variant={product.stock > 0 ? "success" : "danger"}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">Toca para agregar al carrito.</p>
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay productos disponibles.</p>
          ) : null}
        </div>

        {/* Right: cart + checkout */}
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">

          {/* Cart */}
          <div>
            <p className="text-sm font-medium text-slate-900">Carrito</p>
            <p className="text-xs text-slate-500">Total: ${total.toFixed(2)}</p>
          </div>

          <div className="space-y-2">
            {cart.map((item) => {
              const product = productById.get(item.productId);
              return (
                <div key={item.productId} className="grid grid-cols-[1fr_80px] gap-2">
                  <div>
                    <p className="text-sm text-slate-900">{product?.name}</p>
                    <p className="text-xs text-slate-500">Max {product?.stock ?? 0}</p>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    max={product?.stock ?? undefined}
                    value={item.quantity}
                    onChange={(event) =>
                      updateQuantity(item.productId, Number(event.target.value))
                    }
                  />
                </div>
              );
            })}
          </div>

          {/* Customer selector + quick-create */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="customerId">Cliente</Label>
              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="flex items-center gap-1 text-xs text-[#004080] hover:text-[#003060]"
              >
                <UserPlus className="h-3 w-3" />
                Nuevo cliente
              </button>
            </div>
            {initialCustomerId && customerId === initialCustomerId && (
              <p className="text-xs text-slate-500">
                Cliente seleccionado desde conversacion.
              </p>
            )}
            <select
              id="customerId"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Consumidor final</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>

            {creditWithoutCustomer && (
              <p className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="h-3 w-3 shrink-0" />
                Para vender a crédito debes seleccionar o crear un cliente.
              </p>
            )}
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Método de pago</Label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
              <option value="credit">Fiado / Crédito</option>
            </select>
          </div>

          {/* Transfer fields — UI reference only, no DB field available */}
          {paymentMethod === "transfer" && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-xs font-medium text-slate-600">Datos de transferencia</p>
              <div className="space-y-1.5">
                <Label htmlFor="transferBank">Banco</Label>
                <Input
                  id="transferBank"
                  value={transferBank}
                  onChange={(e) => setTransferBank(e.target.value)}
                  placeholder="Ej. Banco Pichincha"
                  className="bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transferRef">Número / referencia</Label>
                <Input
                  id="transferRef"
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                  placeholder="Ej. 00123456"
                  className="bg-white"
                />
              </div>
              <p className="text-xs text-slate-400">
                Referencia visual — no se almacena en esta versión.
              </p>
            </div>
          )}

          {/* Paid amount */}
          <div className="space-y-2">
            <Label htmlFor="paidAmount">Monto pagado</Label>
            <Input
              id="paidAmount"
              type="number"
              step="0.01"
              min="0"
              value={paidAmount}
              placeholder={total.toFixed(2)}
              onChange={(event) => setPaidAmount(event.target.value)}
              disabled={paymentMethod === "credit"}
            />
            {paymentMethod === "credit" ? (
              <p className="text-xs text-slate-500">
                El total quedará pendiente en el saldo del cliente.
              </p>
            ) : null}
          </div>

          {/* Sale output mode */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-medium text-slate-900">Salida de la venta</Label>
              <SaleStatusBadge
                label={outputMode === "sri_invoice" ? "Factura SRI" : "Recibo interno"}
                variant={outputMode === "sri_invoice" ? "info" : "success"}
              />
            </div>
            <div className="grid gap-3">
              <CheckoutModeCard
                title="Generar recibo interno"
                description="Confirma la venta, descuenta inventario y entrega un recibo operativo sin enviarlo al SRI."
                selected={outputMode === "internal_receipt"}
                icon={ReceiptText}
                status="Rápido"
                onSelect={() => setOutputMode("internal_receipt")}
              />
              <CheckoutModeCard
                title="Emitir factura electrónica SRI"
                description="Usa la misma venta como origen y arranca el flujo SRI sin mostrar pasos técnicos al usuario."
                selected={outputMode === "sri_invoice"}
                icon={FileCheck2}
                status="Con SRI"
                onSelect={() => setOutputMode("sri_invoice")}
              />
            </div>

            {/* SRI not configured warning */}
            {sriNotReady && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Falta configurar SRI para emitir factura electrónica.
                </p>
                <p className="text-xs text-amber-700">
                  Configura empresa, RUC, firma, establecimiento y secuencial antes de emitir.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-800 hover:bg-amber-100"
                  >
                    <Link href={routes.sri}>Configurar SRI</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOutputMode("internal_receipt")}
                  >
                    Usar recibo interno
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button
            type="button"
            onClick={submitSale}
            disabled={isLoading || cart.length === 0 || creditWithoutCustomer}
            className="w-full"
          >
            {isLoading
              ? "Finalizando..."
              : outputMode === "sri_invoice"
                ? "Finalizar venta con factura SRI"
                : "Finalizar venta con recibo"}
          </Button>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-sky-100 p-2.5 text-sky-700">
                {outputMode === "sri_invoice" ? (
                  <FileCheck2 className="h-5 w-5" />
                ) : (
                  <ReceiptText className="h-5 w-5" />
                )}
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-medium text-slate-900">
                  {outputMode === "sri_invoice"
                    ? "La venta descuenta inventario y prepara la factura SRI."
                    : "La venta descuenta inventario y genera un recibo interno."}
                </p>
                <p className="text-slate-600">
                  En ambos casos se registra la venta, el historial y la trazabilidad del cliente.
                </p>
              </div>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
