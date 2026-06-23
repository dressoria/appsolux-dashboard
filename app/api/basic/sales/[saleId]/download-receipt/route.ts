import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getSaleById } from "@/lib/core/lightweight-pos";
import { generateBasicReceiptPdf } from "@/lib/core/basic-receipt-pdf";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type Props = {
  params: Promise<{
    saleId: string;
  }>;
};

export async function GET(_request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  }

  const tenant = await getCurrentTenant(user);
  const { saleId } = await params;
  const sale = await getSaleById(tenant.id, saleId);

  if (!sale) {
    return NextResponse.json({ error: "Venta no encontrada." }, { status: 404 });
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateBasicReceiptPdf({
      tenantName: sale.tenant.name,
      saleId: sale.id,
      createdAt: sale.createdAt,
      customerName: sale.customer?.name ?? "Consumidor final",
      status: sale.status,
      paymentStatus: sale.paymentStatus,
      subtotal: Number(sale.subtotal),
      discountTotal: Number(sale.discountTotal),
      taxTotal: Number(sale.taxTotal),
      total: Number(sale.total),
      items: sale.items.map((item) => ({
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.total),
        taxRate: Number(item.taxRate ?? 0),
        discountAmount: Number(item.discountAmount ?? 0),
        productName: item.product.name,
      })),
      payments: sale.payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment.amount),
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo generar el recibo PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recibo-${sale.id.slice(-8)}.pdf"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
