import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight, MessageCircle, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Precios",
  description: "Planes de Facturom desde $0. Gratis, Emprendedor, Pymes y Corporativo para negocios en Ecuador.",
};

const planes = [
  {
    name: "Gratis",
    ideal: "Para empezar a conocer Facturom",
    price: "$0",
    period: "",
    note: "3 meses sin costo",
    tag: "Sin tarjeta",
    features: [
      "20 documentos electrónicos",
      "Plataforma web completa",
      "Registro de clientes",
      "Registro de productos",
      "Acceso al POS",
    ],
    notIncluded: ["Reportes avanzados", "Soporte WhatsApp", "Múltiples emisores"],
    cta: "Empezar gratis",
    ctaHref: "/sign-up",
    highlight: false,
    color: "#588100",
  },
  {
    name: "Emprendedor",
    ideal: "Para negocios que ya facturan",
    price: "$8.92",
    period: "/ año",
    note: "+ IVA",
    tag: "Popular",
    features: [
      "100 documentos al año",
      "Genera recibos y proformas",
      "Reportes de facturación",
      "Soporte vía WhatsApp",
      "Historial de comprobantes",
      "POS incluido",
    ],
    notIncluded: ["Multiusuario", "Múltiples puntos de emisión"],
    cta: "Elegir plan",
    ctaHref: "/contacto",
    highlight: false,
    color: "#588100",
  },
  {
    name: "Pymes",
    ideal: "Para negocios en crecimiento",
    price: "$26.78",
    period: "/ año",
    note: "+ IVA",
    tag: "Recomendado",
    features: [
      "350 documentos al año",
      "Importa documentos masivamente",
      "Multiusuario",
      "Capacitaciones incluidas",
      "Múltiples puntos de emisión",
      "Analítica de resultados",
      "Soporte telefónico",
    ],
    notIncluded: [],
    cta: "Elegir plan",
    ctaHref: "/contacto",
    highlight: true,
    color: "#7f00b2",
  },
  {
    name: "Corporativo",
    ideal: "Para empresas con volumen alto",
    price: "$44.64",
    period: "/ año",
    note: "+ IVA",
    tag: "Empresas",
    features: [
      "700 documentos al año",
      "Generación de ATS",
      "Analítica de resultados",
      "Tutoriales personalizados",
      "Asesor personal",
      "Instrucciones de negocio",
      "Todo lo del plan Pymes",
    ],
    notIncluded: [],
    cta: "Hablar con ventas",
    ctaHref: "/contacto",
    highlight: false,
    color: "#588100",
  },
];

const faq = [
  {
    q: "¿Puedo cambiar de plan después?",
    a: "Sí. Puedes escalar al plan que necesites en cualquier momento desde tu cuenta o contactándonos.",
  },
  {
    q: "¿Los documentos se acumulan o se reinician?",
    a: "Los documentos se cuentan por período anual contratado. Al renovar, el contador se reinicia.",
  },
  {
    q: "¿Qué pasa si me quedo sin documentos?",
    a: "Puedes consultar un upgrade de plan o compra adicional contactando al equipo de soporte.",
  },
  {
    q: "¿Necesito instalar algo?",
    a: "No. Facturom es 100% web. Accedes desde cualquier navegador, sin instalaciones.",
  },
];

export default function PreciosPage() {
  return (
    <div>
      {/* Header */}
      <section className="bg-white py-20 text-center border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 border"
            style={{ borderColor: "#58810020", backgroundColor: "#5881000a", color: "#588100" }}
          >
            <Zap size={12} /> 3 meses gratis para empezar
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-950 mb-5 leading-tight">
            Precios claros.
            <br />Sin sorpresas.
          </h1>
          <p className="text-lg text-gray-500">
            Elige el plan que se ajusta a tu volumen. Empieza gratis y escala cuando crezcas.
          </p>
        </div>
      </section>

      {/* Planes */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {planes.map((p) => (
              <div
                key={p.name}
                className="bg-white rounded-2xl p-7 border flex flex-col transition-all hover:shadow-lg"
                style={{
                  borderColor: p.highlight ? p.color : "#e5e7eb",
                  boxShadow: p.highlight
                    ? `0 0 0 1px ${p.color}30, 0 8px 32px ${p.color}12`
                    : undefined,
                }}
              >
                {/* Tag */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{p.ideal}</p>
                    <h2 className="text-xl font-black text-gray-900">{p.name}</h2>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ml-2"
                    style={
                      p.highlight
                        ? { backgroundColor: `${p.color}18`, color: p.color }
                        : { backgroundColor: "#f3f4f6", color: "#6b7280" }
                    }
                  >
                    {p.tag}
                  </span>
                </div>

                {/* Price */}
                <div className="mb-1">
                  <span className="text-4xl font-black text-gray-950">{p.price}</span>
                  {p.period && <span className="text-sm text-gray-400 ml-1">{p.period}</span>}
                </div>
                <p className="text-xs text-gray-400 mb-6">{p.note}</p>

                {/* Features */}
                <ul className="space-y-2.5 mb-6 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <CheckCircle
                        size={14}
                        className="mt-0.5 shrink-0"
                        style={{ color: p.color }}
                      />
                      {f}
                    </li>
                  ))}
                  {p.notIncluded.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300 line-through">
                      <span className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-200 flex items-center justify-center text-xs">—</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={p.ctaHref}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                  style={
                    p.highlight
                      ? {
                          background: `linear-gradient(135deg, ${p.color}, #bc4ed8)`,
                          color: "white",
                          boxShadow: `0 4px 16px ${p.color}30`,
                        }
                      : { backgroundColor: "#f3f4f6", color: "#374151" }
                  }
                >
                  {p.cta} <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>

          {/* Nota IVA */}
          <p className="text-center text-xs text-gray-400 mt-8">
            Precios en USD. Los planes anuales excluyen IVA. Se confirman durante el registro o por contacto directo.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-20 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black text-gray-950 mb-10 text-center">Preguntas frecuentes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {faq.map((item) => (
              <div key={item.q} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-16 border-t border-gray-100 text-center">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black text-gray-950 mb-4">¿Tienes dudas sobre qué plan elegir?</h2>
          <p className="text-gray-500 mb-8">
            Escríbenos y te ayudamos a encontrar la mejor opción para tu negocio.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              Empezar gratis <ArrowRight size={14} />
            </Link>
            <Link
              href="/contacto"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-200"
            >
              <MessageCircle size={14} /> Contactar
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
