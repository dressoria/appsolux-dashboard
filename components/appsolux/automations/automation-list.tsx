import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AppsoluxAutomation,
  AutomationCategory,
  AutomationStatus,
  AutomationTriggerType,
} from "@/types/automation";

type AutomationListProps = {
  automations: AppsoluxAutomation[];
};

const categoryLabels: Record<AutomationCategory, string> = {
  inventory: "Inventario",
  payments: "Pagos",
  sales: "Ventas",
  support: "Atencion",
  follow_up: "Seguimiento",
  notifications: "Notificaciones",
  catalog: "Catalogo",
  system: "Sistema",
};

const statusLabels: Record<AutomationStatus, string> = {
  available: "Disponible",
  active: "Activa",
  paused: "Pausada",
  needs_setup: "Requiere configuracion",
  error: "Con error",
};

const triggerLabels: Record<AutomationTriggerType, string> = {
  manual: "Manual",
  schedule: "Programada",
  incoming_message: "Mensaje entrante",
  payment_received: "Pago recibido",
  inventory_low: "Inventario bajo",
  new_lead: "Nuevo lead",
  order_created: "Pedido creado",
};

const statusClasses: Record<AutomationStatus, string> = {
  available: "border-border bg-muted text-muted-foreground",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paused: "border-amber-200 bg-amber-50 text-amber-700",
  needs_setup: "border-blue-200 bg-blue-50 text-blue-700",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};

function formatAutomationDate(value: string | null) {
  if (!value) {
    return "Sin ejecuciones";
  }

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

export function AutomationList({ automations }: AutomationListProps) {
  if (automations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Automatizaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">No hay automatizaciones para este tenant</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cuando existan configuraciones base apareceran aqui.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatizaciones disponibles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {automations.map((automation) => (
          <div key={automation.id} className="rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{automation.title}</p>
                <p className="text-sm text-muted-foreground">
                  {automation.description}
                </p>
              </div>
              <Badge className={statusClasses[automation.status]}>
                {statusLabels[automation.status]}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Configuracion requerida
                </p>
                <p className="mt-1 text-sm">
                  {automation.required_setup.join(", ")}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Ultimo resultado
                </p>
                <p className="mt-1 text-sm">{automation.result_summary}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="border-border bg-muted text-muted-foreground">
                {categoryLabels[automation.category]}
              </Badge>
              <Badge className="border-border bg-background text-muted-foreground">
                {triggerLabels[automation.trigger_type]}
              </Badge>
              <Badge className="border-border bg-background text-muted-foreground">
                {formatAutomationDate(automation.last_run_at)}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
