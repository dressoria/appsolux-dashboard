import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import { getErpnextCompanies } from "./masters";
import type { ErpnextAccount, ErpnextCreateResponse } from "@/types/erpnext";

export async function getErpnextAccountCurrency(
  accountName: string,
  company?: string
): Promise<string> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextAccount>>(
    `/api/resource/Account/${encodeURIComponent(accountName)}`
  );
  const accountCurrency = response.data.account_currency?.trim();

  if (accountCurrency) {
    return accountCurrency;
  }

  if (company) {
    const companies = await getErpnextCompanies();
    const defaultCurrency = companies.find(
      (erpCompany) => erpCompany.name === company
    )?.default_currency;

    if (defaultCurrency) {
      return defaultCurrency;
    }
  }

  throw new Error("La cuenta de pago no tiene moneda configurada.");
}
