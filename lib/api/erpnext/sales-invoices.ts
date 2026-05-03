import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import { getErpnextSalesOrderDetail } from "./sales-orders";
import type {
  CreateSalesInvoiceFromOrderInput,
  ErpnextCreateResponse,
  ErpnextSalesInvoice,
} from "@/types/erpnext";

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function createSalesInvoiceFromSalesOrder(
  input: CreateSalesInvoiceFromOrderInput
): Promise<ErpnextSalesInvoice> {
  const salesOrder = await getErpnextSalesOrderDetail(input.sales_order_name);
  const today = getTodayDate();
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSalesInvoice>>(
    "/api/resource/Sales%20Invoice",
    {
      method: "POST",
      body: JSON.stringify({
        customer: salesOrder.customer,
        company: salesOrder.company,
        posting_date: today,
        due_date: today,
        items: (salesOrder.items ?? []).map((item) => ({
          item_code: item.item_code,
          qty: item.qty,
          rate: item.rate,
          warehouse: item.warehouse,
          sales_order: salesOrder.name,
          so_detail: item.name,
        })),
      }),
    }
  );

  return response.data;
}
