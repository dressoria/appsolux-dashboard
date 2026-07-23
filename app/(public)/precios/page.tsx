import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, ArrowRight, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Precios",
  description: "Planes de Facturom para negocios en Ecuador. Básico, Gestión Empresarial y Sistema Dedicado.",
};

const planes = [
  {
    name: "Básico",
    desc: "Para negocios que quieren facturar, vender y controlar lo esencial sin complicaciones.",
    features: [
      "Facturación electrónica SRI",
      "POS y ventas",
      "Gestión de productos",
      "Inventario básico",
      "Clientes",
      "Caja y reportes básicos",
      "XML y RIDE automático",
      "Soporte por correo",
    ],
    cta: "Empezar",
    ctaHref: "/sign-up",
    highlight: false,
    tagColor: "#4868FF",
  },
  {
    name: "Gestión Empresarial",
    desc: "Para negocios que necesitan más control: bodegas, cargas masivas, contabilidad y reportes avanzados.",
    features: [
      "Todo lo del plan Básico",
      "Bodegas múltiples",
      "Transferencias entre bodegas",
      "Cargas masivas",
      "Reportes avanzados",
      "Contabilidad básica",
      "Cuentas por cobrar y pagar",
      "ATS y anexos SRI",
      "Soporte prioritario",
    ],
    cta: "Consultar disponibilidad",
    ctaHref: "/contacto",
    highlight: true,
    tagColor: "#FFBC47",
  },
  {
    name: "Sistema Dedicado",
    desc: "Para empresas que requieren infraestructura propia, configuración personalizada y operación avanzada.",
    features: [
      "Todo lo de Gestión Empresarial",
      "Infraestructura dedicada",
      "Configuración personalizada",
      "Integración con sistemas externos",
      "Soporte técnico directo",
      "SLA garantizado",
    ],
    cta: "Hablar con ventas",
    ctaHref: "/contacto",
    highlight: false,
    tagColor: "#4868FF",
  },
];

export default function PreciosPage() {
  return (
    <div>
      {/* Header */}
      <section className="bg-white py-20 text-center border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-950 mb-4 leading-tight">
            Planes que se adaptan a tu negocio
          </h1>
          <p className="text-lg text-gray-500">
            Empieza con lo que necesitas hoy. Escala cuando estés listo.
          </p>
        </div>
      </section>

      {/* Planes */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {planes.map((p) => (
              <div
                key={p.name}
                className="bg-white rounded-2xl p-7 border flex flex-col"
                style={{
                  borderColor: p.highlight ? "#FFBC47" : "#e5e7eb",
                  boxShadow: p.highlight ? "0 4px 32px #FFBC4720" : undefined,
                }}
              >
                {p.highlight && (
                  <div
                    className="text-center text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full self-start mb-4"
                    style={{ backgroundColor: "#FFBC4720", color: "#92400e" }}
                  >
                    Más completo
                  </div>
                )}

                <h2 className="text-xl font-bold text-gray-900 mb-2">{p.name}</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">{p.desc}</p>

                <ul className="space-y-2.5 mb-8">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <CheckCircle size={14} className="mt-0.5 shrink-0" style={{ color: p.tagColor }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.ctaHref}
                  className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                  style={
                    p.highlight
                      ? { backgroundColor: "#FFBC47", color: "#78350f" }
                      : { backgroundColor: "#f3f4f6", color: "#374151" }
                  }
                >
                  {p.cta} <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>

          {/* Nota */}
          <div className="mt-10 text-center">
            <p className="text-sm text-gray-400">
              Los precios se confirman durante el proceso de registro o por contacto directo.
            </p>
          </div>
        </div>
      </section>

      {/* Dudas */}
      <section className="bg-white py-20 text-center border-t border-gray-100">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-950 mb-4">¿Tienes preguntas?</h2>
          <p className="text-gray-500 mb-8">
            Escríbenos y te explicamos qué plan se adapta mejor a tu negocio.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contacto"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: "#4868FF" }}
            >
              <MessageCircle size={15} />
              Contactar
            </Link>
            <Link
              href="/funciones"
              className="px-6 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100"
            >
              Ver funciones
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
