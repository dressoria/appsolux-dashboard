import "@/lib/security/server-only";
import {
  cancelErpnextDocument,
  deleteErpnextDocument,
  submitErpnextDocument,
} from "./documents";
import { erpnextFetch } from "./client";
import { getErpnextSalesOrderDetail } from "./sales-orders";
import type {
  CreateSalesInvoiceFromOrderInput,
  ErpnextCreateResponse,
  ErpnextListResponse,
  ErpnextMethodResponse,
  ErpnextSalesInvoice,
  UpdateSalesInvoiceDraftInput,
} from "@/types/erpnext";

const salesInvoiceFields = [
  "name",
  "customer",
  "customer_name",
  "posting_date",
  "due_date",
  "status",
  "docstatus",
  "grand_total",
  "outstanding_amount",
  "paid_amount",
  "company",
  "remarks",
];

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function getErpnextSalesInvoices(): Promise<
  ErpnextSalesInvoice[]
> {
  const params = new URLSearchParams({
    fields: JSON.stringify(salesInvoiceFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextSalesInvoice>>(
    `/api/resource/Sales%20Invoice?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextSalesInvoiceDetail(
  name: string
): Promise<ErpnextSalesInvoice> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSalesInvoice>>(
    `/api/resource/Sales%20Invoice/${encodeURIComponent(name)}`
  );

  return response.data;
}

export async function submitErpnextSalesInvoice(
  salesInvoice: ErpnextSalesInvoice
): Promise<ErpnextSalesInvoice> {
  const doc: ErpnextSalesInvoice & { doctype: "Sales Invoice" } = {
    ...salesInvoice,
    doctype: "Sales Invoice",
  };

  return submitErpnextDocument(doc);
}

export async function updateErpnextSalesInvoiceDraft(
  name: string,
  input: UpdateSalesInvoiceDraftInput
): Promise<ErpnextSalesInvoice> {
  const currentSalesInvoice = await getErpnextSalesInvoiceDetail(name);
  const updatedDoc: ErpnextSalesInvoice = {
    ...currentSalesInvoice,
    doctype: "Sales Invoice",
    due_date: input.due_date,
    remarks: input.remarks,
    items: input.items?.map((item) => ({
      doctype: "Sales Invoice Item",
      name: item.name,
      item_code: item.item_code,
      qty: item.qty,
      rate: item.rate,
      warehouse: item.warehouse,
    })),
  };
  const response = await erpnextFetch<
    ErpnextMethodResponse<ErpnextSalesInvoice>
  >(
    "/api/method/frappe.client.save",
    {
      method: "POST",
      body: JSON.stringify({
        doc: updatedDoc,
      }),
    }
  );

  return response.message;
}

export async function deleteErpnextSalesInvoiceDraft(
  name: string
): Promise<void> {
  await deleteErpnextDocument("Sales Invoice", name);
}

export async function cancelErpnextSalesInvoice(
  name: string
): Promise<ErpnextSalesInvoice> {
  await cancelErpnextDocument("Sales Invoice", name);

  return getErpnextSalesInvoiceDetail(name);
}

export async function createCorrectedInvoiceFromCancelled(
  name: string
): Promise<ErpnextSalesInvoice> {
  const salesInvoice = await getErpnextSalesInvoiceDetail(name);
  const today = getTodayDate();
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSalesInvoice>>(
    "/api/resource/Sales%20Invoice",
    {
      method: "POST",
      body: JSON.stringify({
        customer: salesInvoice.customer,
        company: salesInvoice.company,
        posting_date: today,
        due_date: salesInvoice.due_date ?? today,
        remarks: `Correccion basada en factura anulada ${salesInvoice.name}`,
        items: (salesInvoice.items ?? []).map((item) => ({
          item_code: item.item_code,
          qty: item.qty,
          rate: item.rate,
          warehouse: item.warehouse,
        })),
      }),
    }
  );

  return response.data;
}

export async function createCorrectedSalesInvoiceFromCancelled(
  originalInvoiceName: string
): Promise<ErpnextSalesInvoice> {
  return createCorrectedInvoiceFromCancelled(originalInvoiceName);
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
