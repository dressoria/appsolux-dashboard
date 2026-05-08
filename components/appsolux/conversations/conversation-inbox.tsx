"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ChatwootConversation,
  ChatwootConversationsMeta,
  ChatwootMessage,
  ChatwootSender,
} from "@/types/chatwoot";

type ConversationInboxProps = {
  conversations: ChatwootConversation[];
  meta: ChatwootConversationsMeta;
  initialConversationId?: number;
};

type LoadState = "idle" | "loading" | "error";
type SendState = "idle" | "sending" | "error";
type Attachment = NonNullable<ChatwootMessage["attachments"]>[number];

const SYSTEM_EVENT_MARKERS = ["connection successfully established"];

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

function getSenderEmail(conversation?: ChatwootConversation | null) {
  return conversation?.meta?.sender?.email ?? null;
}

function getSenderInitial(conversation?: ChatwootConversation | null) {
  return getSenderName(conversation).trim().charAt(0).toUpperCase() || "C";
}

function formatChannel(rawChannel?: string) {
  const channel = rawChannel?.toLowerCase() ?? "";

  if (channel.includes("whatsapp")) {
    return "WhatsApp";
  }

  if (channel.includes("instagram")) {
    return "Instagram";
  }

  if (channel.includes("messenger") || channel.includes("facebook")) {
    return "Messenger";
  }

  if (channel.includes("web")) {
    return "Web";
  }

  return "Canal conectado";
}

function getChannel(conversation?: ChatwootConversation | null) {
  return formatChannel(conversation?.meta?.channel);
}

function normalizeSystemContent(content: string) {
  if (content.toLowerCase().includes("connection successfully established")) {
    return "Conexion establecida";
  }

  return content;
}

function getLastMessage(conversation: ChatwootConversation) {
  const content =
    conversation.last_non_activity_message?.processed_message_content ??
    conversation.last_non_activity_message?.content;

  return content?.trim()
    ? normalizeSystemContent(content.trim())
    : "Sin ultimo mensaje";
}

function getMessageContent(message: ChatwootMessage) {
  const content =
    message.processed_message_content?.trim() ?? message.content?.trim() ?? "";

  return normalizeSystemContent(content);
}

function isSystemMessage(message: ChatwootMessage) {
  const content = (
    message.processed_message_content ??
    message.content ??
    ""
  ).toLowerCase();

  return (
    message.message_type === 2 ||
    SYSTEM_EVENT_MARKERS.some((marker) => content.includes(marker))
  );
}

function isImageAttachment(attachment: Attachment) {
  return attachment.file_type === "image";
}

