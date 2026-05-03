import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import { getErpnextCompanies } from "./companies";
import type {
  CreateErpnextCashOrBankAccountInput,
  ErpnextAccount,
  ErpnextCreateResponse,
  ErpnextListResponse,
} from "@/types/erpnext";

const accountFields = [
  "name",
  "account_name",
  "account_type",
  "root_type",
  "account_currency",
  "company",
  "parent_account",
  "is_group",
  "disabled",
];

export async function getErpnextAccounts(
  company?: string
): Promise<ErpnextAccount[]> {
  const filters = company ? [["company", "=", company]] : [];
  const params = new URLSearchParams({
    fields: JSON.stringify(accountFields),
    limit_page_length: "500",
    order_by: "name asc",
  });

  if (filters.length > 0) {
    params.set("filters", JSON.stringify(filters));
  }

  const response = await erpnextFetch<ErpnextListResponse<ErpnextAccount>>(
    `/api/resource/Account?${params.toString()}`
  );

  return response.data;
}

export async function getCashAndBankAccounts(
  company?: string
): Promise<ErpnextAccount[]> {
  const accounts = await getErpnextAccounts(company);
  const cashAndBankAccounts = accounts.filter(
    (account) =>
      account.is_group !== 1 &&
      account.disabled !== 1 &&
      (account.account_type === "Cash" || account.account_type === "Bank")
  );

  if (cashAndBankAccounts.length > 0) {
    return cashAndBankAccounts;
  }

  return accounts.filter(
    (account) => account.is_group !== 1 && account.disabled !== 1
  );
}

function isCompatibleParent(
  account: ErpnextAccount,
  accountType: "Cash" | "Bank"
) {
  if (account.is_group !== 1 || account.disabled === 1) {
    return false;
  }

  if (account.account_type === accountType) {
    return true;
  }

  return account.root_type === "Asset";
}

async function resolveParentAccount(
  input: CreateErpnextCashOrBankAccountInput
) {
  if (input.parent_account?.trim()) {
    return input.parent_account.trim();
  }

  const accounts = await getErpnextAccounts(input.company);
  const parent = accounts.find((account) =>
    isCompatibleParent(account, input.account_type)
  );

  if (!parent) {
    throw new Error(
      "No se encontro una cuenta padre para crear esta cuenta. Configura primero el plan de cuentas o selecciona una cuenta padre."
    );
  }

  return parent.name;
}

export async function createErpnextCashOrBankAccount(
  input: CreateErpnextCashOrBankAccountInput
): Promise<ErpnextAccount> {
  const parentAccount = await resolveParentAccount(input);
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextAccount>>(
    "/api/resource/Account",
    {
      method: "POST",
      body: JSON.stringify({
        account_name: input.account_name,
        company: input.company,
        account_type: input.account_type,
        account_currency: input.account_currency,
        parent_account: parentAccount,
        is_group: 0,
      }),
    }
  );

  return response.data;
}

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
