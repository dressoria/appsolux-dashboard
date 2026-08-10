"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Building2, IdCard, MapPin, ReceiptText, Store } from "lucide-react";

import { createTenantAction, type OnboardingActionState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isValidEcuadorCedula,
  isValidEcuadorRuc,
  normalizeEcuadorIdentification,
  type TaxIdentificationType,
} from "@/lib/onboarding/ecuador-identification";
import { cn } from "@/lib/utils";

const initialState: OnboardingActionState = {};

const identificationOptions: {
  value: TaxIdentificationType;
  label: string;
  description: string;
  icon: typeof ReceiptText;
}[] = [
  { value: "ruc", label: "RUC", description: "Para empresas y negocios", icon: ReceiptText },
  { value: "cedula", label: "Cédula", description: "Para personas naturales", icon: IdCard },
  { value: "none", label: "Sin identificación fiscal", description: "Configúrala más adelante", icon: Store },
];

const ecuadorProvinces = [
  "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi", "El Oro", "Esmeraldas",
  "Galápagos", "Guayas", "Imbabura", "Loja", "Los Ríos", "Manabí", "Morona Santiago", "Napo",
  "Orellana", "Pastaza", "Pichincha", "Santa Elena", "Santo Domingo de los Tsáchilas", "Sucumbíos",
  "Tungurahua", "Zamora Chinchipe",
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-11 rounded-xl bg-facturom-primary px-6 text-white shadow-md shadow-facturom-primary/20 hover:bg-facturom-primary-soft">
      {pending ? "Creando tu negocio…" : "Crear mi negocio"}
      {pending ? null : <ArrowRight className="ml-2 h-4 w-4" />}
    </Button>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs font-medium text-destructive">{message}</p> : null;
}

export function OnboardingBusinessForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction] = useActionState(createTenantAction, initialState);
  const [identificationType, setIdentificationType] = useState<TaxIdentificationType>("ruc");
  const [identification, setIdentification] = useState("");

  const localIdentificationError = (() => {
    if (!identification) return undefined;
    if (identificationType === "ruc" && !isValidEcuadorRuc(identification)) {
      return "El RUC debe tener 13 dígitos.";
    }
    if (identificationType === "cedula" && identification.length === 10 && !isValidEcuadorCedula(identification)) {
      return "La cédula ingresada no es válida.";
    }
    if (identificationType === "cedula" && identification.length !== 10) {
      return "La cédula debe tener 10 dígitos.";
    }
    return undefined;
  })();
  const identificationError = localIdentificationError ?? state.fieldErrors?.tax_identification_value;
  const isFiscal = identificationType !== "none";

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="tax_identification_type" value={identificationType} />

      <fieldset className="space-y-3">
        <legend className="text-base font-black text-facturom-text">¿Cómo quieres identificarte?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {identificationOptions.map((option) => {
            const selected = identificationType === option.value;
            const Icon = option.icon;
            return (
              <label key={option.value} className={cn("cursor-pointer rounded-2xl border p-3.5 transition", selected ? "border-facturom-primary bg-[#eee5f7] shadow-sm" : "border-slate-200 bg-white hover:border-facturom-primary/35 hover:bg-facturom-bg")}>
                <input
                  type="radio"
                  name="identification_type_control"
                  value={option.value}
                  checked={selected}
                  onChange={() => {
                    setIdentificationType(option.value);
                    setIdentification("");
                  }}
                  className="sr-only"
                />
                <span className="flex items-start gap-3">
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", selected ? "bg-facturom-primary text-white" : "bg-slate-100 text-slate-500")}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-950">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-4 text-slate-500">{option.description}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <section className="space-y-4" aria-labelledby="business-heading">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-facturom-primary" />
          <h2 id="business-heading" className="text-sm font-black text-facturom-primary">Información del negocio</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="trade_name">Nombre comercial {isFiscal ? "" : "*"}</Label>
            <Input id="trade_name" name="trade_name" placeholder="Ej. 131 Studio" required={!isFiscal} aria-invalid={Boolean(state.fieldErrors?.trade_name)} className="h-11 rounded-xl bg-white" />
            <FieldError message={state.fieldErrors?.trade_name} />
          </div>

          {isFiscal ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="tax_identification_value">{identificationType === "ruc" ? "RUC" : "Cédula"} *</Label>
                <Input
                  id="tax_identification_value"
                  name="tax_identification_value"
                  inputMode="numeric"
                  autoComplete="off"
                  value={identification}
                  onChange={(event) => setIdentification(normalizeEcuadorIdentification(event.target.value).slice(0, identificationType === "ruc" ? 13 : 10))}
                  placeholder={identificationType === "ruc" ? "1790012345001" : "1712345678"}
                  required
                  aria-invalid={Boolean(identificationError)}
                  className="h-11 rounded-xl bg-white"
                />
                <FieldError message={identificationError} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_name">{identificationType === "cedula" ? "Nombre completo" : "Razón social"} *</Label>
                <Input id="legal_name" name="legal_name" placeholder={identificationType === "cedula" ? "Tu nombre completo" : "Nombre legal de la empresa"} required aria-invalid={Boolean(state.fieldErrors?.legal_name)} className="h-11 rounded-xl bg-white" />
                <FieldError message={state.fieldErrors?.legal_name} />
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="text-sm font-black text-facturom-primary">Contacto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <div className="flex rounded-xl border border-input bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
              <span className="flex shrink-0 items-center border-r border-slate-200 px-3 text-sm font-semibold text-slate-600">🇪🇨 +593</span>
              <input id="phone" name="phone" inputMode="tel" placeholder="99 123 4567" aria-invalid={Boolean(state.fieldErrors?.phone)} className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
            </div>
            <FieldError message={state.fieldErrors?.phone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">Correo comercial</Label>
            <Input id="contact_email" name="contact_email" type="email" defaultValue={defaultEmail} aria-invalid={Boolean(state.fieldErrors?.contact_email)} className="h-11 rounded-xl bg-white" />
            <p className="text-xs text-slate-500">No cambia el correo con el que inicias sesión.</p>
            <FieldError message={state.fieldErrors?.contact_email} />
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="location-heading">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-facturom-primary" />
          <h2 id="location-heading" className="text-sm font-black text-facturom-primary">Ubicación</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="country">País</Label>
            <Input id="country" value="Ecuador" readOnly className="h-11 rounded-xl bg-slate-50 text-slate-700" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="province">Provincia</Label>
            <select id="province" name="province" defaultValue="" className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20">
              <option value="">Selecciona una provincia</option>
              {ecuadorProvinces.map((province) => <option key={province} value={province}>{province}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" name="city" placeholder="Ej. Quito" className="h-11 rounded-xl bg-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Dirección {isFiscal ? "*" : ""}</Label>
            <Input id="address" name="address" placeholder="Av., calle y referencia" required={isFiscal} aria-invalid={Boolean(state.fieldErrors?.address)} className="h-11 rounded-xl bg-white" />
            <FieldError message={state.fieldErrors?.address} />
          </div>
        </div>
      </section>

      <div className="flex flex-col items-start justify-between gap-3 border-t border-facturom-primary/10 pt-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold text-slate-900">Comenzarás con Plan Básico</p>
          <p className="text-xs text-slate-500">Podrás configurar SRI después, cuando lo necesites.</p>
        </div>
        <SubmitButton />
      </div>
      {state.message ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.message}</p> : null}
    </form>
  );
}
