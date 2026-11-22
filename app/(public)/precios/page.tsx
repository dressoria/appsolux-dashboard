import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

import { CommercialPlanCatalog } from "@/components/appsolux/billing/commercial-plan-catalog";

export const metadata: Metadata = {
  title: "Precios — Facturom",
  description:
    "Planes Básico, Negocio y Empresarial de Facturom para facturación electrónica en Ecuador. Documentos ilimitados en todos los planes.",
};

const faqs = [
  {
    question: "¿Los documentos electrónicos tienen límite?",
    answer:
      "No. Todos los planes de pago incluyen documentos electrónicos ilimitados: facturas, notas de crédito y más.",
  },
  {
    question: "¿Cómo funciona la prueba gratuita?",
    answer:
      "Pruebas el plan Básico completo durante 7 días. No necesitas ingresar datos de pago para comenzar.",
  },
  {
    question: "¿Puedo cambiar de plan después?",
    answer:
      "Sí. Puedes elegir otro plan a medida que crezcan tu equipo, catálogo u operación.",
  },
  {
    question: "¿Necesito firma electrónica?",
    answer:
      "Sí. Para emitir comprobantes válidos ante el SRI necesitas una firma electrónica vigente.",
  },
  {
    question: "¿Los precios incluyen IVA?",
    answer:
      "Los precios mostrados son antes de impuestos. El IVA se calcula por separado según la normativa vigente en Ecuador.",
  },
  {
    question: "¿Qué métodos de pago aceptan?",
    answer:
      "Puedes pagar con tarjeta de crédito o débito a través de nuestra pasarela de pagos, o mediante transferencia bancaria.",
  },
];

export default function PreciosPage() {
  return (
    <div className="bg-white text-gray-950">
      {/* Hero */}
      <section className="border-b border-gray-100 bg-gradient-to-b from-[#FF0099]/[0.04] via-white to-white py-20 text-center sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <span className="inline-flex rounded-full border border-[#FF0099]/20 bg-white px-3 py-1.5 text-xs font-bold text-[#FF0099] shadow-sm">
            Prueba Facturom Básico gratis por 7 días
          </span>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-[#000345] sm:text-6xl">
            Planes claros para facturar sin límites
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-600">
            Todos los planes incluyen facturación electrónica SRI y documentos
            ilimitados. Elige según tu equipo y la complejidad de tu operación.
          </p>
        </div>
      </section>

      {/* Plans */}
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <CommercialPlanCatalog context="public" />
      </main>

      {/* FAQ */}
      <section className="border-y border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-black tracking-tight text-[#000345]">
            Preguntas frecuentes
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {faqs.map((faq) => (
              <article
                className="rounded-2xl border border-gray-200 bg-white p-6"
                key={faq.question}
              >
                <h3 className="font-bold text-[#000345]">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {faq.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-3xl font-black tracking-tight text-[#000345]">
            Empieza a facturar con claridad
          </h2>
          <p className="mt-3 text-gray-600">
            Prueba todas las funciones del plan Básico durante 7 días o conversa
            con nuestro equipo.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#000345] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#000345]/90"
              href="/sign-up"
            >
              Probar gratis 7 días <ArrowRight className="size-4" />
            </Link>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
              href="/contacto"
            >
              <MessageCircle className="size-4" /> Contactar asesor
            </Link>
          </div>
          <p className="mt-6 text-xs text-gray-500">
            Al registrarte aceptas los{" "}
            <Link href="/terminos-y-condiciones" className="underline hover:text-gray-700">
              Términos y Condiciones
            </Link>{" "}
            y reconoces nuestra{" "}
            <Link href="/politica-de-privacidad" className="underline hover:text-gray-700">
              Política de Privacidad
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
