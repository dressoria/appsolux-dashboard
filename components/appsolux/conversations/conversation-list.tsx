import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ChatwootConversation,
  ChatwootConversationsMeta,
} from "@/types/chatwoot";

type ConversationListProps = {
  conversations: ChatwootConversation[];
  meta: ChatwootConversationsMeta;
};

function formatDate(timestamp?: number) {
  if (!timestamp) return "Sin fecha";

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}

function getSenderName(conversation: ChatwootConversation) {
  return conversation.meta?.sender?.name ?? "Contacto sin nombre";
}

function getSenderPhone(conversation: ChatwootConversation) {
  return conversation.meta?.sender?.phone_number ?? "Sin telefono";
}

function getLastMessage(conversation: ChatwootConversation) {
  return (
    conversation.last_non_activity_message?.processed_message_content ??
    conversation.last_non_activity_message?.content ??
    "Sin ultimo mensaje"
  );
}

export function ConversationList({
  conversations,
  meta,
}: ConversationListProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Todas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{meta.all_count}</p>
            <p className="text-xs text-muted-foreground">
              Conversaciones totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asignadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{meta.assigned_count}</p>
            <p className="text-xs text-muted-foreground">
              Con agente asignado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sin asignar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{meta.unassigned_count}</p>
            <p className="text-xs text-muted-foreground">
              Requieren revision
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mias</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{meta.mine_count}</p>
            <p className="text-xs text-muted-foreground">
              Asignadas a mi usuario
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bandeja de conversaciones</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay conversaciones para mostrar.
            </p>
          ) : (
            conversations.map((conversation) => {
              const labels = conversation.labels ?? [];
              const lastMessage = getLastMessage(conversation);

              return (
                <Link
                  key={conversation.id}
                  href={`/conversations/${conversation.id}`}
                  className="block rounded-xl border p-4 transition hover:bg-muted/40"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">
                          {getSenderName(conversation)}
                        </h3>

                        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                          {conversation.status}
                        </span>

                        {conversation.unread_count > 0 ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                            {conversation.unread_count} sin leer
                          </span>
                        ) : null}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {getSenderPhone(conversation)}
                      </p>

                      <p className="line-clamp-2 max-w-3xl text-sm text-muted-foreground">
                        {lastMessage}
                      </p>
                    </div>

                    <div className="text-xs text-muted-foreground md:text-right">
                      <p>{formatDate(conversation.last_activity_at)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {labels.length > 0 ? (
                      labels.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border px-2 py-1 text-xs"
                        >
                          {label}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                        Sin etiquetas
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
