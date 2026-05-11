import "@/lib/security/server-only";
import { getErpnextConfig, erpnextFetch } from "./client";
import type {
  ErpnextCreateResponse,
  ErpnextFileAttachment,
  ErpnextListResponse,
} from "@/types/erpnext";

const fileFields = [
  "name",
  "file_name",
  "file_url",
  "attached_to_doctype",
  "attached_to_name",
  "is_private",
  "creation",
];

export type ErpnextAttachablePurchaseDoctype =
  | "Purchase Invoice"
  | "Purchase Order";

export async function getErpnextDocumentFiles(
  doctype: ErpnextAttachablePurchaseDoctype,
  name: string
): Promise<ErpnextFileAttachment[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(fileFields),
    filters: JSON.stringify([
      ["File", "attached_to_doctype", "=", doctype],
      ["File", "attached_to_name", "=", name],
    ]),
    limit_page_length: "50",
    order_by: "creation desc",
  });

  const response = await erpnextFetch<
    ErpnextListResponse<ErpnextFileAttachment>
  >(`/api/resource/File?${params.toString()}`);

  return response.data;
}

export async function uploadErpnextDocumentFile(input: {
  doctype: ErpnextAttachablePurchaseDoctype;
  name: string;
  file: File;
  filename: string;
}): Promise<ErpnextFileAttachment> {
  const { baseUrl, apiKey, apiSecret } = getErpnextConfig();
  const formData = new FormData();

  formData.set("doctype", input.doctype);
  formData.set("docname", input.name);
  formData.set("is_private", "1");
  formData.set("folder", "Home/Attachments");
  formData.set("file", input.file, input.filename);

  const response = await fetch(`${baseUrl}/api/method/upload_file`, {
    method: "POST",
    headers: {
      Authorization: `token ${apiKey}:${apiSecret}`,
    },
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ERPNext no pudo adjuntar el archivo (${response.status}).`);
  }

  const payload = (await response.json()) as {
    message?: ErpnextFileAttachment;
    data?: ErpnextFileAttachment;
  };
  const file = payload.message ?? payload.data;

  if (!file) {
    throw new Error("ERPNext no devolvio informacion del archivo adjunto.");
  }

  return file;
}

export async function createErpnextDocumentFileReference(input: {
  doctype: ErpnextAttachablePurchaseDoctype;
  name: string;
  filename: string;
  note?: string;
}): Promise<ErpnextFileAttachment> {
  const response = await erpnextFetch<
    ErpnextCreateResponse<ErpnextFileAttachment>
  >("/api/resource/File", {
    method: "POST",
    body: JSON.stringify({
      file_name: input.filename,
      attached_to_doctype: input.doctype,
      attached_to_name: input.name,
      is_private: 1,
      content: input.note
        ? `Registro documental inicial: ${input.note}`
        : "Registro documental inicial sin archivo persistido.",
    }),
  });

  return response.data;
}
