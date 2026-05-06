"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Product = {
  id: string;
  name: string;
  price: unknown;
  stock: number;
};

type Customer = {
  id: string;
  name: string;
};

type CartItem = {
  productId: string;
  quantity: number;
};

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export function BasicPosClient({
  products,
  customers,
}: {
  products: Product[];
  customers: Customer[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const total = cart.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return sum + toNumber(product?.price) * item.quantity;
  }, 0);

  function addProduct(productId: string) {
    setCart((current) => {
      const existing = current.find((item) => item.productId === productId);

      if (existing) {
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

    setCart((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  }

  async function submitSale() {
    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/basic/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          paymentMethod,
          paidAmount: paidAmount ? Number(paidAmount) : total,
          items: cart,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo confirmar venta.");
      }

      setCart([]);
      setCustomerId("");
      setPaidAmount("");
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
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-3 md:grid-cols-2">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => addProduct(product.id)}
            className="rounded-md border p-3 text-left text-sm transition hover:bg-muted"
            disabled={isLoading || product.stock <= 0}
          >
            <span className="block font-medium">{product.name}</span>
            <span className="text-muted-foreground">
              ${toNumber(product.price).toFixed(2)} · stock {product.stock}
            </span>
          </button>
        ))}
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
                <p className="text-sm">{product?.name}</p>
                <Input
                  type="number"
                  min="0"
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
  );
}
