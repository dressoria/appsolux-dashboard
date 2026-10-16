import { ProductInputError } from "./inventory-product-input";

export function productErrorResponse(error: unknown) {
  if (error instanceof ProductInputError) {
    return { status: error.status, body: { code: error.code, message: error.message, field: error.field } };
  }
  const prismaError = error as { code?: string; meta?: { target?: unknown } };
  if (prismaError?.code === "P2002") {
    const target = String(prismaError.meta?.target ?? "");
    const field = target.includes("barcode") ? "barcode" : target.includes("primaryCode") ? "primaryCode" : undefined;
    return { status: 409, body: { code: "DUPLICATE_PRODUCT", message: field === "barcode" ? "No se pudo guardar: el código de barras ya existe." : field === "primaryCode" ? "No se pudo guardar: el código ya existe." : "Ya existe un producto con estos datos únicos.", field } };
  }
  if (prismaError?.code === "P2003") return { status: 400, body: { code: "INVALID_REFERENCE", message: "Una categoría, unidad, marca, bodega o cuenta seleccionada ya no está disponible." } };
  if (prismaError?.code === "P2025") return { status: 404, body: { code: "PRODUCT_NOT_FOUND", message: "Producto no encontrado." } };
  if (error instanceof SyntaxError) return { status: 400, body: { code: "INVALID_JSON", message: "El cuerpo JSON no es válido." } };
  console.error("Inventory product request failed", error);
  return { status: 500, body: { code: "PRODUCT_SAVE_FAILED", message: "No se pudo guardar el producto. Inténtalo nuevamente." } };
}