function getAttachmentUrl(attachment: Attachment) {
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
            <a
              key={`${url}-${index}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={name}
                className="max-h-72 rounded-xl border object-contain shadow-sm"
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
            className="inline-flex rounded-lg border bg-background px-3 py-2 text-sm text-foreground shadow-sm hover:bg-muted"
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

function getReadableAttributes(sender?: ChatwootSender) {
  const attributes = {
    ...(sender?.additional_attributes ?? {}),
    ...(sender?.custom_attributes ?? {}),
  };

  return Object.entries(attributes)
    .filter(([, value]) => {
      if (value === null || value === undefined) {
        return false;
      }

      if (typeof value === "object") {
        return false;
      }

      return String(value).trim().length > 0;
    })
    .slice(0, 6);
}

function ContactInfoPanel({
  conversation,
  onClose,
}: {
  conversation: ChatwootConversation | null;
  onClose: () => void;
}) {
  const sender = conversation?.meta?.sender;
  const attributes = getReadableAttributes(sender);
  const labels = conversation?.labels ?? [];

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l bg-background shadow-2xl xl:static xl:z-auto xl:w-[340px] xl:shrink-0 xl:shadow-none">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Contacto</p>
          <p className="text-xs text-muted-foreground">
            Informacion del cliente
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!conversation ? (
          <p className="text-sm text-muted-foreground">
            Selecciona una conversacion para ver el contacto.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                  {getSenderInitial(conversation)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {getSenderName(conversation)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {getSenderPhone(conversation)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <InfoRow label="Email" value={getSenderEmail(conversation)} />
                <InfoRow label="Canal" value={getChannel(conversation)} />
                <InfoRow
                  label="Estado"
                  value={statusLabel(conversation.status)}
                />
                <InfoRow
                  label="Ultima actividad"
                  value={formatDate(conversation.last_activity_at)}
                />
              </div>
            </div>

            <PanelSection title="Etiquetas">
              {labels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {labels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border px-2 py-1 text-xs text-muted-foreground"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyPanelText />
              )}
            </PanelSection>

            <PanelSection title="Atributos">
              {attributes.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {attributes.map(([key, value]) => (
                    <InfoRow
                      key={key}
                      label={key.replaceAll("_", " ")}
                      value={String(value)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyPanelText />
              )}
            </PanelSection>

            <PanelSection title="Notas">
              <p className="text-sm text-muted-foreground">
                Notas internas proximamente.
              </p>
            </PanelSection>

            <PanelSection title="Archivos">
              <p className="text-sm text-muted-foreground">
                Archivos compartidos apareceran aqui.
              </p>
            </PanelSection>

            <PanelSection title="Automatizaciones">
              <p className="text-sm text-muted-foreground">
                Automatizaciones proximamente.
              </p>
            </PanelSection>

            <PanelSection title="Integraciones">
              <p className="text-sm text-muted-foreground">
                Canales conectados.
              </p>
            </PanelSection>
          </div>
        )}
      </div>
    </aside>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">
        {value?.trim() || "Sin informacion"}
      </span>
    </div>
  );
}

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyPanelText() {
  return (
    <p className="text-sm text-muted-foreground">Sin informacion registrada.</p>
  );
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
  const [contactOpen, setContactOpen] = useState(Boolean(initialConversationId));

  const filteredConversations = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const haystack = [
        getSenderName(conversation),
        getSenderPhone(conversation),
        getSenderEmail(conversation),
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
    setContactOpen(true);
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
    <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border bg-background shadow-sm">
      <aside
        className={
          selectedId
            ? "hidden min-h-0 border-r bg-background lg:flex lg:w-[370px] lg:shrink-0 lg:flex-col"
            : "flex min-h-0 flex-1 flex-col bg-background lg:w-[370px] lg:shrink-0 lg:border-r"
        }
      >
        <div className="space-y-4 border-b p-4">
          <div>
            <p className="text-sm font-semibold">Bandeja</p>
            <p className="text-xs text-muted-foreground">
              Conversaciones de tus canales conectados
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <MetricPill label="Todas" value={meta.all_count} />
            <MetricPill label="Sin asignar" value={meta.unassigned_count} />
            <MetricPill label="Asignadas" value={meta.assigned_count} />
            <MetricPill label="Mias" value={meta.mine_count} />
          </div>

          <Input
            value={query}
            placeholder="Buscar cliente, telefono o mensaje"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Aun no tienes conversaciones.
              </p>
              <p className="mt-1">
                Cuando tus clientes escriban desde tus canales conectados,
                apareceran aqui.
              </p>
            </div>
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
                      ? "relative w-full border-b bg-primary/5 p-4 text-left"
                      : "relative w-full border-b p-4 text-left hover:bg-muted/40"
                  }
                  onClick={() => selectConversation(conversation)}
                >
                  {active ? (
                    <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary" />
                  ) : null}
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {getSenderInitial(conversation)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {getSenderName(conversation)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {getChannel(conversation)} ·{" "}
                            {statusLabel(conversation.status)}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(conversation.last_activity_at)}
                        </p>
                      </div>

                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {getLastMessage(conversation)}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
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
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <div
        className={
          selectedId
            ? "relative flex min-h-0 flex-1"
            : "relative hidden min-h-0 flex-1 lg:flex"
        }
      >
        <section className="flex min-h-0 flex-1 flex-col bg-muted/20">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <div className="max-w-sm rounded-2xl border bg-background p-6 shadow-sm">
                <p className="text-lg font-semibold">
                  Selecciona una conversacion
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Elige un cliente de la bandeja para ver mensajes, responder y
                  consultar la informacion del contacto.
                </p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    className="mb-2 text-sm text-muted-foreground lg:hidden"
                    onClick={() => {
                      setSelectedId(null);
                      setContactOpen(false);
                      router.replace("/conversations", { scroll: false });
                    }}
                  >
                    Volver a conversaciones
                  </button>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary sm:flex">
                      {getSenderInitial(selectedConversation)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">
                        {getSenderName(selectedConversation)}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {getSenderPhone(selectedConversation)} ·{" "}
                        {getChannel(selectedConversation)} ·{" "}
                        {statusLabel(selectedConversation?.status)}
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setContactOpen((current) => !current)}
                >
                  {contactOpen ? "Ocultar contacto" : "Ver contacto"}
                </Button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {loadState === "loading" ? (
                  <p className="text-sm text-muted-foreground">
                    Cargando mensajes...
                  </p>
                ) : null}
                {loadState === "error" ? (
                  <p className="text-sm text-destructive">{loadError}</p>
                ) : null}
                {loadState !== "loading" && messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div className="max-w-sm rounded-2xl border bg-background p-6 shadow-sm">
                      <p className="font-semibold">No hay mensajes para mostrar.</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Si la bandeja muestra actividad reciente, intenta
                        recargar la conversacion.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-4">
                  {messages.map((message) => {
                    const outgoing = message.message_type === 1;
                    const system = isSystemMessage(message);
                    const messageContent = getMessageContent(message);
                    const hasAttachments = Boolean(message.attachments?.length);

                    if (!messageContent && !hasAttachments) {
                      return null;
                    }

                    if (system) {
                      return (
                        <div key={message.id} className="flex justify-center">
                          <div className="rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                            {messageContent || "Evento de sistema"} ·{" "}
                            {formatDate(message.created_at)}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={message.id}
                        className={outgoing ? "flex justify-end" : "flex justify-start"}
                      >
                        <div
                          className={
                            outgoing
                              ? "max-w-[82%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground shadow-sm md:max-w-[68%]"
                              : "max-w-[82%] rounded-2xl rounded-bl-md border bg-background px-4 py-3 shadow-sm md:max-w-[68%]"
                          }
                        >
                          {messageContent ? (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {messageContent}
                            </p>
                          ) : null}
                          <AttachmentList message={message} />
                          <p
                            className={
                              outgoing
                                ? "mt-2 text-xs text-primary-foreground/70"
                                : "mt-2 text-xs text-muted-foreground"
                            }
                          >
                            {message.sender?.name ?? (outgoing ? "Equipo" : "Cliente")} ·{" "}
                            {formatDate(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messageEndRef} />
                </div>
              </div>

              <form
                onSubmit={sendMessage}
                className="border-t bg-background px-4 py-3"
              >
                <textarea
                  value={content}
                  disabled={sendState === "sending"}
                  onKeyDown={handleKeyDown}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="min-h-20 w-full resize-none rounded-xl border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
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
                      <span className="truncate text-xs text-muted-foreground">
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

        {contactOpen ? (
          <ContactInfoPanel
            conversation={selectedConversation}
            onClose={() => setContactOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-2">
      <p className="font-semibold">{value}</p>
      <p className="truncate text-muted-foreground">{label}</p>
    </div>
  );
}
