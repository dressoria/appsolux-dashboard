import "@/lib/security/server-only";
import { getChatwootBaseUrl, getChatwootBotToken } from "@/lib/api/chatwoot/config";
import { evolutionFetch } from "./client";

export type ConfigureEvolutionChatwootInput = {
  instanceName: string;
  chatwootAccountId: string;
  tenantName: string;
  signMessages?: boolean;
  signDelimiter?: string;
  conversationPending?: boolean;
  reopenConversation?: boolean;
  importContacts?: boolean;
  importMessages?: boolean;
  daysLimitImportMessages?: number;
  ignoredJids?: string[];
  autoCreate?: boolean;
};

export type EvolutionChatwootConfigResult = {
  instanceName: string;
  accountId: string;
  inboxName: string;
  organization: string;
  logo: string;
  importContacts: boolean;
  importMessages: boolean;
  daysLimitImportMessages: number;
  autoCreate: boolean;
};

const defaultLogoUrl =
  "https://r-charts.com/es/miscelanea/procesamiento-imagenes-magick_files/figure-html/dibujar-sobre-imagen-r.png";

function getChatwootUrl() {
  return getChatwootBaseUrl().replace(/\/+$/g, "");
}

function getLogoUrl() {
  return process.env.EVOLUTION_CHATWOOT_LOGO_URL?.trim() || defaultLogoUrl;
}

export async function configureEvolutionChatwootIntegration(
  input: ConfigureEvolutionChatwootInput
): Promise<EvolutionChatwootConfigResult> {
  const chatwootToken = getChatwootBotToken();
  const inboxName = `WhatsApp - ${input.tenantName}`;
  const organization = input.tenantName;
  const importContacts = input.importContacts ?? true;
  const importMessages = input.importMessages ?? true;
  const daysLimitImportMessages = input.daysLimitImportMessages ?? 7;
  const autoCreate = input.autoCreate ?? true;
  const logo = getLogoUrl();

  await evolutionFetch<unknown>(
    `/chatwoot/set/${encodeURIComponent(input.instanceName)}`,
    {
      method: "POST",
      body: JSON.stringify({
        enabled: true,
        accountId: input.chatwootAccountId,
        token: chatwootToken.token,
        url: getChatwootUrl(),
        signMsg: input.signMessages ?? true,
        reopenConversation: input.reopenConversation ?? true,
        conversationPending: input.conversationPending ?? true,
        nameInbox: inboxName,
        mergeBrazilContacts: true,
        importContacts,
        importMessages,
        daysLimitImportMessages,
        signDelimiter: input.signDelimiter ?? "\n",
        autoCreate,
        organization,
        logo,
        ignoreJids: input.ignoredJids ?? [],
      }),
    }
  );

  return {
    instanceName: input.instanceName,
    accountId: input.chatwootAccountId,
    inboxName,
    organization,
    logo,
    importContacts,
    importMessages,
    daysLimitImportMessages,
    autoCreate,
  };
}
