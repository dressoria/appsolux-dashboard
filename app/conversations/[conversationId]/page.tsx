import Link from "next/link";
import { MessageComposer } from "@/components/appsolux/conversations/message-composer";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChatwootConversationDetail } from "@/lib/api/chatwoot/conversation-detail";
import { getChatwootConversationMessages } from "@/lib/api/chatwoot/conversation-messages";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type ConversationDetailPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
};

function formatDate(timestamp?: number) {
  if (!timestamp) return "Sin fecha";

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}

export default async function ConversationDetailPage({
  params,
}: ConversationDetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver esta conversacion.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const { conversationId } = await params;
  const parsedConversationId = Number(conversationId);

  if (!Number.isInteger(parsedConversationId) || parsedConversationId <= 0) {
    return (
      <DashboardShell>
        <Card>
          <CardHeader>
            <CardTitle>Conversacion invalida</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              El ID de conversacion no es valido.
            </p>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);

  const conversation = await getChatwootConversationDetail(
    tenant.chatwoot_account_id,
    parsedConversationId
  );

  const messagesResponse = await getChatwootConversationMessages(
    tenant.chatwoot_account_id,
    parsedConversationId
  );

  const sender = conversation.meta?.sender;
  const messages = messagesResponse.payload;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <Link
            href="/conversations"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Volver a conversaciones
          </Link>

          <div>
            <p className="text-sm text-muted-foreground">Chatwoot</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {sender?.name ?? "Conversacion"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {sender?.phone_number ?? "Sin telefono"} · Estado:{" "}
              {conversation.status} · Tenant: {tenant.name}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mensajes</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay mensajes para mostrar.
              </p>
            ) : (
              messages.map((message) => {
                const isOutgoing = message.message_type === 1;

                return (
                  <div
                    key={message.id}
                    className={
                      isOutgoing ? "flex justify-end" : "flex justify-start"
                    }
                  >
                    <div
                      className={
                        isOutgoing
                          ? "max-w-2xl rounded-2xl bg-primary px-4 py-3 text-primary-foreground"
                          : "max-w-2xl rounded-2xl border bg-background px-4 py-3"
                      }
                    >
                      <p className="whitespace-pre-wrap text-sm">
                        {message.processed_message_content ??
                          message.content ??
                          "Mensaje sin contenido"}
                      </p>

                      <p
                        className={
                          isOutgoing
                            ? "mt-2 text-xs text-primary-foreground/70"
                            : "mt-2 text-xs text-muted-foreground"
                        }
                      >
                        {message.sender?.name ?? message.sender_type} ·{" "}
                        {formatDate(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}

            <MessageComposer conversationId={parsedConversationId} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}