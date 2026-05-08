"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ChatwootConversation,
  ChatwootConversationsMeta,
  ChatwootMessage,
} from "@/types/chatwoot";

type ConversationInboxProps = {
  conversations: ChatwootConversation[];
  meta: ChatwootConversationsMeta;
  initialConversationId?: number;
};

type LoadState = "idle" | "loading" | "error";
type SendState = "idle" | "sending" | "error";

function formatDate(timestamp?: number) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp * 1000));
}

function getSenderName(conversation?: ChatwootConversation | null) {
  return conversation?.meta?.sender?.name ?? "Cliente";
}

function getSenderPhone(conversation?: ChatwootConversation | null) {
  return conversation?.meta?.sender?.phone_number ?? "Sin telefono";
}

function getChannel(conversation?: ChatwootConversation | null) {
  return conversation?.meta?.channel ?? "Canal conectado";
}

function getLastMessage(conversation: ChatwootConversation) {
  const content =
    conversation.last_non_activity_message?.processed_message_content ??
    conversation.last_non_activity_message?.content;

  return content?.trim() || "Sin ultimo mensaje";
}

function getMessageContent(message: ChatwootMessage) {
  return (
    message.processed_message_content?.trim() ??
    message.content?.trim() ??
    ""
  );
}

function isImageAttachment(attachment: NonNullable<ChatwootMessage["attachments"]>[number]) {
  return attachment.file_type === "image";
}

function getAttachmentUrl(attachment: NonNullable<ChatwootMessage["attachments"]>[number]) {
  return (
    attachment.data_url ??
    attachment.file_url ??
    attachment.download_url ??
    attachment.thumb_url ??
    ""
  );
}

