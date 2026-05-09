"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SimpleReceipt } from "@/components/appsolux/basic/simple-receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [paidAmount, setPaidAmount] = useState("");
  const [search, setSearch] = useState("");
  const [lastSale, setLastSale] = useState<SaleResponse | null>(null);
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
          items: cart,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        sale?: SaleResponse;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo confirmar venta.");
      }

      setCart([]);
      setCustomerId("");
      setPaidAmount("");
      setLastSale(result.sale ?? null);
      setMessage("Venta confirmada.");
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
      {lastSale ? <SimpleReceipt tenantName={tenantName} sale={lastSale} /> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto o codigo"
          />

          <div className="grid gap-3 md:grid-cols-2">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product.id)}
                className="rounded-md border p-3 text-left text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading || product.stock <= 0}
              >
                <span className="block font-medium">{product.name}</span>
                <span className="text-muted-foreground">
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

        <div className="space-y-4 rounded-md border p-4">
          <div>
            <p className="text-sm font-medium">Carrito</p>
            <p className="text-xs text-muted-foreground">
              Total: ${total.toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            {cart.map((item) => {
              const product = productById.get(item.productId);

              return (
                <div key={item.productId} className="grid grid-cols-[1fr_80px] gap-2">
                  <div>
                    <p className="text-sm">{product?.name}</p>
                    <p className="text-xs text-muted-foreground">
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
              <p className="text-xs text-muted-foreground">
                Cliente seleccionado desde conversacion.
              </p>
            )}
            <select
              id="customerId"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
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
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
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
              <p className="text-xs text-muted-foreground">
                El total quedara pendiente en el saldo del cliente.
              </p>
            ) : null}
          </div>

          <Button
            type="button"
            onClick={submitSale}
            disabled={isLoading || cart.length === 0}
            className="w-full"
          >
            {isLoading ? "Confirmando..." : "Confirmar venta"}
          </Button>

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
