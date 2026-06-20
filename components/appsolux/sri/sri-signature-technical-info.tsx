"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const SECURITY_CHECKLIST = [
  "Cada empresa usa su propio certificado .p12 o .pfx.",
  "El dashboard no firma directamente; la firma se procesa en un worker separado.",
  "El certificado no se expone al navegador y debe mantenerse cifrado server-side.",
  "Antes de usar un certificado de produccion, valida una firma real en ambiente de pruebas.",
];

const ISSUER_LIST = [
  "Banco Central del Ecuador (BCE)",
  "Security Data",
  "ANF AC Ecuador",
  "Registro Civil",
];

const WORKER_STEPS = [
  "Next.js crea un SriSigningJob con estado QUEUED.",
  "Un worker separado reclama el job.",
  "El worker carga el certificado .p12 desde almacenamiento cifrado (server-side).",
  "El worker firma el XML con XAdES-BES.",
  "El worker guarda el XML firmado y actualiza el job a SUCCEEDED.",
  "El XML firmado queda listo para la siguiente fase de envio al SRI.",
];

export function SriSignatureTechnicalInfo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm"
      >
        <span className="font-medium text-slate-700">Ver detalles tecnicos</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="space-y-6 border-t border-slate-200 px-5 pb-5 pt-4 text-sm text-slate-600">

          {/* Security checklist */}
          <div className="space-y-2">
            <p className="font-medium text-slate-800">Seguridad de la firma</p>
            <ul className="space-y-1.5">
              {SECURITY_CHECKLIST.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-bold text-emerald-600">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="pt-1 text-xs text-slate-400">
              Mas detalles en <span className="font-mono">docs/SRI_SIGNATURE_SECURITY.md</span> del repositorio.
            </p>
          </div>

          {/* Where to get certificate */}
          <div className="space-y-2">
            <p className="font-medium text-slate-800">Donde obtener el certificado</p>
            <p className="text-slate-600">Ecuador exige certificado emitido por entidades autorizadas:</p>
            <ul className="space-y-1">
              {ISSUER_LIST.map((issuer) => (
                <li key={issuer}>• {issuer}</li>
              ))}
            </ul>
            <p className="text-xs text-slate-400">
              El certificado debe estar emitido a nombre del RUC configurado en la empresa.
              No uses el certificado de produccion hasta validar el flujo completo en pruebas.
            </p>
          </div>

          {/* Worker architecture */}
          <div className="space-y-2">
            <p className="font-medium text-slate-800">Arquitectura worker de firma</p>
            <p className="text-slate-600">
              La firma XAdES-BES{" "}
              <strong className="text-slate-800">no se ejecuta desde Next.js directamente.</strong>{" "}
              Se usa una arquitectura de cola de jobs con worker separado:
            </p>
            <ol className="space-y-1">
              {WORKER_STEPS.map((step, i) => (
                <li key={i}>{i + 1}. {step}</li>
              ))}
            </ol>
            <ul className="space-y-1 border-t border-slate-200 pt-2">
              <li>• El certificado <strong>nunca se envia al navegador</strong>.</li>
              <li>• La contrasena <strong>no se muestra</strong> en dashboard ni en logs.</li>
              <li>• Los jobs tienen reintentos automaticos con backoff.</li>
            </ul>
            <p className="text-xs text-slate-400">
              Detalles en <span className="font-mono">docs/SRI_SIGNING_WORKER.md</span>.
            </p>
          </div>

          {/* Next steps */}
          <div className="space-y-2">
            <p className="font-medium text-slate-800">Siguientes validaciones</p>
            <ol className="space-y-1 text-slate-600">
              <li>1. Validar una firma real de punta a punta en ambiente de pruebas.</li>
              <li>2. Confirmar QA del worker con certificados empresariales controlados.</li>
              <li>3. Habilitar envio al web service del SRI en pruebas.</li>
              <li>4. Implementar autorizacion SRI y RIDE/PDF final.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
