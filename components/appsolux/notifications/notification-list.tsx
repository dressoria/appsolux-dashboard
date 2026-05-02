import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AppsoluxNotification,
  NotificationCategory,
  NotificationPriority,
  NotificationSource,
  NotificationStatus,
} from "@/types/notification";

type NotificationListProps = {
  notifications: AppsoluxNotification[];
};

const categoryLabels: Record<NotificationCategory, string> = {
  payment: "Pago",
  receipt: "Comprobante",
  automation: "Automatizacion",
  lead: "Lead",
  inventory: "Inventario",
  order: "Pedido",
  system: "Sistema",
};

const priorityLabels: Record<NotificationPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const statusLabels: Record<NotificationStatus, string> = {
  unread: "No leida",
  read: "Leida",
  archived: "Archivada",
};

const sourceLabels: Record<NotificationSource, string> = {
  appsolux: "Appsolux",
  n8n: "Automatizacion",
  chatwoot: "Chatwoot",
  erpnext: "ERPNext",
  evolution: "Evolution",
  meta: "Meta",
};

const priorityClasses: Record<NotificationPriority, string> = {
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-blue-200 bg-blue-50 text-blue-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  urgent: "border-destructive/30 bg-destructive/10 text-destructive",
};

const statusClasses: Record<NotificationStatus, string> = {
  unread: "border-foreground/15 bg-foreground text-background",
  read: "border-border bg-background text-muted-foreground",
  archived: "border-border bg-muted text-muted-foreground",
};

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function Badge({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

export function NotificationList({ notifications }: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">No hay notificaciones internas</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cuando existan eventos para este tenant apareceran aqui.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificaciones recientes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="rounded-lg border bg-background p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{notification.title}</p>
                <p className="text-sm text-muted-foreground">
                  {notification.description}
                </p>
              </div>
              <Badge className={statusClasses[notification.status]}>
                {statusLabels[notification.status]}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="border-border bg-muted text-muted-foreground">
                {categoryLabels[notification.category]}
              </Badge>
              <Badge className={priorityClasses[notification.priority]}>
                {priorityLabels[notification.priority]}
              </Badge>
              <Badge className="border-border bg-background text-muted-foreground">
                {sourceLabels[notification.source]}
              </Badge>
              <Badge className="border-border bg-background text-muted-foreground">
                {formatNotificationDate(notification.created_at)}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
