import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SRI_DOCUMENT_TYPE_LABELS } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

const DOCUMENT_CATALOG = [
  {
    type: "INVOICE",
    code: "01",
    description: "Comprobante de venta que sustenta credito tributario. El mas comun.",
    validFor: ["Ventas a consumidor final", "Ventas a otras empresas", "Exportaciones"],
  },
  {
    type: "CREDIT_NOTE",
    code: "04",
    description: "Anula total o parcialmente una factura emitida. Devuelve IVA y no genera retencion.",
    validFor: ["Devolucion de mercaderia", "Descuentos posteriores a la factura", "Anulacion parcial"],
  },
  {
    type: "DEBIT_NOTE",
    code: "05",
    description: "Incrementa el valor de una factura emitida por intereses, mora o diferencias.",
    validFor: ["Intereses por mora", "Ajuste de precio posterior", "Diferencias de valor"],
  },
  {
    type: "WITHHOLDING",
    code: "07",
    description: "Comprobante de retencion de impuestos emitido por agentes de retencion.",
    validFor: ["Retencion en la fuente de renta", "Retencion de IVA", "Solo agentes autorizados"],
  },
  {
    type: "REFERRAL_GUIDE",
    code: "06",
    description: "Acompana el traslado de mercancias. Requerida en transporte de bienes.",
    validFor: ["Traslado de mercaderia", "Ventas con entrega a domicilio", "Transferencias entre bodegas"],
  },
];

export default async function SriDocumentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <SriModuleShell
        title="Comprobantes electronicos"
        description="Tipos de comprobantes electronicos soportados para emision SRI Ecuador."
        activeHref={routes.sriDocuments}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </SriModuleShell>
    );
  }

  // tenant resolved for future use (document stats, etc.)
  const tenant = await getCurrentTenant(user);
  void tenant;

  return (
    <SriModuleShell
      title="Comprobantes electronicos"
      description="Estructura de comprobantes preparada. La emision, autorizacion y generacion de RIDE se implementaran en la fase de emision."
      activeHref={routes.sriDocuments}
    >
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">Fase de preparacion</p>
        <p className="mt-1">
          La estructura de comprobantes electronicos esta lista. La emision real contra el SRI
          (generacion de XML, firma XAdES, autorizacion y entrega de RIDE) se implementara
          en la siguiente fase una vez completada la configuracion.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DOCUMENT_CATALOG.map((doc) => (
          <Card key={doc.type}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">
                  {SRI_DOCUMENT_TYPE_LABELS[doc.type]}
                </CardTitle>
                <div className="space-y-1 text-right">
                  <span className="block font-mono text-xs text-muted-foreground">
                    Tipo {doc.code}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                    Preparado
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{doc.description}</p>
              <div>
                <p className="mb-1 text-xs font-medium text-foreground">Aplica para:</p>
                <ul className="space-y-0.5">
                  {doc.validFor.map((item) => (
                    <li key={item} className="text-xs text-muted-foreground">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proceso de emision (proxima fase)</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>1. Generacion de XML segun esquema SRI</li>
            <li>2. Firma digital con certificado .p12 (XAdES-BES)</li>
            <li>3. Envio al web service del SRI (pruebas o produccion)</li>
            <li>4. Recepcion de clave de acceso y numero de autorizacion</li>
            <li>5. Generacion de RIDE (representacion impresa)</li>
            <li>6. Envio por correo al cliente (opcional)</li>
            <li>7. Almacenamiento del XML autorizado</li>
          </ol>
        </CardContent>
      </Card>
    </SriModuleShell>
  );
}
