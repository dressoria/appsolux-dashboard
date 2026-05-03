import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  ErpnextCompany,
  ErpnextCompanyDetail,
  ErpnextCreateResponse,
  ErpnextListResponse,
  UpdateErpnextCompanyBasicInfoInput,
} from "@/types/erpnext";

const companyFields = [
  "name",
  "company_name",
  "default_currency",
  "country",
  "tax_id",
];

export async function getErpnextCompanies(): Promise<ErpnextCompany[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(companyFields),
    limit_page_length: "100",
    order_by: "name asc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextCompany>>(
    `/api/resource/Company?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextCompanyDetail(
  name: string
): Promise<ErpnextCompanyDetail> {
  const response = await erpnextFetch<
    ErpnextCreateResponse<ErpnextCompanyDetail>
  >(`/api/resource/Company/${encodeURIComponent(name)}`);

  return response.data;
}

export async function updateErpnextCompanyBasicInfo(
  name: string,
  input: UpdateErpnextCompanyBasicInfoInput
): Promise<ErpnextCompanyDetail> {
  const response = await erpnextFetch<
    ErpnextCreateResponse<ErpnextCompanyDetail>
  >(`/api/resource/Company/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify({
      company_email: input.company_email,
      phone_no: input.phone_no,
      website: input.website,
      tax_id: input.tax_id,
    }),
  });

  return response.data;
}
