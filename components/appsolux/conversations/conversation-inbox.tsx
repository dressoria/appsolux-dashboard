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
import { LabelEditor } from "./label-editor";
import { NotesSection } from "./notes-section";
import { CommercePanel } from "./commerce-panel";

type ConversationInboxProps = {
  conversations: ChatwootConversation[];
  meta: ChatwootConversationsMeta;
  initialConversationId?: number;
};

type LoadState = "idle" | "loading" | "error";
type SendState = "idle" | "sending" | "error";
type ConversationFilter = "all" | "unassigned" | "assigned" | "mine";
type StatusFilter = "all" | "open" | "resolved" | "pending" | "snoozed";
type SortOption =
  | "last_activity_desc"
  | "last_activity_asc"
  | "created_desc"
  | "created_asc"
  | "unread_desc"
  | "unread_asc";
type Attachment = NonNullable<ChatwootMessage["attachments"]>[number];

const SYSTEM_EVENT_MARKERS = [
  "connection successfully established",
  "conversation was created",
  "contact joined",
];
const TECHNICAL_ATTRIBUTE_MARKERS = [
  "avatar",
  "hash",
  "sync",
  "identifier",
  "source",
  "thumbnail",
  "external",
  "provider",
  "last_seen",
  "created_at",
  "updated_at",
  "chatwoot",
  "account",
  "inbox",
  "uuid",
  "token",
];
const USEFUL_ATTRIBUTE_LABELS: Record<string, string> = {
  city: "Ciudad",
  ciudad: "Ciudad",
  country: "Pais",
  pais: "Pais",
  company: "Empresa",
  empresa: "Empresa",
  birthday: "Cumpleanos",
  birthdate: "Cumpleanos",
  ruc: "RUC",
  document: "Documento",
  documento: "Documento",
  address: "Direccion",
  direccion: "Direccion",
  notes: "Notas",
  notas: "Notas",
  website: "Web",
  web: "Web",
};

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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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

