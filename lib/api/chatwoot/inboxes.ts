import "@/lib/security/server-only";
import { chatwootFetch } from "./client";

export type ChatwootInbox = {
  id: number;
  name: string;
  channel_type?: string;
};

type CreateChatwootWhatsappInboxInput = {
  chatwootAccountId: number;
  tenantName: string;
};

type ChatwootInboxSetupResult =
  | {
      status: "ready";
      inboxId: number;
      message: string;
    }
  | {
      status: "pending";
      message: string;
    };

export async function listChatwootInboxes(chatwootAccountId: number) {
  return chatwootFetch<ChatwootInbox[]>(
    `/api/v1/accounts/${chatwootAccountId}/inboxes`
  );
}

export async function prepareChatwootWhatsappInbox(
  input: CreateChatwootWhatsappInboxInput
): Promise<ChatwootInboxSetupResult> {
  const inboxName = `WhatsApp - ${input.tenantName}`;

  try {
    const inboxes = await listChatwootInboxes(input.chatwootAccountId);
    const existingInbox = inboxes.find((inbox) => inbox.name === inboxName);

    if (existingInbox) {
      return {
        status: "ready",
        inboxId: existingInbox.id,
        message: "Bandeja WhatsApp encontrada.",
      };
    }
  } catch {
    return {
      status: "pending",
      message:
        "Bandeja WhatsApp pendiente de configuracion. No pudimos validar inboxes de Chatwoot con el token operativo.",
    };
  }

  return {
    status: "pending",
    message:
      "Bandeja WhatsApp pendiente de configuracion. La creacion automatica del canal se completara cuando confirmemos el payload exacto del inbox API/WhatsApp.",
  };
}
