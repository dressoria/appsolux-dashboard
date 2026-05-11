import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ErpnextPrintDoctype } from "@/lib/api/erpnext/print";

type DocumentActionsProps = {
  doctype: ErpnextPrintDoctype;
  name: string;
  showPdf?: boolean;
  showDownload?: boolean;
  showXml?: boolean;
  xmlStatus?: "disabled" | "preparation" | "available";
  xmlLabel?: string;
  printFormat?: string;
  className?: string;
  size?: "xs" | "sm" | "default";
};

function buildPdfHref(
  doctype: ErpnextPrintDoctype,
  name: string,
  action: string,
  printFormat?: string
) {
  const params = new URLSearchParams({ doctype, name, action });
  if (printFormat) {
    params.set("print_format", printFormat);
  }
  return `/api/erpnext/documents/pdf?${params.toString()}`;
}

export function DocumentActions({
  doctype,
  name,
  showPdf = true,
  showDownload = true,
  showXml = false,
  xmlStatus = "preparation",
  xmlLabel,
  printFormat,
  className,
  size = "sm",
}: DocumentActionsProps) {
  const xmlText =
    xmlLabel ??
    (doctype === "Purchase Invoice"
      ? "XML proveedor en preparacion"
      : "XML en preparacion");

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {showPdf ? (
        <Button asChild size={size} variant="outline">
          <Link
            href={buildPdfHref(doctype, name, "view", printFormat)}
            target="_blank"
            rel="noreferrer"
          >
            Ver PDF
          </Link>
        </Button>
      ) : null}
      {showDownload ? (
        <Button asChild size={size} variant="outline">
          <Link href={buildPdfHref(doctype, name, "download", printFormat)}>
            Descargar PDF
          </Link>
        </Button>
      ) : null}
      {showXml ? (
        <Button
          type="button"
          size={size}
          variant="outline"
          disabled={xmlStatus !== "available"}
          title="El XML fiscal estara disponible cuando el modulo SRI este activo."
        >
          {xmlText}
        </Button>
      ) : null}
    </div>
  );
}
