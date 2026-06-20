"use client";

import Link from "next/link";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Globe,
  KeyRound,
  MapPinned,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { useState } from "react";

import { SriCompanyForm } from "@/components/appsolux/sri/sri-company-form";
import type { SriCompanyFormProfile } from "@/components/appsolux/sri/sri-company-form";
import { SriEnvironmentActions } from "@/components/appsolux/sri/sri-environment-actions";
import { SriSignatureMetadataForm } from "@/components/appsolux/sri/sri-signature-metadata-form";
import { SriSignatureUploadForm } from "@/components/appsolux/sri/sri-signature-upload-form";
import { SriEstablishmentForm } from "@/app/sri/establishments/establishment-form";
import { SriIssuePointForm } from "@/app/sri/issue-points/issue-point-form";
import { SriSequenceForm } from "@/app/sri/sequences/sequence-form";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";

type ActiveModal =
  | null
  | "company"
  | "signature"
  | "establishment"
  | "issuepoint"
  | "sequence"
  | "environment";

type EstablishmentItem = {
  id: string;
  code: string;
  name: string;
  address: string;
  isMain: boolean;
  isActive: boolean;
};

type IssuePointItem = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  establishmentId: string;
  establishmentCode: string;
};

type SequenceItem = {
  id: string;
  documentType: string;
  documentTypeLabel: string;
  currentNumber: number;
  isActive: boolean;
  establishmentCode: string;
  issuePointCode: string;
};

type SigConfigSummary = {
  status: string;
  fileName: string | null;
  uploadedAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  issuerName: string | null;
  subjectName: string | null;
  serialNumber: string | null;
  hasEncryptedCertificate: boolean;
  hasEncryptedPassword: boolean;
};

export type SriActionCenterProps = {
  // Status for checklist
  hasProfile: boolean;
  profileStatus: string | null;
  signatureLabel: string;
  signatureHasEncryptedCertificate: boolean;
  signatureHasEncryptedPassword: boolean;
  establishmentCount: number;
  issuePointCount: number;
  sequenceCount: number;
  environment: string | null;
  integrationReady: boolean;
  ruc: string | null;
  legalName: string | null;

  // For company modal
  initialProfile: SriCompanyFormProfile | null;

  // For signature modal
  sigConfig: SigConfigSummary | null;

  // For establishment modal
  profileId: string | null;
  establishments: EstablishmentItem[];

  // For issue points modal
  issuePoints: IssuePointItem[];

  // For sequences modal
  sequences: SequenceItem[];
};

// ---------- Modal wrapper ----------

