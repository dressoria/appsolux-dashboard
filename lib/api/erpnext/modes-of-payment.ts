import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  ErpnextCreateResponse,
  ErpnextListResponse,
  ErpnextMethodResponse,
  ErpnextModeOfPayment,
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

type BankCashAccountResponse = {
  account?: string;
};

function getMissingPaymentAccountMessage() {
  return "El metodo de pago seleccionado no tiene una cuenta de caja o banco configurada para esta empresa. Configura una cuenta para efectivo, banco o pagos por revisar antes de registrar cobros.";
}

function getAccountFromMethodResponse(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const account = record.account;

  return typeof account === "string" && account.trim() ? account.trim() : null;
}

async function getPaymentAccountFromMethod(
  company: string,
  modeOfPayment: string
) {
  const response = await erpnextFetch<
    ErpnextMethodResponse<BankCashAccountResponse | string | null>
  >("/api/method/erpnext.accounts.doctype.sales_invoice.sales_invoice.get_bank_cash_account", {
    method: "POST",
    body: JSON.stringify({
      mode_of_payment: modeOfPayment,
      company,
    }),
  });

  if (typeof response.message === "string" && response.message.trim()) {
    return response.message.trim();
  }

  return getAccountFromMethodResponse(response.message);
}

async function getPaymentAccountFromModeDocument(
  company: string,
  modeOfPayment: string
) {
  const response = await erpnextFetch<
    ErpnextCreateResponse<ErpnextModeOfPayment>
  >(`/api/resource/Mode%20of%20Payment/${encodeURIComponent(modeOfPayment)}`);
  const accounts = response.data.accounts ?? [];
  const matchingAccount = accounts.find(
    (account) => account.company === company
  );
  const fallbackAccount =
    matchingAccount?.default_account ??
    matchingAccount?.account ??
    accounts[0]?.default_account ??
    accounts[0]?.account;

  return fallbackAccount?.trim() || null;
}

export async function getErpnextPaymentAccountForMode(
  company: string,
  modeOfPayment: string
): Promise<string> {
  try {
    const account = await getPaymentAccountFromMethod(company, modeOfPayment);

    if (account) {
      return account;
    }
  } catch {
    // Fallback: some ERPNext setups do not expose the helper reliably.
  }

  const account = await getPaymentAccountFromModeDocument(
    company,
    modeOfPayment
  );

  if (account) {
    return account;
  }

  throw new Error(getMissingPaymentAccountMessage());
}
