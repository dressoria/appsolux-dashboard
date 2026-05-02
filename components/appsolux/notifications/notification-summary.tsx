import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppsoluxNotification } from "@/types/notification";

type NotificationSummaryProps = {
  notifications: AppsoluxNotification[];
};

export function NotificationSummary({
  notifications,
}: NotificationSummaryProps) {
  const unreadCount = notifications.filter(
    (notification) => notification.status === "unread"
  ).length;
  const urgentCount = notifications.filter(
    (notification) => notification.priority === "urgent"
  ).length;
  const paymentsAndReceiptsCount = notifications.filter((notification) =>
    ["payment", "receipt"].includes(notification.category)
  ).length;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>Total</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{notifications.length}</p>
          <p className="text-xs text-muted-foreground">Alertas internas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>No leidas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{unreadCount}</p>
          <p className="text-xs text-muted-foreground">Requieren atencion</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Urgentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{urgentCount}</p>
          <p className="text-xs text-muted-foreground">Prioridad maxima</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos y comprobantes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{paymentsAndReceiptsCount}</p>
          <p className="text-xs text-muted-foreground">Finanzas operativas</p>
        </CardContent>
      </Card>
    </div>
  );
}
