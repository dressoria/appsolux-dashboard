import Link from "next/link";
import { SRI_CONFIGURATION_NAVIGATION } from "@/config/sri-tax-navigation";
import { Card, CardContent } from "@/components/ui/card";

export function SriConfigurationSection() {
  return (
    <section className="space-y-4" aria-label="Configuración SRI">
      <div>
        <h2 className="text-lg font-semibold">SRI</h2>
        <p className="text-sm text-muted-foreground">
          Prepara tu empresa para operar con el SRI.
        </p>
      </div>
      <Link
        className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        href="/facturacion/configuration/sri"
      >
        Abrir configuración SRI
      </Link>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SRI_CONFIGURATION_NAVIGATION.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Card className="h-full transition-colors hover:border-blue-400">
              <CardContent className="p-4">
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
