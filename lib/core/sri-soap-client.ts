import "@/lib/security/server-only";

const DEFAULT_SOAP_URL =
  "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline";
const SOAP_TIMEOUT_MS = 30_000;

export type SoapAuthorizationResult = {
  authorized: boolean;
  status: string;
  authorizationNumber: string | null;
  authorizationDate: string | null;
  xml: string | null;
  environment: string | null;
  errors: string[];
};

function buildSoapEnvelope(accessKey: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">',
    "  <soapenv:Header/>",
    "  <soapenv:Body>",
    "    <ec:autorizacionComprobante>",
    `      <claveAccesoComprobante>${accessKey}</claveAccesoComprobante>`,
    "    </ec:autorizacionComprobante>",
    "  </soapenv:Body>",
    "</soapenv:Envelope>",
  ].join("\n");
}

function extractSoapTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w]+:)?${tag}>([\\s\\S]*?)</(?:[\\w]+:)?${tag}>`);
  const m = xml.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractSoapAllBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w]+:)?${tag}>([\\s\\S]*?)</(?:[\\w]+:)?${tag}>`, "g");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1]!);
  }
  return results;
}

function decodeCdata(content: string): string {
  let decoded = content;
  const cdataRe = /<!\[CDATA\[([\s\S]*?)\]\]>/;
  const cdataMatch = decoded.match(cdataRe);
  if (cdataMatch) {
    decoded = cdataMatch[1]!;
  }
  decoded = decoded
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  return decoded;
}

export function parseSoapResponse(responseXml: string): SoapAuthorizationResult {
  const result: SoapAuthorizationResult = {
    authorized: false,
    status: "UNKNOWN",
    authorizationNumber: null,
    authorizationDate: null,
    xml: null,
    environment: null,
    errors: [],
  };

  if (responseXml.includes("Fault") || responseXml.includes("fault")) {
    const faultString = extractSoapTag(responseXml, "faultstring");
    result.errors.push(faultString ?? "SOAP Fault");
    return result;
  }

  const autorizaciones = extractSoapAllBlocks(responseXml, "autorizacion");
  if (autorizaciones.length === 0) {
    result.errors.push("No authorization found in SOAP response");
    return result;
  }

  const auth = autorizaciones[0]!;
  result.status = extractSoapTag(auth, "estado") ?? "UNKNOWN";
  result.authorized = result.status === "AUTORIZADO";
  result.authorizationNumber = extractSoapTag(auth, "numeroAutorizacion");
  result.authorizationDate = extractSoapTag(auth, "fechaAutorizacion");
  result.environment = extractSoapTag(auth, "ambiente");

  const comprobante = extractSoapTag(auth, "comprobante");
  if (comprobante) {
    result.xml = decodeCdata(comprobante);
  }

  const mensajes = extractSoapAllBlocks(auth, "mensaje");
  for (const msg of mensajes) {
    const tipo = extractSoapTag(msg, "tipo") ?? "";
    const mensaje = extractSoapTag(msg, "mensaje") ?? "";
    const info = extractSoapTag(msg, "informacionAdicional") ?? "";
    if (tipo || mensaje) {
      result.errors.push(`${tipo}: ${mensaje} ${info}`.trim());
    }
  }

  return result;
}

export async function fetchAuthorizedXml(
  accessKey: string,
  soapUrl?: string,
): Promise<SoapAuthorizationResult> {
  if (!/^\d{49}$/.test(accessKey)) {
    return {
      authorized: false,
      status: "INVALID_KEY",
      authorizationNumber: null,
      authorizationDate: null,
      xml: null,
      environment: null,
      errors: [`Invalid access key format: ${accessKey.slice(0, 10)}...`],
    };
  }

  const url = soapUrl ?? DEFAULT_SOAP_URL;
  const envelope = buildSoapEnvelope(accessKey);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: '""',
    },
    body: envelope,
    signal: AbortSignal.timeout(SOAP_TIMEOUT_MS),
  });

  if (!res.ok && res.status >= 500) {
    return {
      authorized: false,
      status: "SERVICE_ERROR",
      authorizationNumber: null,
      authorizationDate: null,
      xml: null,
      environment: null,
      errors: [`SOAP service returned HTTP ${res.status}`],
    };
  }

  const body = await res.text();
  return parseSoapResponse(body);
}