function AttachmentList({ message }: { message: ChatwootMessage }) {
  const attachments = message.attachments ?? [];

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((attachment, index) => {
        const url = getAttachmentUrl(attachment);
        const name = attachment.name ?? `Archivo ${index + 1}`;

        if (!url) {
          return null;
        }

        if (isImageAttachment(attachment)) {
          return (
            <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={name}
                className="max-h-72 rounded-lg border object-contain"
              />
            </a>
          );
        }

        return (
          <a
            key={`${url}-${index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-md border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            {name}
          </a>
        );
      })}
    </div>
  );
}

function statusLabel(status?: string) {
  if (status === "open") {
    return "Abierta";
  }

  if (status === "resolved") {
    return "Resuelta";
  }

  if (status === "pending") {
    return "Pendiente";
  }

  if (status === "snoozed") {
    return "Pausada";
  }

  return "Sin estado";
}

export function ConversationInbox({
  conversations,
  meta,
  initialConversationId,
}: ConversationInboxProps) {
  const router = useRouter();
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(
    initialConversationId ?? null
  );
  const [selectedConversation, setSelectedConversation] =
    useState<ChatwootConversation | null>(
      conversations.find((item) => item.id === initialConversationId) ?? null
    );
  const [messages, setMessages] = useState<ChatwootMessage[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState("");
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState("");

  const filteredConversations = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const haystack = [
        getSenderName(conversation),
        getSenderPhone(conversation),
        getLastMessage(conversation),
        getChannel(conversation),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(cleanQuery);
    });
  }, [conversations, query]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let ignore = false;

    async function loadConversation(conversationId: number) {
      setLoadState("loading");
      setLoadError("");

      try {
        const [detailResponse, messagesResponse] = await Promise.all([
          fetch(`/api/chatwoot/conversations/${conversationId}`),
          fetch(`/api/chatwoot/conversations/${conversationId}/messages-list`),
        ]);
        const detailPayload = await detailResponse.json();
        const messagesPayload = await messagesResponse.json();

        if (!detailResponse.ok || !detailPayload.success) {
          throw new Error("No pudimos cargar la conversacion.");
        }

        if (!messagesResponse.ok || !messagesPayload.success) {
          throw new Error("No pudimos cargar los mensajes.");
        }

        if (!ignore) {
          setSelectedConversation(detailPayload.data.conversation);
          setMessages(messagesPayload.data.messages.payload ?? []);
          setLoadState("idle");
        }
      } catch (error) {
        if (!ignore) {
          setLoadState("error");
          setLoadError(
            error instanceof Error
              ? error.message
              : "No pudimos cargar esta conversacion."
          );
        }
      }
    }

    void loadConversation(selectedId);

    return () => {
      ignore = true;
    };
  }, [selectedId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, selectedId, loadState]);

  function selectConversation(conversation: ChatwootConversation) {
    setSelectedId(conversation.id);
    setSelectedConversation(conversation);
    setMessages([]);
    setSendError("");
    setSendState("idle");
    router.replace(`/conversations?conversationId=${conversation.id}`, {
      scroll: false,
    });
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!selectedId || sendState === "sending") {
      return;
    }

    const trimmedContent = content.trim();

    if (!trimmedContent && !attachment) {
      setSendState("error");
      setSendError("Escribe un mensaje o adjunta un archivo.");
      return;
    }

    setSendState("sending");
    setSendError("");

    try {
      const options: RequestInit = { method: "POST" };

      if (attachment) {
        const formData = new FormData();

        formData.append("content", trimmedContent);
        formData.append("attachment", attachment);
        options.body = formData;
      } else {
        options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify({ content: trimmedContent });
      }

      const response = await fetch(
        `/api/chatwoot/conversations/${selectedId}/messages`,
        options
      );
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "No se pudo enviar el mensaje.");
      }

      setMessages((current) => [...current, payload.data.message]);
      setContent("");
      setAttachment(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setSendState("idle");
    } catch (error) {
      setSendState("error");
      setSendError(
        error instanceof Error ? error.message : "No se pudo enviar el mensaje."
      );
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[620px] flex-col overflow-hidden rounded-lg border bg-background lg:flex-row">
      <aside
        className={
          selectedId
            ? "hidden min-h-0 border-r lg:flex lg:w-[360px] lg:flex-col"
            : "flex min-h-0 flex-1 flex-col lg:w-[360px] lg:flex-none lg:border-r"
        }
      >
        <div className="space-y-3 border-b p-4">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-md border p-2">
              <p className="font-semibold">{meta.all_count}</p>
              <p className="text-muted-foreground">Todas</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="font-semibold">{meta.unassigned_count}</p>
              <p className="text-muted-foreground">Sin asignar</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="font-semibold">{meta.assigned_count}</p>
              <p className="text-muted-foreground">Asignadas</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="font-semibold">{meta.mine_count}</p>
              <p className="text-muted-foreground">Mias</p>
            </div>
          </div>
          <Input
            value={query}
            placeholder="Buscar por cliente o mensaje"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Aun no tienes conversaciones.
            </p>
          ) : (
            filteredConversations.map((conversation) => {
              const active = selectedId === conversation.id;
              const labels = conversation.labels ?? [];

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={
                    active
                      ? "w-full border-b bg-muted/60 p-4 text-left"
                      : "w-full border-b p-4 text-left hover:bg-muted/40"
                  }
                  onClick={() => selectConversation(conversation)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {getSenderName(conversation)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {getChannel(conversation)} - {statusLabel(conversation.status)}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(conversation.last_activity_at)}
                    </p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {getLastMessage(conversation)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {conversation.unread_count > 0 ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        {conversation.unread_count} sin leer
                      </span>
                    ) : null}
                    {labels.slice(0, 2).map((label) => (
                      <span
                        key={label}
                        className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section
        className={
          selectedId
            ? "flex min-h-0 flex-1 flex-col"
            : "hidden min-h-0 flex-1 flex-col lg:flex"
        }
      >
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <div>
              <p className="text-lg font-medium">Selecciona una conversacion</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Elige un cliente de la bandeja para ver sus mensajes.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-start justify-between gap-3 border-b p-4">
              <div className="min-w-0">
                <button
                  type="button"
                  className="mb-2 text-sm text-muted-foreground lg:hidden"
                  onClick={() => {
                    setSelectedId(null);
                    router.replace("/conversations", { scroll: false });
                  }}
                >
                  Volver a conversaciones
                </button>
                <p className="truncate text-lg font-semibold">
                  {getSenderName(selectedConversation)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getSenderPhone(selectedConversation)} -{" "}
                  {getChannel(selectedConversation)}
                </p>
              </div>
              <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                {statusLabel(selectedConversation?.status)}
              </span>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4">
              {loadState === "loading" ? (
                <p className="text-sm text-muted-foreground">
                  Cargando mensajes...
                </p>
              ) : null}
              {loadState === "error" ? (
                <p className="text-sm text-destructive">{loadError}</p>
              ) : null}
              {loadState !== "loading" && messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay mensajes para mostrar.
                </p>
              ) : null}
              <div className="space-y-3">
                {messages.map((message) => {
                  const isOutgoing = message.message_type === 1;
                  const messageContent = getMessageContent(message);
                  const hasAttachments = Boolean(message.attachments?.length);

                  if (!messageContent && !hasAttachments) {
                    return null;
                  }

                  return (
                    <div
                      key={message.id}
                      className={isOutgoing ? "flex justify-end" : "flex justify-start"}
                    >
                      <div
                        className={
                          isOutgoing
                            ? "max-w-[78%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground"
                            : "max-w-[78%] rounded-2xl border bg-background px-4 py-3"
                        }
                      >
                        {messageContent ? (
                          <p className="whitespace-pre-wrap text-sm">
                            {messageContent}
                          </p>
                        ) : null}
                        <AttachmentList message={message} />
                        <p
                          className={
                            isOutgoing
                              ? "mt-2 text-xs text-primary-foreground/70"
                              : "mt-2 text-xs text-muted-foreground"
                          }
                        >
                          {message.sender?.name ?? (isOutgoing ? "Equipo" : "Cliente")} -{" "}
                          {formatDate(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>
            </div>

            <form onSubmit={sendMessage} className="border-t bg-background p-4">
              <textarea
                value={content}
                disabled={sendState === "sending"}
                onKeyDown={handleKeyDown}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Escribe una respuesta..."
                className="min-h-20 w-full resize-none rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) =>
                      setAttachment(event.target.files?.[0] ?? null)
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sendState === "sending"}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Adjuntar
                  </Button>
                  {attachment ? (
                    <span className="text-xs text-muted-foreground">
                      {attachment.name}
                    </span>
                  ) : null}
                </div>
                <Button type="submit" disabled={sendState === "sending"}>
                  {sendState === "sending" ? "Enviando..." : "Enviar"}
                </Button>
              </div>
              {sendError ? (
                <p className="mt-2 text-xs text-destructive">{sendError}</p>
              ) : null}
            </form>
          </>
        )}
      </section>
    </div>
  );
}
