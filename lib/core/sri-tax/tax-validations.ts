import { isValidEcuadorCedula, isValidEcuadorRuc } from "../ecuador-tax-id";
import {
  calculateModulo11CheckDigit,
  getSriDocumentCode,
} from "../sri-access-key";
import { formatEcuadorSriDateCompact } from "../sri-ecuador-date";
import { decimal, money, sum } from "./money";
import {
  isDefinitive,
  type TaxSnapshot,
  type TaxIssue,
  type TaxDocument,
} from "./types";

export function assertTaxScope(data: TaxSnapshot) {
  if (
    !data.tenantId ||
    data.documents.some((d) => d.tenantId !== data.tenantId) ||
    data.inbox.some((i) => i.tenantId !== data.tenantId)
  ) {
    throw new Error("TAX_TENANT_SCOPE_VIOLATION");
  }
}

export function validateTaxSnapshot(data: TaxSnapshot): TaxIssue[] {
  assertTaxScope(data);
  const issues: TaxIssue[] = [];
  const add = (
    code: string,
    severity: TaxIssue["severity"],
    description: string,
    action: string,
    d?: TaxDocument,
  ) =>
    issues.push({
      code,
      severity,
      type: d?.direction ?? "PERIOD",
      document: d?.number ?? d?.id ?? null,
      description,
      action,
      href: d?.href ?? null,
    });
  if (!data.profile || !isValidEcuadorRuc(data.profile.ruc))
    add(
      "INFORMANT_RUC_INVALID",
      "ERROR",
      "RUC del informante ausente o inválido.",
      "Complete los datos fiscales en Configuración → SRI.",
    );
  const keys = new Map<string, string>();
  for (const d of data.documents) {
    if (d.accessKey && d.status !== "CANCELLED") {
      if (keys.has(d.accessKey))
        add(
          "DUPLICATE_ACCESS_KEY",
          "ERROR",
          "Clave de acceso duplicada entre documentos.",
          "Revise el origen de ambos registros.",
          d,
        );
      keys.set(d.accessKey, d.id);
    }
    if (!isDefinitive(d)) {
      if (!["CANCELLED", "REJECTED"].includes(d.status))
        add(
          "DOCUMENT_PENDING",
          "WARNING",
          "Documento pendiente; excluido de transacciones definitivas.",
          "Revise su estado.",
          d,
        );
      if (d.status === "REJECTED" || d.status === "VALIDATION_ERROR")
        add(
          "DOCUMENT_ERROR",
          "ERROR",
          "Comprobante con error fiscal.",
          "Revise el documento.",
          d,
        );
      continue;
    }
    if (d.type === "REFERRAL_GUIDE") continue;
    if (!d.identification || !d.name)
      add(
        d.direction === "PURCHASE"
          ? "PURCHASE_SUPPLIER_MISSING"
          : "SALE_CUSTOMER_INVALID",
        "ERROR",
        "Emisor o receptor sin identificación o nombre.",
        "Complete el tercero del documento.",
        d,
      );
    else if (
      (d.identification !== "9999999999999" &&
        (d.identificationType === "RUC" ||
          (!d.identificationType && d.identification.length === 13)) &&
        !isValidEcuadorRuc(d.identification)) ||
      (d.identificationType === "CEDULA" &&
        !isValidEcuadorCedula(d.identification))
    )
      add(
        "IDENTIFICATION_INVALID",
        "ERROR",
        "Identificación del tercero inválida.",
        "Verifique el documento de identidad.",
        d,
      );
    if (
      d.direction === "SALE" &&
      !d.identificationType &&
      d.identification !== "9999999999999"
    )
      add(
        "IDENTIFICATION_TYPE_MISSING",
        "ERROR",
        "Falta el tipo de identificación.",
        "Complete la identificación del cliente.",
        d,
      );
    if (d.direction === "PURCHASE" && !d.category)
      add(
        "PURCHASE_CATEGORY_MISSING",
        "WARNING",
        "Compra sin categoría contable.",
        "Clasifique la compra.",
        d,
      );
    if (
      ["INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "PURCHASE_SETTLEMENT"].includes(
        d.type,
      ) &&
      !d.fiscalClassification
    )
      add(
        "FISCAL_CLASSIFICATION_MISSING",
        "WARNING",
        "Operación por clasificar para el reporte IVA.",
        "Revise su clasificación fiscal en Reporte IVA 104.",
        d,
      );
    if (d.type === "CREDIT_NOTE" && !d.relatedDocument)
      add(
        "CREDIT_NOTE_ORIGIN_MISSING",
        "WARNING",
        "No consta el documento modificado de la nota de crédito.",
        "Verifique el comprobante de origen antes de declarar.",
        d,
      );
    if (
      !d.number ||
      !/^(?!000)\d{3}-(?!000)\d{3}-(?!000000000)\d{9}$/.test(d.number)
    )
      add(
        "DOCUMENT_NUMBER_INVALID",
        "ERROR",
        "Establecimiento, punto de emisión o secuencial incompletos.",
        "Revise la numeración del documento.",
        d,
      );
    if (!d.authorization)
      add(
        "AUTHORIZATION_MISSING",
        "ERROR",
        "No consta número de autorización.",
        "Verifique la autorización original.",
        d,
      );
    if (d.accessKey) {
      const k = d.accessKey;
      const expectedRuc =
        d.direction === "SALE" ? data.profile?.ruc : d.identification;
      const valid =
        /^\d{49}$/.test(k) &&
        calculateModulo11CheckDigit(k.slice(0, 48)) === k[48] &&
        (!d.date ||
          k.slice(0, 8) === formatEcuadorSriDateCompact(new Date(d.date))) &&
        (!expectedRuc || k.slice(10, 23) === expectedRuc) &&
        (d.direction !== "SALE" || k[23] === "2") &&
        (!d.number || k.slice(24, 39) === d.number.replaceAll("-", "")) &&
        (![
          "INVOICE",
          "CREDIT_NOTE",
          "DEBIT_NOTE",
          "WITHHOLDING",
          "PURCHASE_SETTLEMENT",
        ].includes(d.type) ||
          k.slice(8, 10) === getSriDocumentCode(d.type));
      if (!valid)
        add(
          "ACCESS_KEY_INCONSISTENT",
          "ERROR",
          "Clave de acceso inconsistente con el documento o su dígito verificador.",
          "Contraste con el XML autorizado.",
          d,
        );
    } else if (d.direction === "SALE")
      add(
        "ACCESS_KEY_MISSING",
        "ERROR",
        "Documento electrónico sin clave de acceso.",
        "Revise la autorización del documento.",
        d,
      );
    if (d.type === "WITHHOLDING") {
      if (!d.withholding.length)
        add(
          "WITHHOLDING_LINES_MISSING",
          "ERROR",
          "Retención sin líneas tributarias.",
          "Revise los impuestos retenidos.",
          d,
        );
      for (const line of d.withholding) {
        if (
          !line.purchaseNumber ||
          !data.documents.some(
            (p) =>
              p.direction === "PURCHASE" &&
              p.number === line.purchaseNumber &&
              isDefinitive(p),
          )
        )
          add(
            "WITHHOLDING_PURCHASE_MISSING",
            "WARNING",
            "Retención sin compra origen registrada en este período.",
            "Revise la compra y su período.",
            d,
          );
        if (!line.catalogValid)
          add(
            "WITHHOLDING_CATALOG_INVALID",
            "ERROR",
            "Código de retención sin correspondencia válida en el catálogo registrado.",
            "Revise el código y su vigencia.",
            d,
          );
        if (
          money(decimal(line.base).mul(line.rate).div(100)) !==
          money(line.amount)
        )
          add(
            "WITHHOLDING_AMOUNT_INCONSISTENT",
            "ERROR",
            "Valor retenido inconsistente con base y porcentaje.",
            "Revise la retención original.",
            d,
          );
      }
    } else {
      if (!d.lines.length)
        add(
          "TAX_LINES_MISSING",
          "WARNING",
          "Sin detalle de tasas históricas; no se infiere una tarifa desde los totales.",
          "Revise el detalle original.",
          d,
        );
      else {
        const mismatch = d.lines.some(
          (l) =>
            decimal(l.rate).lt(0) ||
            decimal(l.base).lt(0) ||
            money(decimal(l.base).mul(l.rate).div(100)) !== money(l.iva),
        );
        if (
          mismatch ||
          money(sum(d.lines.map((l) => l.iva))) !== d.iva ||
          money(sum(d.lines.map((l) => l.base))) !== d.base
        )
          add(
            d.direction === "SALE"
              ? "SALE_IVA_INCONSISTENT"
              : "PURCHASE_IVA_INCONSISTENT",
            "ERROR",
            "Bases o IVA inconsistentes con el detalle y las tasas almacenadas.",
            "Revise el documento sin alterar datos históricos.",
            d,
          );
      }
    }
  }
  for (const i of data.inbox) {
    if (
      i.accessKey &&
      keys.has(i.accessKey) &&
      keys.get(i.accessKey) !== i.purchaseDocumentId
    )
      issues.push({
        code: "DUPLICATE_ACCESS_KEY",
        severity: "ERROR",
        type: "RECEIVED",
        document: i.number ?? i.id,
        description: "Clave recibida duplicada en documentos del período.",
        action: "Revise la duplicación antes de registrar.",
        href: "/facturacion/sri/received",
      });
    if (i.accessKey && !i.purchaseDocumentId) keys.set(i.accessKey, i.id);
    if (!["REGISTERED", "IGNORED"].includes(i.status))
      issues.push({
        code: "RECEIVED_PENDING",
        severity: "WARNING",
        type: "RECEIVED",
        document: i.number ?? i.id,
        description: "Comprobante recibido pendiente de revisión o registro.",
        action: "Revise el comprobante recibido.",
        href: "/facturacion/sri/received",
      });
  }
  if (data.undatedCount)
    add(
      "DOCUMENTS_WITHOUT_PERIOD",
      "WARNING",
      `${data.undatedCount} documentos sin fecha no pueden atribuirse a un período.`,
      "Complete sus fechas en Compras o Comprobantes.",
    );
  add(
    "RECEIVED_WITHHOLDINGS_UNAVAILABLE",
    "WARNING",
    "Pueden existir retenciones recibidas aún no registradas. El modelo actual no permite determinar su IVA retenido.",
    "Contraste las retenciones recibidas con SRI.",
  );
  return issues;
}
