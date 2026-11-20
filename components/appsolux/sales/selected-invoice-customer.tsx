import { Check, Mail, MapPin, Phone, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./invoice-editor.module.css";

export function SelectedInvoiceCustomer({ customer, onChange, onClear }: {
  customer: { name: string; identification: string | null; phone: string | null; email: string | null; address: string | null };
  onChange: () => void;
  onClear: () => void;
}) {
  return (
    <section aria-label="Cliente seleccionado" className={`${styles.enter} mt-4 min-w-0 rounded-2xl border border-blue-200 bg-blue-50/40 p-4`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="rounded-xl bg-white p-2.5 text-[#1E52F1]"><UserRound className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold text-slate-900">{customer.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[#1E52F1]"><Check className="size-3.5" aria-hidden="true" />Seleccionado</p>
        </div>
        <div className="flex w-full gap-1 sm:w-auto">
          <Button type="button" variant="outline" className="h-9" onClick={onChange}>Cambiar cliente</Button>
          <Button type="button" variant="ghost" size="icon-lg" aria-label="Limpiar selección de cliente" onClick={onClear}><X /></Button>
        </div>
      </div>
      <dl className="mt-4 grid min-w-0 gap-x-5 gap-y-3 border-t border-blue-100 pt-3 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-xs text-slate-500">Identificación</dt><dd className="mt-1 break-words font-medium">{customer.identification || "Sin identificación"}</dd></div>
        <div className="min-w-0"><dt className="flex items-center gap-1 text-xs text-slate-500"><Phone className="size-3" aria-hidden="true" />Teléfono</dt><dd className="mt-1 break-words">{customer.phone || "Sin teléfono"}</dd></div>
        <div className="min-w-0"><dt className="flex items-center gap-1 text-xs text-slate-500"><Mail className="size-3" aria-hidden="true" />Correo</dt><dd className="mt-1 break-all">{customer.email || "Sin correo"}</dd></div>
        <div className="min-w-0"><dt className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="size-3" aria-hidden="true" />Dirección</dt><dd className="mt-1 break-words">{customer.address || "Sin dirección"}</dd></div>
      </dl>
    </section>
  );
}
