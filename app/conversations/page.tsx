import { ConversationInbox } from "@/components/appsolux/conversations/conversation-inbox";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChatwootConversations } from "@/lib/api/chatwoot/conversations";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantIntegrationByProvider } from "@/lib/core/integrations";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type {
  ChatwootConversation,
  ChatwootConversationsMeta,
} from "@/types/chatwoot";

type ConversationsLoadResult =
  | {
      success: true;
      conversations: ChatwootConversation[];
      meta: ChatwootConversationsMeta;
    }
  | {
      success: false;
      message: string;
    };

type ConversationsPageProps = {
  searchParams?: Promise<{
    conversationId?: string;
  }>;
};

async function loadConversations(
  chatwootAccountId: number
): Promise<ConversationsLoadResult> {
  try {
    const conversationsResponse =
      await getChatwootConversations(chatwootAccountId);

    return {
      success: true,
      conversations: conversationsResponse.data.payload,
      meta: conversationsResponse.data.meta,
    };
  } catch {
    return {
      success: false,
      message: "No pudimos cargar tus conversaciones. Intenta nuevamente.",
    };
  }
}

async function hasMissingOperationalAccess(tenantId: string) {
  try {
    const integration = await getTenantIntegrationByProvider(
      tenantId,
      "chatwoot"
    );

    if (!integration?.externalAccountId) {
      return false;
    }

    if (!integration.config || typeof integration.config !== "object") {
      return true;
    }

    const operationalAccess = (integration.config as Record<string, unknown>)
      .operationalAccess;

    return operationalAccess !== "ready";
  } catch {
    return false;
  }
}

export default async function ConversationsPage({
  searchParams,
}: ConversationsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver las conversaciones de Appsolux.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedSearchParams = await searchParams;
  const initialConversationId = resolvedSearchParams?.conversationId
    ? Number(resolvedSearchParams.conversationId)
    : undefined;
  const missingOperationalAccess = await hasMissingOperationalAccess(tenant.id);
  const result = missingOperationalAccess
    ? {
        success: false as const,
        message:
          "Tu bandeja fue creada, pero todavia falta completar el acceso operativo.",
      }
    : await loadConversations(tenant.chatwoot_account_id);

  return (
    <DashboardShell
      hideTopbar
      mainClassName="p-0"
      contentClassName="max-w-none"
    >
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-muted/20">
        <header className="border-b bg-background px-4 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bandeja de conversaciones
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Conversaciones
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Gestiona los mensajes de tus clientes desde tus canales conectados.
          </p>
        </header>

        {result.success ? (
          <div className="min-h-0 flex-1 p-3 sm:p-4">
            <ConversationInbox
              conversations={result.conversations}
              meta={result.meta}
              initialConversationId={
                Number.isInteger(initialConversationId) &&
                initialConversationId &&
                initialConversationId > 0
                  ? initialConversationId
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <Card>
              <CardHeader>
                <CardTitle>Error al cargar conversaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-destructive">{result.message}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
