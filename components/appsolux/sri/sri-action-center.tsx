"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, FileKey2, MapPinned, ReceiptText, TriangleAlert, X } from "lucide-react";

import { SriCompanyForm, type SriCompanyFormProfile, type SriCompanyPrefill } from "@/components/appsolux/sri/sri-company-form";
import { SriEmissionSetupForm } from "@/components/appsolux/sri/sri-emission-setup-form";
import { SriSignatureMetadataForm } from "@/components/appsolux/sri/sri-signature-metadata-form";
import { SriSignatureUploadForm } from "@/components/appsolux/sri/sri-signature-upload-form";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";

type ActiveStep = "fiscal" | "signature" | "emission" | null;

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

type EmissionDefaults = {
  establishmentCode: string;
  establishmentName: string;
  address: string;
  issuePointCode: string;
  nextNumber: number;
  hasLocalHistory: boolean;
};

export type SriActionCenterProps = {
  profileReady: boolean;
  signatureReady: boolean;
  signatureExpired: boolean;
  signatureExpiresSoon: boolean;
  emissionReady: boolean;
  ruc: string | null;
  legalName: string | null;
  initialProfile: SriCompanyFormProfile | null;
  companyPrefill: SriCompanyPrefill;
  sigConfig: SigConfigSummary | null;
  emissionDefaults: EmissionDefaults;
};

function StepModal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-facturom-primary-dark/55 p-4 pt-10 backdrop-blur-sm sm:pt-16">
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
          <div><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function StepCard({ number, title, description, summary, ready, error, icon: Icon, actionLabel, onClick }: { number: number; title: string; description: string; summary: string; ready: boolean; error?: boolean; icon: typeof ReceiptText; actionLabel: string; onClick: () => void }) {
  const statusClass = error ? "bg-red-50 text-red-700" : ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  return (
    <article className="rounded-[24px] bg-white p-5 shadow-[0_10px_30px_rgba(59,10,103,0.07)] ring-1 ring-facturom-primary/8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", ready ? "bg-emerald-100 text-emerald-700" : error ? "bg-red-100 text-red-700" : "bg-[#eee5f7] text-facturom-primary")}>
          {ready ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-facturom-primary-soft">Paso {number}</p>
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", statusClass)}>{error ? "Requiere atención" : ready ? "Completado" : "Pendiente"}</span>
          </div>
          <h3 className="mt-1 text-lg font-black text-slate-950">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">{summary}</p>
        </div>
        <Button type="button" variant="outline" onClick={onClick} className="shrink-0 rounded-xl border-facturom-primary/20 text-facturom-primary hover:bg-[#eee5f7] hover:text-facturom-primary">
          {actionLabel}
        </Button>
      </div>
    </article>
  );
}