function getSenderKey(conversation?: ChatwootConversation | null) {
  const sender = conversation?.meta?.sender;

  return (
    sender?.email?.trim().toLowerCase() ||
    sender?.phone_number?.trim().toLowerCase() ||
    (sender?.id ? `sender:${sender.id}` : "")
  );
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
  const normalized = content.toLowerCase();

  if (normalized.includes("connection successfully established")) {
    return "Conexion establecida";
  }

  if (normalized.includes("conversation was created")) {
    return "Conversacion creada";
  }

  if (normalized.includes("contact joined")) {
    return "Contacto conectado";
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

function extractMessages(payload: unknown): ChatwootMessage[] {
  if (Array.isArray(payload)) {
    return payload as ChatwootMessage[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as {
    payload?: unknown;
    data?: unknown;
    messages?: unknown;
  };

  if (Array.isArray(record.payload)) {
    return record.payload as ChatwootMessage[];
  }

  if (Array.isArray(record.data)) {
    return record.data as ChatwootMessage[];
  }

  if (Array.isArray(record.messages)) {
    return record.messages as ChatwootMessage[];
  }

  return [];
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

function getAttachmentUrl(attachment: Attachment) {
  return (
    attachment.data_url ??
    attachment.file_url ??
    attachment.download_url ??
    attachment.thumb_url ??
    ""
  );
}

function getAttachmentKind(
  attachment: Attachment
): "image" | "audio" | "video" | "pdf" | "file" {
  const ft = (attachment.file_type ?? "").toLowerCase();
  const name = (attachment.name ?? "").toLowerCase();
  const ext = (attachment.extension ?? "").toLowerCase();

  if (ft === "image") return "image";
  if (ft === "audio") return "audio";
  if (ft === "video") return "video";
  if (ext === "pdf" || name.endsWith(".pdf")) return "pdf";
  return "file";
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
        const kind = getAttachmentKind(attachment);

        if (!url) {
          return null;
        }

        if (kind === "image") {
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

        if (kind === "audio") {
          return (
            <div
              key={`${url}-${index}`}
              className="rounded-xl border bg-muted/30 p-3"
            >
              <p className="mb-2 truncate text-xs text-muted-foreground">
                {name}
              </p>
              <audio controls src={url} className="w-full" preload="metadata">
                <track kind="captions" />
              </audio>
            </div>
          );
        }

        if (kind === "video") {
          return (
            <div
              key={`${url}-${index}`}
              className="overflow-hidden rounded-xl border"
            >
              <video
                controls
                src={url}
                className="max-h-60 w-full"
                preload="metadata"
              >
                <track kind="captions" />
              </video>
            </div>
          );
        }

        if (kind === "pdf") {
          return (
            <a
              key={`${url}-${index}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border bg-background p-3 shadow-sm hover:bg-muted/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-red-600">
                PDF
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">
                  Documento — Abrir
                </p>
              </div>
            </a>
          );
        }

        return (
          <a
            key={`${url}-${index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border bg-background p-3 shadow-sm hover:bg-muted/50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold uppercase text-muted-foreground">
              {attachment.extension ?? "FILE"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">Abrir archivo</p>
            </div>
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
    return "En pausa";
  }

  return "Sin estado";
}

function statusBadgeClass(status?: string) {
  if (status === "open") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "resolved") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "snoozed") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-border bg-background text-muted-foreground";
}

function getAssignmentSignal(conversation: ChatwootConversation) {
  const assignable = conversation as ChatwootConversation & {
    assignee?: unknown;
    assignee_id?: unknown;
  };

  return Boolean(assignable.assignee || assignable.assignee_id);
}

function hasAssignmentData(conversations: ChatwootConversation[]) {
  return conversations.some((conversation) =>
    Object.prototype.hasOwnProperty.call(conversation, "assignee") ||
    Object.prototype.hasOwnProperty.call(conversation, "assignee_id")
  );
}

function filterConversationsByTab(
  conversations: ChatwootConversation[],
  filter: ConversationFilter,
  canUseAssignmentFilters: boolean
) {
  if (filter === "all" || !canUseAssignmentFilters) {
    return conversations;
  }

  if (filter === "assigned" || filter === "mine") {
    return conversations.filter(getAssignmentSignal);
  }

  return conversations.filter((conversation) => !getAssignmentSignal(conversation));
}

function sortConversations(
  conversations: ChatwootConversation[],
  sortOption: SortOption
) {
  return [...conversations].sort((a, b) => {
    if (sortOption === "last_activity_asc") {
      return (a.last_activity_at ?? 0) - (b.last_activity_at ?? 0);
    }

    if (sortOption === "created_desc") {
      return (b.created_at ?? 0) - (a.created_at ?? 0);
    }

    if (sortOption === "created_asc") {
      return (a.created_at ?? 0) - (b.created_at ?? 0);
    }

    if (sortOption === "unread_desc") {
      return (b.unread_count ?? 0) - (a.unread_count ?? 0);
    }

    if (sortOption === "unread_asc") {
      return (a.unread_count ?? 0) - (b.unread_count ?? 0);
    }

    return (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0);
  });
}

function getStatusOptions(conversations: ChatwootConversation[]) {
  const statuses = new Set(conversations.map((conversation) => conversation.status));
  const options: Array<{ label: string; value: StatusFilter }> = [
    { label: "Todas", value: "all" },
  ];

  if (statuses.has("open")) {
    options.push({ label: "Abiertas", value: "open" });
  }

  if (statuses.has("resolved")) {
    options.push({ label: "Resueltas", value: "resolved" });
  }

  if (statuses.has("pending")) {
    options.push({ label: "Pendientes", value: "pending" });
  }

  if (statuses.has("snoozed")) {
    options.push({ label: "En pausa", value: "snoozed" });
  }

  return options;
}

function getChannelOptions(conversations: ChatwootConversation[]) {
  return Array.from(
    new Set(conversations.map((conversation) => getChannel(conversation)))
  ).sort((a, b) => a.localeCompare(b));
}

function getLabelOptions(conversations: ChatwootConversation[]) {
  return Array.from(
    new Set(conversations.flatMap((conversation) => conversation.labels ?? []))
  ).sort((a, b) => a.localeCompare(b));
}

function shouldShowAttribute(key: string, value: unknown) {
  const cleanKey = key.trim().toLowerCase();

  if (!cleanKey || value === null || value === undefined) {
    return false;
  }

  if (typeof value === "object") {
    return false;
  }

  const textValue = String(value).trim();

  if (!textValue) {
    return false;
  }

  if (USEFUL_ATTRIBUTE_LABELS[cleanKey]) {
    return true;
  }

  if (
    cleanKey === "id" ||
    cleanKey.endsWith("_id") ||
    cleanKey.endsWith(" id") ||
    TECHNICAL_ATTRIBUTE_MARKERS.some((marker) => cleanKey.includes(marker))
  ) {
    return false;
  }

  if (cleanKey.includes("url")) {
    return cleanKey.includes("web") || cleanKey.includes("site");
  }

  return true;
}

function formatAttributeLabel(key: string) {
  const cleanKey = key.trim().toLowerCase();

  if (USEFUL_ATTRIBUTE_LABELS[cleanKey]) {
    return USEFUL_ATTRIBUTE_LABELS[cleanKey];
  }

  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getReadableAttributes(sender?: ChatwootSender) {
  const attributes = {
    ...(sender?.additional_attributes ?? {}),
    ...(sender?.custom_attributes ?? {}),
  };

  return Object.entries(attributes)
    .filter(([key, value]) => shouldShowAttribute(key, value))
    .slice(0, 6);
}

function ContactInfoPanel({
  conversation,
  conversations,
  onSelectConversation,
  onClose,
  onLabelsChange,
  sharedFiles,
}: {
  conversation: ChatwootConversation | null;
  conversations: ChatwootConversation[];
  onSelectConversation: (conversation: ChatwootConversation) => void;
  onClose: () => void;
  onLabelsChange: (conversationId: number, newLabels: string[]) => void;
  sharedFiles: Attachment[];
}) {
  const sender = conversation?.meta?.sender;
  const attributes = getReadableAttributes(sender);
  const senderKey = getSenderKey(conversation);
  const previousConversations = senderKey
    ? conversations
        .filter(
          (item) =>
            item.id !== conversation?.id && getSenderKey(item) === senderKey
        )
        .sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0))
        .slice(0, 5)
    : [];

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
              {conversation ? (
                <LabelEditor
                  conversationId={conversation.id}
                  currentLabels={conversation.labels ?? []}
                  onLabelsChange={(newLabels) =>
                    onLabelsChange(conversation.id, newLabels)
                  }
                />
              ) : null}
            </PanelSection>

            <PanelSection title="Atributos">
              {attributes.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {attributes.map(([key, value]) => (
                    <InfoRow
                      key={key}
                      label={formatAttributeLabel(key)}
                      value={String(value)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin información adicional registrada.
                </p>
              )}
            </PanelSection>

            <PanelSection title="Conversaciones anteriores">
              {previousConversations.length > 0 ? (
                <div className="space-y-2">
                  {previousConversations.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full rounded-lg border p-3 text-left text-sm hover:bg-muted/50"
                      onClick={() => onSelectConversation(item)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">
                          {statusLabel(item.status)}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(item.last_activity_at)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">
                        {getLastMessage(item)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getChannel(item)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Las conversaciones anteriores aparecerán aquí cuando estén
                  disponibles.
                </p>
              )}
            </PanelSection>

            <PanelSection title="Notas internas">
              {conversation ? (
                <NotesSection conversationId={conversation.id} />
              ) : null}
            </PanelSection>

            <PanelSection title="Archivos compartidos">
              {sharedFiles.length > 0 ? (
                <div className="space-y-2">
                  {sharedFiles.slice(0, 5).map((file, index) => {
                    const url = getAttachmentUrl(file);
                    const name = file.name ?? `Archivo ${index + 1}`;
                    const kind = getAttachmentKind(file);

                    if (!url) return null;

                    return (
                      <a
                        key={`${url}-${index}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border bg-background p-2 text-sm hover:bg-muted/50"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold uppercase text-muted-foreground">
                          {kind === "image"
                            ? "IMG"
                            : kind === "audio"
                              ? "AUD"
                              : kind === "pdf"
                                ? "PDF"
                                : kind === "video"
                                  ? "VID"
                                  : (file.extension ?? "FILE")
                                      .toUpperCase()
                                      .slice(0, 4)}
                        </span>
                        <p className="min-w-0 truncate text-xs">{name}</p>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Los archivos compartidos aparecerán aquí.
                </p>
              )}
            </PanelSection>

            <PanelSection title="Cliente y ventas">
              {conversation ? (
                <CommercePanel
                  conversationId={conversation.id}
                  contactName={
                    conversation.meta?.sender?.name ?? undefined
                  }
                  contactPhone={
                    conversation.meta?.sender?.phone_number ?? undefined
                  }
                  contactEmail={
                    conversation.meta?.sender?.email ?? undefined
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Selecciona una conversacion para ver informacion comercial.
                </p>
              )}
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
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<
    string | null
  >(null);
  const previewUrlRef = useRef<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recordError, setRecordError] = useState("");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState("");
  const [contactOpen, setContactOpen] = useState(Boolean(initialConversationId));
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sortOption, setSortOption] =
    useState<SortOption>("last_activity_desc");
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const canUseAssignmentFilters = hasAssignmentData(conversations);
  const statusOptions = useMemo(
    () => getStatusOptions(conversations),
    [conversations]
  );
  const channelOptions = useMemo(
    () => getChannelOptions(conversations),
    [conversations]
  );
  const labelOptions = useMemo(
    () => getLabelOptions(conversations),
    [conversations]
  );
  const hasActiveFilters =
    filter !== "all" ||
    statusFilter !== "all" ||
    channelFilter !== "all" ||
    labelFilter !== "all" ||
    unreadOnly ||
    query.trim().length > 0;

  const filteredConversations = useMemo(() => {
    const cleanQuery = normalizeText(query);
    const conversationsByFilter = filterConversationsByTab(
      conversations,
      filter,
      canUseAssignmentFilters
    );

    const filtered = conversationsByFilter.filter((conversation) => {
      if (statusFilter !== "all" && conversation.status !== statusFilter) {
        return false;
      }

      if (channelFilter !== "all" && getChannel(conversation) !== channelFilter) {
        return false;
      }

      if (labelFilter === "__none" && (conversation.labels ?? []).length > 0) {
        return false;
      }

      if (
        labelFilter !== "all" &&
        labelFilter !== "__none" &&
        !(conversation.labels ?? []).includes(labelFilter)
      ) {
        return false;
      }

      if (unreadOnly && conversation.unread_count <= 0) {
        return false;
      }

      if (!cleanQuery) {
        return true;
      }

      const haystack = [
        getSenderName(conversation),
        getSenderPhone(conversation),
        getSenderEmail(conversation),
        getLastMessage(conversation),
        getChannel(conversation),
        ...(conversation.labels ?? []),
      ]
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      return haystack.includes(cleanQuery);
    });

    return sortConversations(filtered, sortOption);
  }, [
    canUseAssignmentFilters,
    channelFilter,
    conversations,
    filter,
    labelFilter,
    query,
    sortOption,
    statusFilter,
    unreadOnly,
  ]);

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
          setMessages(extractMessages(messagesPayload.data?.messages));
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
  }, [reloadToken, selectedId]);

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

  function clearFilters() {
    setFilter("all");
    setStatusFilter("all");
    setChannelFilter("all");
    setLabelFilter("all");
    setUnreadOnly(false);
    setQuery("");
  }

  function handleLabelsChange(conversationId: number, newLabels: string[]) {
    setSelectedConversation((prev) =>
      prev?.id === conversationId ? { ...prev, labels: newLabels } : prev
    );
  }

  useEffect(() => {
    async function updatePreview() {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      if (attachment?.type.startsWith("image/")) {
        const url = URL.createObjectURL(attachment);
        previewUrlRef.current = url;
        setAttachmentPreviewUrl(url);
      } else {
        setAttachmentPreviewUrl(null);
      }
    }
    void updatePreview();
  }, [attachment]);

  async function startRecording() {
    if (recording) return;
    setRecordError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setRecordError(
          "La grabacion de audio no esta disponible en este navegador."
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mimeType = recorder.mimeType || "audio/webm";
        const ext = mimeType.split("/")[1]?.split(";")[0] ?? "webm";
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], `nota-voz-${Date.now()}.${ext}`, {
          type: mimeType,
        });
        setAttachment(file);
        recorderRef.current = null;
        setRecording(false);
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setRecordError(
        name === "NotAllowedError"
          ? "No se pudo acceder al microfono."
          : "La grabacion de audio no esta disponible en este navegador."
      );
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  function clearAttachment() {
    setAttachment(null);
    setAttachmentPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const sharedFiles = useMemo(
    () =>
      messages
        .flatMap((m) => m.attachments ?? [])
        .filter((a) => Boolean(getAttachmentUrl(a))),
    [messages]
  );

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border bg-background shadow-sm">
      <aside
        className={
          selectedId
            ? "hidden min-h-0 border-r bg-background lg:flex lg:w-[370px] lg:shrink-0 lg:flex-col"
            : "flex min-h-0 flex-1 flex-col bg-background lg:w-[370px] lg:shrink-0 lg:border-r"
        }
      >
        <div className="space-y-3 border-b p-3">
          <div>
            <p className="text-sm font-semibold">Bandeja</p>
            <p className="text-xs text-muted-foreground">
              Conversaciones de tus canales conectados
            </p>
          </div>

          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 text-xs">
            <FilterChip
              active={filter === "all"}
              label="Todas"
              value={meta.all_count}
              onClick={() => setFilter("all")}
            />
            <FilterChip
              active={filter === "unassigned"}
              disabled={!canUseAssignmentFilters}
              label="Sin asignar"
              title={
                canUseAssignmentFilters
                  ? undefined
                  : "Asignación de agentes próximamente"
              }
              value={meta.unassigned_count}
              onClick={() => setFilter("unassigned")}
            />
            <FilterChip
              active={filter === "assigned"}
              disabled={!canUseAssignmentFilters}
              label="Asignadas"
              title={
                canUseAssignmentFilters
                  ? undefined
                  : "Asignación de agentes próximamente"
              }
              value={meta.assigned_count}
              onClick={() => setFilter("assigned")}
            />
            <FilterChip
              active={filter === "mine"}
              disabled={!canUseAssignmentFilters}
              label="Mias"
              title={
                canUseAssignmentFilters
                  ? undefined
                  : "Asignación de agentes próximamente"
              }
              value={meta.mine_count}
              onClick={() => setFilter("mine")}
            />
          </div>

          <Input
            value={query}
            placeholder="Buscar cliente, telefono o mensaje"
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="relative flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowFilters((current) => !current);
                setShowSort(false);
              }}
            >
              Filtros
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowSort((current) => !current);
                setShowFilters(false);
              }}
            >
              Ordenar
            </Button>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            ) : null}

            {showFilters ? (
              <div className="absolute left-0 top-10 z-20 w-[min(330px,calc(100vw-2rem))] rounded-xl border bg-background p-3 shadow-xl">
                <div className="space-y-3">
                  <FieldSelect
                    label="Estado"
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value as StatusFilter)}
                    options={statusOptions}
                  />
                  <FieldSelect
                    label="Canal"
                    value={channelFilter}
                    onChange={setChannelFilter}
                    options={[
                      { label: "Todos los canales", value: "all" },
                      ...channelOptions.map((channel) => ({
                        label: channel,
                        value: channel,
                      })),
                    ]}
                  />
                  {labelOptions.length > 0 ? (
                    <FieldSelect
                      label="Etiqueta"
                      value={labelFilter}
                      onChange={setLabelFilter}
                      options={[
                        { label: "Todas las etiquetas", value: "all" },
                        { label: "Sin etiquetas", value: "__none" },
                        ...labelOptions.map((label) => ({
                          label,
                          value: label,
                        })),
                      ]}
                    />
                  ) : null}
                  <label className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={unreadOnly}
                      onChange={(event) => setUnreadOnly(event.target.checked)}
                    />
                    Solo no leidas
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={clearFilters}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            ) : null}

            {showSort ? (
              <div className="absolute left-20 top-10 z-20 w-[min(300px,calc(100vw-2rem))] rounded-xl border bg-background p-2 shadow-xl">
                <SortButton
                  active={sortOption === "last_activity_desc"}
                  label="Actividad mas reciente"
                  onClick={() => setSortOption("last_activity_desc")}
                />
                <SortButton
                  active={sortOption === "last_activity_asc"}
                  label="Actividad mas antigua"
                  onClick={() => setSortOption("last_activity_asc")}
                />
                <SortButton
                  active={sortOption === "created_desc"}
                  label="Creacion mas reciente"
                  onClick={() => setSortOption("created_desc")}
                />
                <SortButton
                  active={sortOption === "created_asc"}
                  label="Creacion mas antigua"
                  onClick={() => setSortOption("created_asc")}
                />
                <SortButton
                  active={sortOption === "unread_desc"}
                  label="Mas mensajes sin leer"
                  onClick={() => setSortOption("unread_desc")}
                />
                <SortButton
                  active={sortOption === "unread_asc"}
                  label="Menos mensajes sin leer"
                  onClick={() => setSortOption("unread_asc")}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {conversations.length === 0 ? (
                <>
                  <p className="font-medium text-foreground">
                    Aun no tienes conversaciones.
                  </p>
                  <p className="mt-1">
                    Cuando tus clientes escriban desde tus canales conectados,
                    apareceran aqui.
                  </p>
                </>
              ) : query.trim() ? (
                <>
                  <p className="font-medium text-foreground">
                    No encontramos conversaciones con esa busqueda.
                  </p>
                  <p className="mt-1">
                    Prueba con otro nombre, telefono, canal o etiqueta.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={clearFilters}
                  >
                    Limpiar filtros
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">
                    No hay conversaciones que coincidan con estos filtros.
                  </p>
                  <p className="mt-1">Ajusta los filtros para ver mas resultados.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={clearFilters}
                  >
                    Limpiar filtros
                  </Button>
                </>
              )}
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
                            {getChannel(conversation)}
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
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(
                            conversation.status
                          )}`}
                        >
                          {statusLabel(conversation.status)}
                        </span>
                        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                          {getAssignmentSignal(conversation)
                            ? "Asignada"
                            : "Sin asignar"}
                        </span>
                        {conversation.unread_count > 0 ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                            {conversation.unread_count}{" "}
                            {conversation.unread_count === 1
                              ? "sin leer"
                              : "sin leer"}
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
                        {getSenderPhone(selectedConversation)} -{" "}
                        {getChannel(selectedConversation)} -{" "}
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
                      <p className="font-semibold">
                        No pudimos cargar los mensajes de esta conversación.
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Si la bandeja muestra actividad reciente, intenta
                        recargar la conversación.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setReloadToken((current) => current + 1)}
                      >
                        Reintentar
                      </Button>
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
                            {messageContent || "Evento de sistema"} -{" "}
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
                            {message.sender?.name ?? (outgoing ? "Equipo" : "Cliente")} -{" "}
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
                {attachment ? (
                  <div className="mb-2 flex items-center gap-2 rounded-xl border bg-muted/30 p-2">
                    {attachmentPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={attachmentPreviewUrl}
                        alt={attachment.name}
                        className="h-12 w-12 rounded-lg border object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold uppercase text-muted-foreground">
                        {attachment.type.startsWith("audio/")
                          ? "AUD"
                          : attachment.type === "application/pdf"
                            ? "PDF"
                            : "FILE"}
                      </span>
                    )}
                    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {attachment.name}
                    </p>
                    <button
                      type="button"
                      aria-label="Quitar archivo"
                      className="shrink-0 rounded-full px-1 text-xs text-muted-foreground hover:text-destructive"
                      onClick={clearAttachment}
                    >
                      ✕
                    </button>
                  </div>
                ) : null}
                <textarea
                  value={content}
                  disabled={sendState === "sending" || recording}
                  onKeyDown={handleKeyDown}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="min-h-20 w-full resize-none rounded-xl border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm,audio/mp4,audio/aac"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setAttachment(file);
                        setRecordError("");
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={sendState === "sending" || recording}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Adjuntar archivo
                    </Button>
                    {recording ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={stopRecording}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        Detener grabacion
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={sendState === "sending" || Boolean(attachment)}
                        onClick={() => void startRecording()}
                      >
                        {recording ? "Grabando..." : "Nota de voz"}
                      </Button>
                    )}
                    {recording ? (
                      <span className="text-xs text-red-600">Grabando...</span>
                    ) : null}
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sendState === "sending" || recording}
                  >
                    {sendState === "sending" ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
                {sendError ? (
                  <p className="mt-2 text-xs text-destructive">{sendError}</p>
                ) : null}
                {recordError ? (
                  <p className="mt-1 text-xs text-destructive">{recordError}</p>
                ) : null}
              </form>
            </>
          )}
        </section>

        {contactOpen ? (
          <ContactInfoPanel
            conversation={selectedConversation}
            conversations={conversations}
            onSelectConversation={selectConversation}
            onClose={() => setContactOpen(false)}
            onLabelsChange={handleLabelsChange}
            sharedFiles={sharedFiles}
          />
        ) : null}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  disabled = false,
  label,
  onClick,
  title,
  value,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  title?: string;
  value: number;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? "Asignacion de agentes proximamente" : title}
      className={
        active
          ? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
          : "rounded-full border bg-background px-3 py-1 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-55"
      }
      onClick={onClick}
    >
      {label} ({value})
    </button>
  );
}

function FieldSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "block w-full rounded-lg bg-primary px-3 py-2 text-left text-sm font-medium text-primary-foreground"
          : "block w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      }
      onClick={onClick}
    >
      {label}
    </button>
  );
}
