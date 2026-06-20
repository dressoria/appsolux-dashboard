"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  FileCheck2,
  ReceiptText,
} from "lucide-react";

import { SimpleReceipt } from "@/components/appsolux/basic/simple-receipt";
import {
  CheckoutModeCard,
  SaleCompletionPanel,
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
  customers,
  initialCustomerId,
}: {
  tenantName: string;
  products: Product[];
  customers: Customer[];
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [outputMode, setOutputMode] = useState<"internal_receipt" | "sri_invoice">("internal_receipt");
  const [paidAmount, setPaidAmount] = useState("");
  const [search, setSearch] = useState("");
  const [lastSale, setLastSale] = useState<SaleResponse | null>(null);
  const [lastOutput, setLastOutput] = useState<SaleOutputResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const total = cart.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return sum + toNumber(product?.price ?? 0) * item.quantity;
  }, 0);
  const filteredProducts = products.filter((product) => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return true;
    }

    return (
      product.name.toLowerCase().includes(term) ||
      (product.barcode ?? "").toLowerCase().includes(term)
    );
  });

  function addProduct(productId: string) {
    setError("");
    setCart((current) => {
      const product = productById.get(productId);

      if (!product || product.stock <= 0) {
        return current;
      }

      const existing = current.find((item) => item.productId === productId);

      if (existing) {
        if (existing.quantity >= product.stock) {
          setError(`Stock insuficiente para ${product.name}.`);
          return current;
        }

        return current.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
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
    setMessage("");
    setError("");
    setLastSale(null);
    setLastOutput(null);

    try {
      if (paymentMethod === "credit" && !customerId) {
        throw new Error("Las ventas fiadas requieren seleccionar cliente.");
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
            paymentMethod === "credit"
              ? 0
              : paidAmount
                ? Number(paidAmount)
                : total,
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
      setLastSale(result.sale ?? null);
      setLastOutput(result.output ?? null);
      setMessage(
        result.output?.mode === "sri_invoice"
          ? result.output.status === "partial"
            ? "Venta registrada. La factura SRI requiere revision adicional."
            : "Venta registrada e inicio de factura SRI solicitado."
          : "Venta confirmada. Recibo interno disponible."
      );
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo confirmar venta."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {lastOutput && lastSale ? (
        <SaleCompletionPanel
          title={
            lastOutput.mode === "sri_invoice"
              ? "Venta finalizada con factura SRI"
              : "Venta finalizada con recibo interno"
          }
          description={
            lastOutput.mode === "sri_invoice"
              ? lastOutput.status === "partial"
                ? lastOutput.errorMessage ??
                  "La venta se guardo correctamente, pero la factura SRI no pudo arrancar por completo."
                : lastOutput.sri?.message ??
                  "La venta ya quedo registrada y el flujo SRI se inicio."
              : "La venta ya quedo registrada, el stock se desconto y el recibo interno esta listo."
          }
          badges={[
            {
              label:
                lastOutput.mode === "sri_invoice"
                  ? lastOutput.sri?.flowLabel ?? "Preparando"
                  : "Recibo interno",
              variant:
                lastOutput.mode === "sri_invoice"
                  ? lastOutput.status === "partial"
                    ? "warning"
                    : "info"
                  : "success",
            },
            {
              label: `Venta #${lastSale.id.slice(-8)}`,
              variant: "neutral",
            },
          ]}
          primaryHref={`/basic/sales/${lastSale.id}`}
          primaryLabel="Ver venta"
          secondaryHref={
            lastOutput.mode === "sri_invoice" && lastOutput.sri?.documentId
              ? `/sri/documents/${lastOutput.sri.documentId}`
              : routes.basicSales
          }
          secondaryLabel={
            lastOutput.mode === "sri_invoice" && lastOutput.sri?.documentId
              ? "Ver factura SRI"
              : "Ver ventas"
          }
        />
      ) : null}

      {lastSale && lastOutput?.mode === "internal_receipt" ? (
        <SimpleReceipt tenantName={tenantName} sale={lastSale} />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
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
                <p className="mt-3 text-xs text-slate-500">
                  Toca para agregar al carrito.
                </p>
                <span className="sr-only">
                  ${toNumber(product.price).toFixed(2)} · stock {product.stock}
                </span>
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay productos disponibles.
            </p>
          ) : null}
        </div>

        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-900">Carrito</p>
            <p className="text-xs text-slate-500">
              Total: ${total.toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            {cart.map((item) => {
              const product = productById.get(item.productId);

              return (
                <div key={item.productId} className="grid grid-cols-[1fr_80px] gap-2">
                  <div>
                    <p className="text-sm text-slate-900">{product?.name}</p>
                    <p className="text-xs text-slate-500">
                      Max {product?.stock ?? 0}
                    </p>
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

          <div className="space-y-2">
            <Label htmlFor="customerId">Cliente</Label>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Metodo de pago</Label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
              <option value="credit">Fiado/credito</option>
            </select>
          </div>

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
                El total quedara pendiente en el saldo del cliente.
              </p>
            ) : null}
          </div>

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
                status="Rapido"
                onSelect={() => setOutputMode("internal_receipt")}
              />
              <CheckoutModeCard
                title="Emitir factura electronica SRI"
                description="Usa la misma venta como origen y arranca el flujo SRI sin mostrar pasos tecnicos al usuario."
                selected={outputMode === "sri_invoice"}
                icon={FileCheck2}
                status="Con SRI"
                onSelect={() => setOutputMode("sri_invoice")}
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={submitSale}
            disabled={isLoading || cart.length === 0}
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

          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
