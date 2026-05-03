import { ConversationList } from "@/components/appsolux/conversations/conversation-list";
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
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las conversaciones",
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

export default async function ConversationsPage() {
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
  const missingOperationalAccess = await hasMissingOperationalAccess(tenant.id);
  const result = missingOperationalAccess
    ? {
        success: false as const,
        message:
          "Tu bandeja fue creada, pero todavia falta completar el acceso operativo.",
      }
    : await loadConversations(tenant.chatwoot_account_id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Chatwoot</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Conversaciones
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Todos los chats del tenant {tenant.name}, consultados desde Chatwoot
            usando el chatwoot_account_id dinamico.
          </p>
        </div>

        {result.success ? (
          <ConversationList
            conversations={result.conversations}
            meta={result.meta}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Error al cargar conversaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive">{result.message}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
