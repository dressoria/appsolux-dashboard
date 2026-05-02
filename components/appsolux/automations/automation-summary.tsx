import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppsoluxAutomation } from "@/types/automation";

type AutomationSummaryProps = {
  automations: AppsoluxAutomation[];
};

export function AutomationSummary({ automations }: AutomationSummaryProps) {
  const activeCount = automations.filter(
    (automation) => automation.status === "active"
  ).length;
  const needsSetupCount = automations.filter(
    (automation) => automation.status === "needs_setup"
  ).length;
  const errorCount = automations.filter(
    (automation) => automation.status === "error"
  ).length;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>Total</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{automations.length}</p>
          <p className="text-xs text-muted-foreground">
            Automatizaciones base
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{activeCount}</p>
          <p className="text-xs text-muted-foreground">Operando para el tenant</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requieren configuracion</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{needsSetupCount}</p>
          <p className="text-xs text-muted-foreground">Pendientes de completar</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Con error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{errorCount}</p>
          <p className="text-xs text-muted-foreground">Necesitan revision</p>
        </CardContent>
      </Card>
    </div>
  );
}