function SriModal({
  title,
  subtitle,
  onClose,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-16">
      <div
        className={cn(
          "relative w-full rounded-[28px] border border-slate-200 bg-white shadow-xl",
          wide ? "max-w-2xl" : "max-w-lg"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ---------- Collapsible technical details ----------

function TechnicalDetails({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? "Ocultar detalles técnicos" : "Ver detalles técnicos"}
      </button>
      {open && <div className="mt-3 space-y-3 text-xs text-slate-600">{children}</div>}
    </div>
  );
}

// ---------- Checklist item with onClick ----------

function ChecklistItem({
  label,
  value,
  ok,
  actionLabel,
  onClick,
}: {
  label: string;
  value: string;
  ok: boolean;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm">
      <div>
        <p className="font-medium text-slate-900">{label}</p>
        <p className={ok ? "text-emerald-700" : "text-amber-700"}>{value}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onClick}>
        {actionLabel}
      </Button>
    </div>
  );
}

// ---------- Action card with onClick ----------

function ActionCard({
  title,
  description,
  status,
  statusOk,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  status: string;
  statusOk: boolean;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-[24px] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
            statusOk
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          {status}
        </span>
      </div>
      <div className="mt-4 space-y-1">
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </button>
  );
}

// ---------- Empresa activa card (placeholder for multi-company) ----------

function EmpresaActivaCard({
  legalName,
  ruc,
}: {
  legalName: string | null;
  ruc: string | null;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[#004080]/10 p-3 text-[#004080]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Empresa activa de facturación
            </p>
            <p className="mt-0.5 font-semibold text-slate-900">
              {legalName ?? "Sin configurar"}
            </p>
            {ruc && (
              <p className="text-xs text-slate-500">RUC {ruc}</p>
            )}
          </div>
        </div>
        <span className="inline-flex items-center rounded-full border border-[#004080]/20 bg-[#004080]/5 px-2.5 py-1 text-xs font-medium text-[#004080]">
          Principal
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">
          Plan avanzado: factura desde varios RUC con certificados independientes.
        </p>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-400"
          title="Disponible en plan avanzado"
        >
          Administrar empresas
        </button>
      </div>
    </div>
  );
}

// ---------- Main component ----------

export function SriActionCenter({
  hasProfile,
  profileStatus,
  signatureLabel,
  signatureHasEncryptedCertificate,
  signatureHasEncryptedPassword,
  establishmentCount,
  issuePointCount,
  sequenceCount,
  environment,
  integrationReady,
  ruc,
  legalName,
  initialProfile,
  sigConfig,
  profileId,
  establishments,
  issuePoints,
  sequences,
}: SriActionCenterProps) {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const close = () => setActiveModal(null);

  const envLabel =
    environment === "TEST"
      ? "Pruebas activas"
      : environment === "PRODUCTION"
        ? "Producción activa"
        : "Pendiente";

  return (
    <>
      {/* ── Modals ── */}

      {activeModal === "company" && (
        <SriModal
          title="Empresa / RUC"
          subtitle="Datos tributarios del contribuyente."
          onClose={close}
          wide
        >
          {/* Strip Card wrapper — form renders bare inside modal */}
          <div className="-mx-1">
            <SriCompanyForm initialProfile={initialProfile} />
          </div>
        </SriModal>
      )}

      {activeModal === "signature" && (
        <SriModal
          title="Firma electrónica"
          subtitle="Certificado .p12 o .pfx para autorizar comprobantes SRI."
          onClose={close}
          wide
        >
          {/* Status summary */}
          {sigConfig && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    sigConfig.isExpired
                      ? "bg-red-400"
                      : sigConfig.hasEncryptedCertificate
                        ? "bg-emerald-400"
                        : "bg-amber-400"
                  )}
                />
                <span className="font-medium text-slate-800">{signatureLabel}</span>
              </div>
              {sigConfig.fileName && (
                <p className="mt-1 text-xs text-slate-500">
                  Archivo: <span className="font-mono">{sigConfig.fileName}</span>
                </p>
              )}
              {sigConfig.expiresAt && (
                <p className={cn("mt-0.5 text-xs", sigConfig.isExpired ? "text-red-600 font-medium" : "text-slate-500")}>
                  Vence: {new Date(sigConfig.expiresAt).toLocaleDateString("es-EC")}
                  {sigConfig.isExpired && " — VENCIDO"}
                </p>
              )}
              {sigConfig.issuerName && (
                <p className="mt-0.5 text-xs text-slate-500">Emisor: {sigConfig.issuerName}</p>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500">
            La firma se procesa de forma segura mediante worker. El certificado no se expone al navegador.
          </p>

          <SriSignatureUploadForm />
          <SriSignatureMetadataForm />

          <TechnicalDetails>
            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="font-medium text-slate-700">Seguridad</p>
              <ul className="space-y-1">
                {[
                  "Cada empresa usa su propio certificado .p12 o .pfx.",
                  "El dashboard no firma directamente; la firma se procesa en un worker separado.",
                  "El certificado no se expone al navegador y se mantiene cifrado server-side.",
                  "Valida en ambiente de pruebas antes de usar producción.",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-700">Entidades emisoras de certificado Ecuador</p>
              <ul className="space-y-0.5">
                {["Banco Central del Ecuador (BCE)", "Security Data", "ANF AC Ecuador", "Registro Civil"].map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-700">Flujo de firma (arquitectura worker)</p>
              <ol className="space-y-0.5">
                {[
                  "Next.js crea un SriSigningJob con estado QUEUED.",
                  "Worker separado reclama el job.",
                  "Worker carga el certificado .p12 desde almacenamiento cifrado.",
                  "Worker firma el XML con XAdES-BES.",
                  "Worker guarda el XML firmado y actualiza el job a SUCCEEDED.",
                ].map((s, i) => (
                  <li key={i}>{i + 1}. {s}</li>
                ))}
              </ol>
            </div>
          </TechnicalDetails>

          <div className="pt-1 text-right">
            <Link
              href={routes.sriSignature}
              className="text-xs text-[#004080] hover:underline"
            >
              Abrir página completa de firma →
            </Link>
          </div>
        </SriModal>
      )}

      {activeModal === "establishment" && (
        <SriModal
          title="Establecimiento"
          subtitle="Sucursal autorizada por el SRI para emitir comprobantes."
          onClose={close}
          wide
        >
          {!profileId ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Configura primero la empresa y el RUC.
            </p>
          ) : (
            <SriEstablishmentForm profileId={profileId} />
          )}

          {establishments.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Registrados
              </p>
              {establishments.map((est) => (
                <div
                  key={est.id}
                  className="grid grid-cols-[auto_1fr_auto] gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm"
                >
                  <span className="font-mono font-semibold text-slate-700">{est.code}</span>
                  <div>
                    <p className="font-medium text-slate-900">{est.name}</p>
                    <p className="text-xs text-slate-500">{est.address}</p>
                  </div>
                  <span className={est.isActive ? "text-xs text-emerald-700" : "text-xs text-slate-400"}>
                    {est.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SriModal>
      )}

      {activeModal === "issuepoint" && (
        <SriModal
          title="Punto de emisión"
          subtitle="Define los puntos de emisión disponibles por establecimiento."
          onClose={close}
          wide
        >
          {establishments.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Registra al menos un establecimiento primero.
            </p>
          ) : (
            <SriIssuePointForm
              establishments={establishments.map((e) => ({
                id: e.id,
                code: e.code,
                name: e.name,
              }))}
            />
          )}

          {issuePoints.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Registrados
              </p>
              {issuePoints.map((ip) => (
                <div
                  key={ip.id}
                  className="grid grid-cols-[auto_auto_1fr_auto] gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-slate-500">{ip.establishmentCode}</span>
                  <span className="font-mono font-semibold text-slate-700">{ip.code}</span>
                  <p className="font-medium text-slate-900">{ip.name}</p>
                  <span className={ip.isActive ? "text-xs text-emerald-700" : "text-xs text-slate-400"}>
                    {ip.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SriModal>
      )}

      {activeModal === "sequence" && (
        <SriModal
          title="Secuencial"
          subtitle="Número inicial de cada tipo de comprobante por punto de emisión."
          onClose={close}
          wide
        >
          {issuePoints.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Registra establecimientos y puntos de emisión primero.
            </p>
          ) : (
            <SriSequenceForm
              establishments={establishments.map((e) => ({
                id: e.id,
                code: e.code,
                name: e.name,
              }))}
              issuePoints={issuePoints.map((ip) => ({
                id: ip.id,
                code: ip.code,
                name: ip.name,
                establishmentId: ip.establishmentId,
                establishmentCode: ip.establishmentCode,
              }))}
            />
          )}

          {sequences.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Configurados
              </p>
              {sequences.map((seq) => (
                <div
                  key={seq.id}
                  className="grid grid-cols-[auto_1fr_auto_auto] gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-slate-500">
                    {seq.establishmentCode}-{seq.issuePointCode}
                  </span>
                  <p className="font-medium text-slate-900">{seq.documentTypeLabel}</p>
                  <span className="text-xs text-slate-500">
                    #{String(seq.currentNumber).padStart(9, "0")}
                  </span>
                  <span className={seq.isActive ? "text-xs text-emerald-700" : "text-xs text-slate-400"}>
                    {seq.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SriModal>
      )}

      {activeModal === "environment" && (
        <SriModal
          title="Ambiente"
          subtitle="Controla si la emisión apunta a pruebas o producción del SRI."
          onClose={close}
          wide
        >
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Valida en pruebas antes de activar producción. Los comprobantes en producción tienen validez tributaria real.
          </div>
          <SriEnvironmentActions />
        </SriModal>
      )}

      {/* ── Checklist ── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Lista de configuración
        </p>
        <ChecklistItem
          label="Empresa / RUC"
          value={profileStatus === "CONFIGURED" ? "Configurado" : "Pendiente"}
          ok={profileStatus === "CONFIGURED"}
          actionLabel={profileStatus === "CONFIGURED" ? "Editar" : "Configurar"}
          onClick={() => setActiveModal("company")}
        />
        <ChecklistItem
          label="Firma electrónica"
          value={signatureLabel}
          ok={signatureHasEncryptedCertificate && signatureHasEncryptedPassword}
          actionLabel="Revisar"
          onClick={() => setActiveModal("signature")}
        />
        <ChecklistItem
          label="Establecimiento activo"
          value={establishmentCount > 0 ? `${establishmentCount} activo(s)` : "Pendiente"}
          ok={establishmentCount > 0}
          actionLabel={establishmentCount > 0 ? "Ver" : "Agregar"}
          onClick={() => setActiveModal("establishment")}
        />
        <ChecklistItem
          label="Punto de emisión activo"
          value={issuePointCount > 0 ? `${issuePointCount} activo(s)` : "Pendiente"}
          ok={issuePointCount > 0}
          actionLabel={issuePointCount > 0 ? "Ver" : "Agregar"}
          onClick={() => setActiveModal("issuepoint")}
        />
        <ChecklistItem
          label="Secuencial activo"
          value={sequenceCount > 0 ? `${sequenceCount} configurado(s)` : "Pendiente"}
          ok={sequenceCount > 0}
          actionLabel={sequenceCount > 0 ? "Ver" : "Configurar"}
          onClick={() => setActiveModal("sequence")}
        />
        <ChecklistItem
          label="Ambiente"
          value={envLabel}
          ok={environment !== null}
          actionLabel="Revisar"
          onClick={() => setActiveModal("environment")}
        />
      </div>

      {/* ── Action cards grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          title="Empresa y RUC"
          description="Razón social, RUC y datos tributarios base."
          status={hasProfile ? "Configurado" : "Pendiente"}
          statusOk={hasProfile}
          icon={Building2}
          onClick={() => setActiveModal("company")}
        />
        <ActionCard
          title="Firma electrónica"
          description="Carga el certificado y valida si está listo para pruebas."
          status={signatureLabel}
          statusOk={signatureHasEncryptedCertificate && signatureHasEncryptedPassword}
          icon={ShieldCheck}
          onClick={() => setActiveModal("signature")}
        />
        <ActionCard
          title="Establecimientos"
          description="Sucursales autorizadas para emitir comprobantes."
          status={establishmentCount > 0 ? `${establishmentCount} activo(s)` : "Pendiente"}
          statusOk={establishmentCount > 0}
          icon={Store}
          onClick={() => setActiveModal("establishment")}
        />
        <ActionCard
          title="Puntos de emisión"
          description="Puntos de emisión por establecimiento."
          status={issuePointCount > 0 ? `${issuePointCount} activo(s)` : "Pendiente"}
          statusOk={issuePointCount > 0}
          icon={MapPinned}
          onClick={() => setActiveModal("issuepoint")}
        />
        <ActionCard
          title="Secuenciales"
          description="Activa y revisa las secuencias para facturas electrónicas."
          status={sequenceCount > 0 ? `${sequenceCount} lista(s)` : "Pendiente"}
          statusOk={sequenceCount > 0}
          icon={KeyRound}
          onClick={() => setActiveModal("sequence")}
        />
        <ActionCard
          title="Ambiente"
          description="Confirma si la integración apunta a pruebas o producción."
          status={
            environment === "TEST"
              ? "Pruebas"
              : environment === "PRODUCTION"
                ? "Producción"
                : "Pendiente"
          }
          statusOk={environment !== null}
          icon={Globe}
          onClick={() => setActiveModal("environment")}
        />
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
              <FileCheck2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <p className="font-medium text-slate-900">Comprobantes / monitoreo</p>
            <p className="text-sm leading-5 text-slate-500">
              Ver facturas y comprobantes con sus estados operativos.
            </p>
            <div className="pt-2">
              <Button asChild variant="outline" size="sm">
                <Link href={routes.sriDocuments}>Ver facturas</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Empresa activa (multi-company placeholder) ── */}
      <EmpresaActivaCard legalName={legalName} ruc={ruc} />

      {/* ── Integration status banner ── */}
      {integrationReady ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
          Configuración base lista. Puedes emitir comprobantes desde el POS.
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
          Configuración incompleta. Completa los pasos del checklist para habilitar la emisión.
        </div>
      )}
    </>
  );
}
