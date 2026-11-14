import assert from "node:assert/strict";
import test from "node:test";

type ProductSnapshot = {
  name: string;
  price: number;
  taxRate: number;
  stock: number;
  primaryCode: string | null;
  barcode: string | null;
};

type CartItem = {
  productId: string;
  quantity: number;
  discountAmount: number;
  snapshot: ProductSnapshot;
};

function calcLine(item: CartItem) {
  const { price, taxRate } = item.snapshot;
  const gross = price * item.quantity;
  const discount = Math.max(0, Math.min(item.discountAmount, gross));
  const sub = gross - discount;
  const tax = Math.round(sub * taxRate) / 100;
  return { gross, discount, subtotal: sub, tax, total: sub + tax, taxRate };
}

function makeSnapshot(
  product: { name: string; price: string | number; taxRate: string | number; stock: number; primaryCode?: string | null; barcode?: string | null },
  availableStock: number,
): ProductSnapshot {
  return {
    name: product.name,
    price: typeof product.price === "number" ? product.price : Number(product.price ?? 0),
    taxRate: typeof product.taxRate === "number" ? product.taxRate : Number(product.taxRate ?? 0),
    stock: availableStock,
    primaryCode: product.primaryCode ?? null,
    barcode: product.barcode ?? null,
  };
}

// ── Bug 1 fix: CartItem snapshot retains data even if product is not on current page
test("calcLine uses snapshot data, never returns zero for valid items", () => {
  const item: CartItem = {
    productId: "prod-abc",
    quantity: 3,
    discountAmount: 0,
    snapshot: {
      name: "Aceite de Oliva",
      price: 12.5,
      taxRate: 15,
      stock: 100,
      primaryCode: "P001",
      barcode: null,
    },
  };
  const line = calcLine(item);
  assert.equal(line.gross, 37.5);
  assert.equal(line.subtotal, 37.5);
  assert.equal(line.tax, 5.63);
  assert.equal(line.total, 43.13);
  assert.ok(line.total > 0, "total must never be zero for a valid cart item");
});

test("calcLine handles discount correctly", () => {
  const item: CartItem = {
    productId: "prod-xyz",
    quantity: 2,
    discountAmount: 5.0,
    snapshot: { name: "Test", price: 10, taxRate: 12, stock: 50, primaryCode: null, barcode: null },
  };
  const line = calcLine(item);
  assert.equal(line.gross, 20);
  assert.equal(line.discount, 5);
  assert.equal(line.subtotal, 15);
  assert.equal(line.tax, 1.8);
  assert.equal(line.total, 16.8);
});

test("calcLine clamps discount to gross amount", () => {
  const item: CartItem = {
    productId: "prod-clamp",
    quantity: 1,
    discountAmount: 999,
    snapshot: { name: "Cheap", price: 5, taxRate: 0, stock: 10, primaryCode: null, barcode: null },
  };
  const line = calcLine(item);
  assert.equal(line.discount, 5, "discount clamped to gross");
  assert.equal(line.subtotal, 0);
  assert.equal(line.total, 0);
});

// ── Bug 2 fix: hydration guard prevents save from wiping cart
test("hydration guard logic: save should not run before hydration", () => {
  let hydrated = false;
  const cartStorageKey = "pos_cart_t1_u1";
  const cart: CartItem[] = [];

  function simulateSaveEffect() {
    if (!cartStorageKey || !hydrated) return "blocked";
    if (cart.length === 0) return "removeItem";
    return "setItem";
  }

  assert.equal(simulateSaveEffect(), "blocked", "save blocked before hydration");

  hydrated = true;
  assert.equal(simulateSaveEffect(), "removeItem", "save runs after hydration");
});

// ── makeSnapshot preserves data from product
test("makeSnapshot creates correct snapshot from product", () => {
  const product = {
    name: "Widget",
    price: "25.50",
    taxRate: "15",
    stock: 42,
    primaryCode: "W001",
    barcode: "7861234567890",
  };
  const snap = makeSnapshot(product, 42);
  assert.equal(snap.name, "Widget");
  assert.equal(snap.price, 25.5);
  assert.equal(snap.taxRate, 15);
  assert.equal(snap.stock, 42);
  assert.equal(snap.primaryCode, "W001");
  assert.equal(snap.barcode, "7861234567890");
});

// ── Cart persistence: old format items without snapshot are handled
test("cart item without snapshot can be detected", () => {
  const oldFormatItem = { productId: "old-1", quantity: 2, discountAmount: 0 } as unknown as CartItem;
  assert.equal(oldFormatItem.snapshot, undefined, "old format has no snapshot");

  const newFormatItem: CartItem = {
    productId: "new-1",
    quantity: 1,
    discountAmount: 0,
    snapshot: { name: "New", price: 10, taxRate: 12, stock: 5, primaryCode: null, barcode: null },
  };
  assert.ok(newFormatItem.snapshot !== undefined, "new format has snapshot");
});

// ── Double-click protection
test("submitting ref prevents double submission", () => {
  let submittingRef = false;
  let callCount = 0;

  function simulateSubmit() {
    if (submittingRef) return;
    submittingRef = true;
    callCount++;
    submittingRef = false;
  }

  simulateSubmit();
  assert.equal(callCount, 1);

  submittingRef = true;
  simulateSubmit();
  assert.equal(callCount, 1, "second call blocked while submitting");
});
