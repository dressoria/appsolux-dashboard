import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import { getErpnextAccountCurrency } from "./accounts";
import type {
  CreateErpnextModeOfPaymentInput,
  ErpnextCreateResponse,
  ErpnextListResponse,
  ErpnextMethodResponse,
  ErpnextModeOfPayment,
  ErpnextModeOfPaymentAccount,
  ErpnextModeOfPaymentDetail,
  PaymentAccountMapping,
} from "@/types/erpnext";

const modeOfPaymentFields = ["name", "type", "enabled"];

export async function getErpnextModesOfPayment(): Promise<
  ErpnextModeOfPayment[]
> {
  const params = new URLSearchParams({
    fields: JSON.stringify(modeOfPaymentFields),
    limit_page_length: "100",
    order_by: "name asc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextModeOfPayment>>(
    `/api/resource/Mode%20of%20Payment?${params.toString()}`
  );

  return response.data;
}

export async function createErpnextModeOfPayment(
  input: CreateErpnextModeOfPaymentInput
): Promise<ErpnextModeOfPaymentDetail> {
  const response = await erpnextFetch<
    ErpnextCreateResponse<ErpnextModeOfPaymentDetail>
  >("/api/resource/Mode%20of%20Payment", {
    method: "POST",
    body: JSON.stringify({
      mode_of_payment: input.mode_of_payment,
      type: input.type,
      enabled: input.enabled === false ? 0 : 1,
    }),
  });

  return response.data;
}

export async function getErpnextModeOfPaymentDetail(
  name: string
): Promise<ErpnextModeOfPaymentDetail> {
  const response = await erpnextFetch<
    ErpnextCreateResponse<ErpnextModeOfPaymentDetail>
  >(`/api/resource/Mode%20of%20Payment/${encodeURIComponent(name)}`);

  return response.data;
}

function getMissingPaymentAccountMessage() {
  return "Este metodo de pago no tiene una cuenta asociada. Configuralo en Ajustes > Pagos.";
}

function getMissingCompanyPaymentAccountMessage() {
  return "Este metodo de pago no tiene cuenta configurada para esta empresa.";
}

async function getPaymentAccountFromModeDocument(
  company: string,
  modeOfPayment: string
) {
  const response = await erpnextFetch<
    ErpnextCreateResponse<ErpnextModeOfPayment>
  >(`/api/resource/Mode%20of%20Payment/${encodeURIComponent(modeOfPayment)}`);
  const accounts = response.data.accounts ?? [];

  if (accounts.length === 0) {
    throw new Error(getMissingPaymentAccountMessage());
  }

  const matchingAccount = accounts.find(
    (account) => account.company === company
  );
  const account = matchingAccount?.default_account ?? matchingAccount?.account;

  if (!matchingAccount) {
    throw new Error(getMissingCompanyPaymentAccountMessage());
  }

  if (!account?.trim()) {
    throw new Error(getMissingPaymentAccountMessage());
  }

  return account.trim();
}

export async function getErpnextPaymentAccountMappingForMode(
  company: string,
  modeOfPayment: string
): Promise<PaymentAccountMapping> {
  const account = await getPaymentAccountFromModeDocument(
    company,
    modeOfPayment
  );

  return {
    mode_of_payment: modeOfPayment,
    company,
    account,
    account_currency: await getErpnextAccountCurrency(account, company),
  };
}

export async function getErpnextPaymentAccountForMode(
  company: string,
  modeOfPayment: string
): Promise<string> {
  const mapping = await getErpnextPaymentAccountMappingForMode(
    company,
    modeOfPayment
  );

  return mapping.account;
}

function buildAccountsTable(
  accounts: ErpnextModeOfPaymentAccount[],
  company: string,
  account: string
) {
  let hasCompanyRow = false;
  const updatedAccounts = accounts.map((row) => {
    if (row.company !== company) {
      return row;
    }

    hasCompanyRow = true;

    return {
      ...row,
      default_account: account,
      account,
    };
  });

  if (!hasCompanyRow) {
    updatedAccounts.push({
      company,
      default_account: account,
      account,
    });
  }

  return updatedAccounts;
}

export async function updateModeOfPaymentAccountMapping(
  modeOfPayment: string,
  company: string,
  account: string
): Promise<PaymentAccountMapping> {
  const modeOfPaymentDetail = await getErpnextModeOfPaymentDetail(
    modeOfPayment
  );
  const updatedDoc: ErpnextModeOfPaymentDetail & {
    doctype: "Mode of Payment";
  } = {
    ...modeOfPaymentDetail,
    doctype: "Mode of Payment",
    accounts: buildAccountsTable(
      modeOfPaymentDetail.accounts ?? [],
      company,
      account
    ),
  };

  await erpnextFetch<ErpnextMethodResponse<ErpnextModeOfPaymentDetail>>(
    "/api/method/frappe.client.save",
    {
      method: "POST",
      body: JSON.stringify({
        doc: updatedDoc,
      }),
    }
  );

  return {
    mode_of_payment: modeOfPayment,
    company,
    account,
    account_currency: await getErpnextAccountCurrency(account, company),
  };
}
