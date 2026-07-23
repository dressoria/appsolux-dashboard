import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import {
  FileText,
  ShoppingCart,
  Package,
  Users,
  CheckCircle,
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
  Warehouse,
} from "lucide-react";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/workspace");

  return (
    <>
      <PublicHeader />
      <main className="pt-16">
        <HeroSection />
        <FeaturesSection />
        <ModosSection />
        <SriSection />
        <GestionSection />
        <AutomationSection />
        <TrustSection />
        <CtaSection />
      </main>
      <PublicFooter />
    </>
  );
}

/* ─── Hero ─────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Subtle background blob */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-[0.06] blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #4868FF 0%, transparent 70%)" }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-28 md:py-40 text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border mb-8"
          style={{ borderColor: "#4868FF22", backgroundColor: "#4868FF0a", color: "#4868FF" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#4868FF" }} />
          Para negocios en Ecuador
        </div>

        {/* Title */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-gray-950 leading-[1.08] mb-6">
          Facturación electrónica
          <br />
          <span style={{ color: "#4868FF" }}>y gestión</span> simple
          <br />
          para tu negocio.
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-500 leading-relaxed mb-10">
          Emite comprobantes SRI, vende desde POS, controla productos, clientes,
          inventario y documentos desde una sola plataforma.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <Link
            href="/sign-up"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 shadow-lg"
            style={{ backgroundColor: "#4868FF", boxShadow: "0 4px 24px #4868FF40" }}
          >
            Comenzar ahora
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/funciones"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Ver cómo funciona
          </Link>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {["SRI Ecuador", "POS", "Inventario", "Clientes", "Gestión Empresarial"].map((badge) => (
            <span
              key={badge}
              className="px-3 py-1 text-xs font-medium rounded-full text-gray-600 bg-gray-100 border border-gray-200"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Features ──────────────────────────────────────────────── */

const features = [
  {
    icon: FileText,
    title: "Facturación electrónica SRI",
    desc: "Emite facturas, notas de crédito, retenciones y más. XML autorizado y RIDE en segundos.",
    color: "#4868FF",
  },
  {
    icon: ShoppingCart,
    title: "POS y ventas",
    desc: "Punto de venta rápido para cobrar, emitir comprobante y registrar la venta al instante.",
    color: "#4868FF",
  },
  {
    icon: Package,
    title: "Inventario y productos",
    desc: "Gestiona stock, categorías, unidades y movimientos sin complicarte.",
    color: "#4868FF",
  },
  {
    icon: Users,
    title: "Clientes y documentos",
    desc: "Base de clientes, historial de comprobantes, cuentas por cobrar y más.",
    color: "#4868FF",
  },
];

function FeaturesSection() {
  return (
    <section className="bg-gray-50 py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-950 mb-4">
            Más que solo facturar
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Facturom reúne en un mismo lugar todo lo que tu negocio necesita para operar día a día.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${f.color}12` }}
                >
                  <Icon size={20} style={{ color: f.color }} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Modos ──────────────────────────────────────────────────── */

const modos = [
  {
    name: "Básico",
    tag: "Para empezar",
    desc: "Para negocios que quieren vender, facturar y controlar lo esencial.",
    features: ["Facturación electrónica SRI", "POS y ventas", "Productos e inventario", "Clientes", "Caja", "Reportes básicos"],
    highlight: false,
    tagColor: "#4868FF",
  },
  {
    name: "Gestión Empresarial",
    tag: "Más completo",
    desc: "Para negocios que necesitan bodegas, cargas masivas, reportes avanzados y más control.",
    features: ["Todo lo del plan Básico", "Bodegas y transferencias", "Cargas masivas", "Reportes avanzados", "Contabilidad", "Cuentas por cobrar y pagar"],
    highlight: true,
    tagColor: "#FFBC47",
  },
  {
    name: "Sistema Dedicado",
    tag: "Empresas",
    desc: "Para empresas que requieren infraestructura y operación avanzada.",
    features: ["Todo lo de Gestión Empresarial", "Infraestructura dedicada", "Configuración personalizada", "Soporte prioritario"],
    highlight: false,
    tagColor: "#4868FF",
  },
];

function ModosSection() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-950 mb-4">
            Un sistema que crece con tu negocio
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Elige el nivel que necesitas hoy. Puedes escalar cuando estés listo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modos.map((m) => (
            <div
              key={m.name}
              className="rounded-2xl p-7 border flex flex-col"
              style={{
                borderColor: m.highlight ? "#FFBC47" : "#e5e7eb",
                boxShadow: m.highlight ? "0 4px 32px #FFBC4720" : undefined,
              }}
            >
              <div className="mb-5">
                <span
                  className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full mb-3"
                  style={{ backgroundColor: `${m.tagColor}18`, color: m.tagColor }}
                >
                  {m.tag}
                </span>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{m.name}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{m.desc}</p>
              </div>

              <ul className="space-y-2.5 mt-auto">
                {m.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <CheckCircle size={15} className="mt-0.5 shrink-0" style={{ color: m.tagColor }} />
                    {feat}
                  </li>
                ))}
              </ul>

              <Link
                href="/precios"
                className="mt-8 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={
                  m.highlight
                    ? { backgroundColor: "#FFBC47", color: "#78350f" }
                    : { backgroundColor: "#f3f4f6", color: "#374151" }
                }
              >
                Ver planes <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── SRI Section ────────────────────────────────────────────── */

const sriFeatures = [
  "Facturas electrónicas autorizadas por el SRI",
  "Notas de crédito y débito",
  "Liquidaciones de compra",
  "Retenciones en la fuente e IVA",
  "XML firmado digitalmente con tu certificado",
  "RIDE (representación impresa) automático",
  "Seguimiento de estados: autorizado, rechazado, pendiente",
  "Ambiente de pruebas y producción",
];

function SriSection() {
  return (
    <section className="bg-gray-950 py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <span
              className="inline-block px-3 py-1 text-xs font-semibold rounded-full mb-5"
              style={{ backgroundColor: "#4868FF18", color: "#7b9eff" }}
            >
              SRI Ecuador
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 leading-tight">
              Comprobantes electrónicos válidos ante el SRI
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">
              Conecta tu firma electrónica y emite comprobantes válidos con seguimiento
              de estados, XML autorizado y RIDE generado automáticamente.
            </p>
            <Link
              href="/firma"
              className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
              style={{ color: "#7b9eff" }}
            >
              Conocer firma electrónica <ArrowRight size={15} />
            </Link>
          </div>

          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
            <ul className="space-y-4">
              {sriFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle size={16} className="mt-0.5 shrink-0" style={{ color: "#4868FF" }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Gestión Section ────────────────────────────────────────── */

const gestionItems = [
  { icon: Package, label: "Productos" },
  { icon: Users, label: "Clientes" },
  { icon: BarChart3, label: "Inventario" },
  { icon: ShoppingCart, label: "Caja" },
  { icon: FileText, label: "Documentos" },
  { icon: BarChart3, label: "Reportes" },
  { icon: Zap, label: "Cargas masivas" },
  { icon: Warehouse, label: "Bodegas" },
];

function GestionSection() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <span
            className="inline-block px-3 py-1 text-xs font-semibold rounded-full mb-5"
            style={{ backgroundColor: "#FFBC4718", color: "#92400e" }}
          >
            Gestión Empresarial
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-950 mb-4">
            Todo en un mismo lugar
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Desde el inventario hasta los documentos contables, Facturom organiza tu operación completa.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {gestionItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "#FFBC4714" }}
                >
                  <Icon size={20} style={{ color: "#FFBC47" }} />
                </div>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Automation / IA ───────────────────────────────────────── */

function AutomationSection() {
  return (
    <section className="bg-gray-50 py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <span
            className="inline-block px-3 py-1 text-xs font-semibold rounded-full mb-5"
            style={{ backgroundColor: "#4868FF10", color: "#4868FF" }}
          >
            Próximamente
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-950 mb-5">
            Más tiempo para lo que importa
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed">
            Estamos construyendo herramientas para ayudarte a ahorrar tiempo en ventas,
            documentos y atención al cliente. Automatizaciones inteligentes que trabajen
            contigo, no en lugar tuyo.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Trust ──────────────────────────────────────────────────── */

const trustPoints = [
  { icon: Shield, text: "Construido para Ecuador", sub: "Diseñado desde cero para cumplir con los requisitos del SRI y la realidad del mercado local." },
  { icon: FileText, text: "Integración con SRI", sub: "Comprobantes electrónicos autorizados, estados en tiempo real, XML y RIDE." },
  { icon: Package, text: "Datos organizados", sub: "Clientes, productos, inventario y documentos en un solo sistema coherente." },
  { icon: Zap, text: "Operación simple", sub: "Interfaz clara, flujos directos. Sin curva de aprendizaje innecesaria." },
  { icon: Users, text: "Pensado para negocios reales", sub: "No para grandes corporaciones: para el negocio de todos los días." },
];

function TrustSection() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-950 mb-4">
            Por qué Facturom
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trustPoints.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.text} className="flex gap-4 p-6 rounded-2xl border border-gray-100">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#4868FF10" }}
                >
                  <Icon size={18} style={{ color: "#4868FF" }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{p.text}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{p.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA final ──────────────────────────────────────────────── */

function CtaSection() {
  return (
    <section className="py-28" style={{ backgroundColor: "#0f0f1e" }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
          Empieza con Facturom y ordena tu
          facturación desde hoy.
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          Sin configuraciones complicadas. Sin infraestructura que mantener.
          Solo tu negocio funcionando.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#FFE847", color: "#1a1a2e" }}
          >
            Crear cuenta <ArrowRight size={15} />
          </Link>
          <a
            href="https://wa.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
          >
            Hablar por WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