export function SriActionCenter({ profileReady, signatureReady, signatureExpired, signatureExpiresSoon, emissionReady, ruc, legalName, initialProfile, companyPrefill, sigConfig, emissionDefaults }: SriActionCenterProps) {
  const [activeStep, setActiveStep] = useState<ActiveStep>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const allReady = profileReady && signatureReady && emissionReady && !signatureExpired;
  const signatureSummary = signatureExpired
    ? "El certificado está vencido. Carga uno vigente para poder emitir."
    : signatureReady
      ? `Certificado${sigConfig?.expiresAt ? ` válido hasta ${new Date(sigConfig.expiresAt).toLocaleDateString("es-EC")}` : " guardado correctamente"}.`
      : "Sube un certificado .p12 o .pfx y confirma su vigencia.";
  const signatureSummaryWithWarning = signatureExpiresSoon && sigConfig?.expiresAt
    ? `Firma lista. El certificado vence pronto: ${new Date(sigConfig.expiresAt).toLocaleDateString("es-EC")}.`
    : signatureSummary;
  const emissionSummary = emissionReady
    ? `Est. ${emissionDefaults.establishmentCode} · Punto ${emissionDefaults.issuePointCode} · Próxima ${String(emissionDefaults.nextNumber).padStart(9, "0")}`
    : "Configura establecimiento, punto y la próxima factura.";

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {["Datos fiscales", "Firma", "Emisión"].map((label, index) => {
          const ready = [profileReady, signatureReady && !signatureExpired, emissionReady][index];
          return <div key={label} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold", ready ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-500")}><span className={cn("flex h-7 w-7 items-center justify-center rounded-full", ready ? "bg-emerald-600 text-white" : "bg-[#eee5f7] text-facturom-primary")}>{ready ? <Check className="h-4 w-4" /> : index + 1}</span>{label}</div>;
        })}
      </div>

      <div className="mt-5 space-y-4">
        <StepCard number={1} title="Datos fiscales" description="Confirma la información con la que emitirás tus comprobantes." summary={profileReady ? `${ruc} · ${legalName}` : "RUC, nombre fiscal y dirección matriz pendientes."} ready={profileReady} icon={ReceiptText} actionLabel={profileReady ? "Editar" : "Configurar"} onClick={() => setActiveStep("fiscal")} />
        <StepCard number={2} title="Firma electrónica" description="Sube tu certificado y la contraseña para firmar tus facturas." summary={signatureSummaryWithWarning} ready={signatureReady && !signatureExpired} error={signatureExpired} icon={FileKey2} actionLabel={signatureReady ? "Revisar" : "Cargar firma"} onClick={() => setActiveStep("signature")} />
        <StepCard number={3} title="Configura tu emisión" description="Define desde dónde facturas y desde qué número continuará Facturom." summary={emissionSummary} ready={emissionReady} icon={MapPinned} actionLabel={emissionReady ? "Revisar" : "Configurar"} onClick={() => setActiveStep("emission")} />
      </div>

      {allReady ? (
        <div className="mt-5 flex flex-col gap-4 rounded-[24px] bg-emerald-600 p-5 text-white shadow-lg shadow-emerald-900/10 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-lg font-black">Facturación electrónica lista</p><p className="text-sm text-white/80">Ya puedes emitir comprobantes desde tus ventas.</p></div>
          <Button asChild className="rounded-xl bg-white text-emerald-700 hover:bg-emerald-50"><Link href={routes.facturacionPos}>Nueva venta <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <button type="button" onClick={() => setAdvancedOpen((open) => !open)} className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-bold text-slate-700">Configuración avanzada <ChevronDown className={cn("h-4 w-4 transition", advancedOpen && "rotate-180")} /></button>
        {advancedOpen ? (
          <div className="grid gap-3 border-t border-slate-100 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Empresa fiscal", routes.sriCompany], ["Firma y detalles técnicos", routes.sriSignature], ["Establecimientos", routes.sriEstablishments], ["Puntos de emisión", routes.sriIssuePoints], ["Secuencias completas", routes.sriSequences], ["Ambiente técnico", routes.sriEnvironment],
            ].map(([label, href]) => <Link key={href} href={href} className="rounded-xl bg-slate-50 px-4 py-3 font-medium text-slate-600 hover:bg-[#eee5f7] hover:text-facturom-primary">{label}</Link>)}
          </div>
        ) : null}
      </div>

      {activeStep === "fiscal" ? <StepModal title="1. Datos fiscales" description="Confirma la información con la que emitirás tus comprobantes." onClose={() => setActiveStep(null)}><SriCompanyForm initialProfile={initialProfile} prefill={companyPrefill} /></StepModal> : null}
      {activeStep === "signature" ? (
        <StepModal title="2. Firma electrónica" description="Sube tu certificado y la contraseña para firmar tus facturas." onClose={() => setActiveStep(null)}>
          {signatureExpired ? <div className="mb-4 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><TriangleAlert className="h-4 w-4 shrink-0" />El certificado está vencido y la emisión permanece bloqueada.</div> : null}
          {sigConfig ? <div className="mb-4 rounded-2xl bg-facturom-bg p-4 text-sm"><p className="font-bold text-slate-900">{sigConfig.fileName ?? "Certificado registrado"}</p>{sigConfig.subjectName ? <p className="mt-1 text-slate-600">Titular: {sigConfig.subjectName}</p> : null}{sigConfig.expiresAt ? <p className={signatureExpired ? "text-red-700" : "text-slate-600"}>Vence: {new Date(sigConfig.expiresAt).toLocaleDateString("es-EC")}</p> : null}</div> : null}
          <SriSignatureUploadForm />
          <details className="mt-4 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-bold text-slate-700">Ver detalles técnicos</summary><div className="mt-4"><SriSignatureMetadataForm /><p className="mt-3 text-xs text-slate-500">El certificado se almacena cifrado y la firma se procesa en un worker separado.</p></div></details>
        </StepModal>
      ) : null}
      {activeStep === "emission" ? <StepModal title="3. Configura tu emisión" description="Define desde dónde facturas y desde qué número continuará Facturom." onClose={() => setActiveStep(null)}>{profileReady ? <SriEmissionSetupForm defaults={emissionDefaults} /> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Completa primero tus datos fiscales.</p>}</StepModal> : null}
    </>
  );
}
