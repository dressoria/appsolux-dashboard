import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

import { CommercialPlanCatalog } from "@/components/appsolux/billing/commercial-plan-catalog";

export const metadata: Metadata = {
  title: "Precios",
  description: "Planes Básico, Negocio y Empresarial de Facturom para facturación electrónica en Ecuador.",
};

const faqs = [
  { question: "¿Las facturas tienen límite mensual?", answer: "No. Todos los planes de pago incluyen facturas electrónicas ilimitadas." },
  { question: "¿Cómo funciona la prueba gratuita?", answer: "Pruebas el plan Básico completo durante 7 días. No es un plan separado ni una versión reducida." },
  { question: "¿Puedo cambiar de plan?", answer: "Sí. Puedes elegir otro plan a medida que crezcan tu equipo, catálogo u operación." },
  { question: "¿Necesito firma electrónica?", answer: "Sí. Para emitir comprobantes válidos ante el SRI necesitas una firma electrónica vigente." },
];

export default function PreciosPage() {
  return (
    <div className="bg-white text-gray-950">
      <section className="border-b border-gray-100 bg-gradient-to-b from-facturom-primary/5 to-white py-20 text-center sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <span className="inline-flex rounded-full border border-facturom-primary/20 bg-white px-3 py-1.5 text-xs font-bold text-facturom-primary shadow-sm">Prueba Facturom Básico gratis por 7 días</span>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-6xl">Planes claros para facturar sin límites</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-600">Todos los planes incluyen facturación electrónica SRI y facturas ilimitadas. Elige según tu equipo y la complejidad de tu operación.</p>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20"><CommercialPlanCatalog context="public" /></main>

      <section className="border-y border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-black tracking-tight">Preguntas frecuentes</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {faqs.map((faq) => <article className="rounded-2xl border border-gray-200 bg-white p-6" key={faq.question}><h3 className="font-bold">{faq.question}</h3><p className="mt-2 text-sm leading-6 text-gray-600">{faq.answer}</p></article>)}
          </div>
        </div>
      </section>

      <section className="py-16 text-center">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-3xl font-black tracking-tight">Empieza a facturar con claridad</h2>
          <p className="mt-3 text-gray-600">Prueba todas las funciones del plan Básico durante 7 días o conversa con nuestro equipo.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link className="inline-flex items-center justify-center gap-2 rounded-xl bg-facturom-primary px-6 py-3 text-sm font-bold text-white" href="/sign-up">Probar gratis 7 días <ArrowRight className="size-4" /></Link>
            <Link className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-bold text-gray-700" href="/contacto"><MessageCircle className="size-4" /> Contactar asesor</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
