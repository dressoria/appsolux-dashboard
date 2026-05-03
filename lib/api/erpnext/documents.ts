import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type { ErpnextDeleteResponse, ErpnextMethodResponse } from "@/types/erpnext";

export type ErpnextDocument = {
  name: string;
  doctype: string;
  docstatus?: 0 | 1 | 2;
};

export async function submitErpnextDocument<TDocument extends ErpnextDocument>(
  doc: TDocument
): Promise<TDocument> {
  const response = await erpnextFetch<ErpnextMethodResponse<TDocument>>(
    "/api/method/frappe.client.submit",
    {
      method: "POST",
      body: JSON.stringify({ doc }),
    }
  );

  return response.message;
}

export async function cancelErpnextDocument(
  doctype: string,
  name: string
): Promise<ErpnextDocument> {
  const response = await erpnextFetch<ErpnextMethodResponse<ErpnextDocument>>(
    "/api/method/frappe.client.cancel",
    {
      method: "POST",
      body: JSON.stringify({
        doctype,
        name,
      }),
    }
  );

  return response.message;
}

export async function deleteErpnextDocument(
  doctype: string,
  name: string
): Promise<void> {
  await erpnextFetch<ErpnextDeleteResponse>("/api/method/frappe.client.delete", {
    method: "POST",
    body: JSON.stringify({
      doctype,
      name,
    }),
  });
}
