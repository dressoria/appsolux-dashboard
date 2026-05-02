import { NotificationList } from "@/components/appsolux/notifications/notification-list";
import { NotificationSummary } from "@/components/appsolux/notifications/notification-summary";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { demoNotifications } from "@/lib/notifications/demo-notifications";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function NotificationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver tus notificaciones internas de Appsolux.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const notifications = demoNotifications
    .filter((notification) => notification.tenant_id === tenant.id)
    .sort(
      (leftNotification, rightNotification) =>
        new Date(rightNotification.created_at).getTime() -
        new Date(leftNotification.created_at).getTime()
    );

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Centro interno</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Notificaciones
          </h1>
          <p className="mt-2 text-muted-foreground">
            Aqui se mostraran alertas internas de pagos, comprobantes, leads,
            inventario, pedidos, automatizaciones y eventos importantes.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tenant: {tenant.name}
          </p>
        </div>

        <NotificationSummary notifications={notifications} />
        <NotificationList notifications={notifications} />
      </div>
    </DashboardShell>
  );
}
