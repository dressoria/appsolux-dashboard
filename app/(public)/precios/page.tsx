import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, MessageCircle, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Precios",
  description: "Planes de Facturom para Ecuador: Gratis, Emprendedor, Pymes y Corporativo.",
};

const plans = [
  {
    name: "Gratis",
    price: "$0",
    period: "/ 3 meses",
    badge: "Sin costo inicial",
    features: [
      "20 documentos",
      "Plataforma web",
      "Registro de clientes",
      "Registro de productos",
    ],
    ctaLabel: "Comenzar gratis",
    ctaHref: "/sign-up",
    featured: false,
  },
  {
    name: "Emprendedor",
    price: "$8.92",
    period: "+ IVA / año",
    badge: "Para empezar a facturar más",
    features: [
      "100 documentos",
      "Genera recibos",
      "Genera proformas",
      "Reportes de facturación",
      "Soporte vía WhatsApp",
    ],
    ctaLabel: "Solicitar Emprendedor",
    ctaHref: "/contacto?plan=emprendedor",
    featured: false,
  },
  {
    name: "Pymes",
    price: "$26.78",
    period: "+ IVA / año",
    badge: "Recomendado",
    features: [
      "350 documentos",
      "Importa documentos",
      "Multiusuario",
      "Capacitaciones",
      "Múltiples puntos de emisión",
      "Analítica de resultados",
      "Soporte telefónico",
    ],
    ctaLabel: "Solicitar Pymes",
    ctaHref: "/contacto?plan=pymes",
    featured: true,
  },
  {
    name: "Corporativo",
    price: "$44.64",
    period: "+ IVA / año",
    badge: "Para operación de mayor volumen",
    features: [
      "700 documentos",
      "Generación de ATS",
      "Analítica de resultados",
      "Tutoriales personalizados",
      "Asesor personal",
    ],
    ctaLabel: "Hablar con asesor",
    ctaHref: "/contacto?plan=corporativo",
    featured: false,
  },
];

const faqs = [
  {
    question: "¿Los precios incluyen IVA?",
    answer: "No. Los valores publicados para planes anuales son más IVA.",
  },
  {
    question: "¿Qué pasa si supero mis documentos?",
    answer: "Puedes escribirnos para revisar un plan superior o una alternativa de mayor volumen.",
  },
  {
    question: "¿Puedo cambiar de plan?",
    answer: "Sí. Si tu operación crece, podemos orientarte para pasar al plan que mejor encaje.",
  },
  {
    question: "¿Necesito firma electrónica?",
    answer: "Sí, para emitir comprobantes electrónicos válidos ante el SRI necesitas una firma electrónica vigente.",
  },
  {
    question: "¿Funciona con SRI Ecuador?",
    answer: "Sí. Facturom está pensado para el flujo de facturación electrónica requerido en Ecuador.",
  },
];

export default function PreciosPage() {
  return (
    <div>
      <section className="border-b border-gray-100 bg-white py-20 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{ borderColor: "var(--facturom-primary)20", backgroundColor: "var(--facturom-primary)0a", color: "var(--facturom-primary)" }}
          >
            <Zap size={12} />
            Prueba gratis disponible
          </div>
          <h1 className="mb-5 text-4xl font-black leading-tight text-gray-950 sm:text-5xl">
            Precios claros
            <br />
            para elegir con intención.
          </h1>
          <p className="text-lg text-gray-500">
            Empieza gratis o solicita el plan que necesita tu negocio según volumen, equipo y nivel de operación.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="flex flex-col rounded-3xl border bg-white p-7"
                style={{
                  borderColor: plan.featured ? "var(--facturom-primary)" : "#e5e7eb",
                  boxShadow: plan.featured ? "0 0 0 1px var(--facturom-primary)20, 0 12px 36px var(--facturom-primary)12" : undefined,
                }}
              >
                <div className="mb-5">
                  <span
                    className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={
                      plan.featured
                        ? { backgroundColor: "var(--facturom-primary)12", color: "var(--facturom-primary)" }
                        : { backgroundColor: "var(--facturom-primary)10", color: "var(--facturom-primary)" }
                    }
                  >
                    {plan.badge}
                  </span>
                  <h2 className="mt-4 text-2xl font-black text-gray-950">{plan.name}</h2>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-black text-gray-950">{plan.price}</span>
                  <span className="ml-2 text-sm text-gray-400">{plan.period}</span>
                </div>

                <ul className="mb-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle size={14} className="mt-0.5 shrink-0 text-facturom-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaHref}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all"
                  style={
                    plan.featured
                      ? {
                          background: "linear-gradient(135deg, var(--facturom-primary) 0%, var(--facturom-primary-soft) 100%)",
                          color: "white",
                        }
                      : { backgroundColor: "#f3f4f6", color: "#374151" }
                  }
                >
                  {plan.ctaLabel}
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-white py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-gray-100 bg-gray-50 px-6 py-8 text-center sm:px-8">
          <h2 className="mb-3 text-2xl font-black text-gray-950">¿Necesitas más documentos?</h2>
          <p className="mb-6 text-gray-500">
            Si tu volumen es mayor o tu operación tiene otra estructura, te ayudamos a revisar una opción más adecuada.
          </p>
          <Link
            href="/contacto?plan=alto-volumen"
            className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--facturom-primary), var(--facturom-primary-soft))" }}
          >
            Solicitar opción de alto volumen
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-white py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="mb-10 text-center text-2xl font-black text-gray-950">Preguntas frecuentes</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
                <h3 className="mb-2 text-sm font-bold text-gray-900">{faq.question}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-gray-50 py-16 text-center">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <h2 className="mb-4 text-2xl font-black text-gray-950">¿Quieres ayuda para elegir?</h2>
          <p className="mb-8 text-gray-500">
            Si no tienes claro qué plan te conviene, podemos orientarte según tu número de documentos y tu operación.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--facturom-primary), var(--facturom-primary-soft))" }}
            >
              Comenzar gratis
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/contacto"
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700"
            >
              <MessageCircle size={14} />
              Contactar asesor
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
