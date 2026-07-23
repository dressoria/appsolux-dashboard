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
  ArrowRight,
  CheckCircle,
  BarChart3,
  Warehouse,
  CreditCard,
  Shield,
  Zap,
  TrendingUp,
  Building2,
  Receipt,
} from "lucide-react";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/workspace");

  return (
    <>
      <PublicHeader />
      <main className="pt-[62px]">
        <HeroSection />
        <ValueBanner />
        <FeaturesSection />
        <ModulesSection />
        <PlansPreview />
        <SriSection />
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
      {/* Decorative orbs */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[120px] opacity-[0.07]"
        style={{ background: "radial-gradient(circle, #8db600, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute top-20 -right-24 w-[480px] h-[480px] rounded-full blur-[100px] opacity-[0.06]"
        style={{ background: "radial-gradient(circle, #bc4ed8, transparent 70%)" }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-20 md:pt-32 md:pb-28 text-center">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 border"
          style={{
            borderColor: "#58810030",
            backgroundColor: "#5881000a",
            color: "#588100",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#8db600] animate-pulse" />
          Solución de facturación electrónica para Ecuador
        </div>

        {/* H1 */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.06] tracking-tight text-gray-950 mb-6">
          Factura, vende
          <br />y controla tu negocio
          <br />
          <span
            style={{
              background: "linear-gradient(120deg, #588100 0%, #8db600 50%, #7f00b2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            desde un solo lugar.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl mx-auto text-xl sm:text-2xl text-gray-500 leading-relaxed mb-12 font-light">
          Facturación electrónica SRI, POS, inventario, compras, reportes y gestión empresarial
          en una sola plataforma diseñada para Ecuador.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          <Link
            href="/sign-up"
            className="group flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold text-white shadow-xl transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #588100 0%, #8db600 100%)",
              boxShadow: "0 8px 32px #58810045",
            }}
          >
            Comenzar gratis
            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/funciones"
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200"
          >
            Ver funciones
          </Link>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {[
            "✓ Autorizado SRI Ecuador",
            "✓ Firma electrónica",
            "✓ XML y RIDE automático",
            "✓ POS incluido",
            "✓ Sin configuración complicada",
          ].map((b) => (
            <span
              key={b}
              className="px-3.5 py-1.5 text-xs font-medium rounded-full text-gray-600 bg-gray-50 border border-gray-200"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Value Banner ───────────────────────────────────────────── */

const valueItems = [
  { icon: Receipt, text: "Facturación electrónica SRI" },
  { icon: ShoppingCart, text: "POS y punto de venta" },
  { icon: Package, text: "Inventario y productos" },
  { icon: TrendingUp, text: "Compras y proveedores" },
  { icon: CreditCard, text: "Caja y cobros" },
  { icon: BarChart3, text: "Reportes y analítica" },
  { icon: Building2, text: "Gestión empresarial" },
  { icon: Shield, text: "Cumplimiento fiscal" },
];

function ValueBanner() {
  return (
    <section
      className="py-6 border-y border-gray-100"
      style={{ backgroundColor: "#fafafa" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {valueItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.text} className="flex items-center gap-2 text-gray-500">
                <Icon size={14} style={{ color: "#588100" }} className="shrink-0" />
                <span className="text-xs font-medium whitespace-nowrap">{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Features / Value Props ────────────────────────────────── */

const features = [
  {
    icon: Receipt,
    title: "No es solo facturar",
    desc: "Facturom integra facturación SRI, ventas, inventario y control financiero. Un sistema que trabaja junto, no por partes.",
    color: "#588100",
    bg: "#5881000a",
  },
  {
    icon: Zap,
    title: "Rápido desde el primer día",
    desc: "Configura tu empresa, carga tu firma electrónica y emite tu primera factura en minutos. Sin instalaciones ni servidores.",
    color: "#7f00b2",
    bg: "#7f00b20a",
  },
  {
    icon: Shield,
    title: "Cumplimiento fiscal Ecuador",
    desc: "Todos los documentos cumplen con los requisitos del SRI. XML firmado digitalmente, RIDE automático y estados en tiempo real.",
    color: "#588100",
    bg: "#5881000a",
  },
];

function FeaturesSection() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-950 mb-4">
            Más que un sistema de facturación
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg">
            Diseñado para negocios que necesitan operar de verdad, no solo emitir comprobantes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="p-8 rounded-3xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 group"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: f.bg }}
                >
                  <Icon size={22} style={{ color: f.color }} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Modules ────────────────────────────────────────────────── */

const modules = [
  {
    icon: FileText,
    title: "Facturación electrónica",
    desc: "Facturas, notas de crédito, retenciones, liquidaciones. XML autorizado y RIDE en segundos.",
    color: "#588100",
  },
  {
    icon: ShoppingCart,
    title: "POS y ventas",
    desc: "Punto de venta rápido, cobros, múltiples formas de pago y comprobante al instante.",
    color: "#7f00b2",
  },
  {
    icon: Users,
    title: "Clientes",
    desc: "Base de clientes con RUC/cédula, historial de comprobantes, cuentas por cobrar.",
    color: "#588100",
  },
  {
    icon: Package,
    title: "Productos e inventario",
    desc: "Catálogo, stock en tiempo real, alertas de stock bajo, movimientos y ajustes.",
    color: "#7f00b2",
  },
  {
    icon: TrendingUp,
    title: "Compras y proveedores",
    desc: "Órdenes de compra, recepción, facturas de proveedores y cuentas por pagar.",
    color: "#588100",
  },
  {
    icon: CreditCard,
    title: "Caja y bancos",
    desc: "Cierre de caja, control de efectivo, movimientos bancarios y conciliación.",
    color: "#7f00b2",
  },
  {
    icon: BarChart3,
    title: "Reportes",
    desc: "Ventas, inventario, SRI, caja y resultados. Información clara para tomar decisiones.",
    color: "#588100",
  },
  {
    icon: Warehouse,
    title: "Bodegas",
    desc: "Múltiples bodegas, transferencias, conteo físico y valorización de inventario.",
    color: "#7f00b2",
    badge: "Gestión Empresarial",
  },
];

function ModulesSection() {
  return (
    <section className="bg-gray-50 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-950 mb-4">
            Todo en uno. Sin saltar entre sistemas.
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto text-lg">
            Cada módulo conecta con los demás. Tu inventario actualiza al vender. Tu caja cuadra con tus cobros.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.title}
                className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${m.color}12` }}
                  >
                    <Icon size={19} style={{ color: m.color }} />
                  </div>
                  {m.badge && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#7f00b210", color: "#7f00b2" }}
                    >
                      Empresarial
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">{m.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{m.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/funciones"
            className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{ color: "#588100" }}
          >
            Ver todos los módulos <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Plans Preview ──────────────────────────────────────────── */

const plansPreview = [
  {
    name: "Gratis",
    period: "3 meses",
    price: "$0",
    tag: "Para empezar",
    features: ["20 documentos", "Clientes y productos", "Plataforma web"],
    highlight: false,
  },
  {
    name: "Emprendedor",
    period: "/ año",
    price: "$8.92",
    note: "+ IVA",
    tag: "Popular",
    features: ["100 documentos", "Recibos y proformas", "Reportes", "Soporte WhatsApp"],
    highlight: false,
  },
  {
    name: "Pymes",
    period: "/ año",
    price: "$26.78",
    note: "+ IVA",
    tag: "Recomendado",
    features: ["350 documentos", "Multiusuario", "Importación", "Múltiples emisores"],
    highlight: true,
  },
  {
    name: "Corporativo",
    period: "/ año",
    price: "$44.64",
    note: "+ IVA",
    tag: "Empresas",
    features: ["700 documentos", "ATS incluido", "Asesor personal", "Tutoriales a medida"],
    highlight: false,
  },
];

function PlansPreview() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-950 mb-4">
            Precios claros. Sin sorpresas.
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto text-lg">
            Empieza gratis y escala según el volumen de tu negocio.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plansPreview.map((p) => (
            <div
              key={p.name}
              className="rounded-2xl p-6 border flex flex-col transition-shadow hover:shadow-lg"
              style={{
                borderColor: p.highlight ? "#7f00b2" : "#e5e7eb",
                boxShadow: p.highlight ? "0 0 0 1px #7f00b230, 0 8px 32px #7f00b215" : undefined,
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm font-bold text-gray-900">{p.name}</span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={
                    p.highlight
                      ? { backgroundColor: "#7f00b215", color: "#7f00b2" }
                      : { backgroundColor: "#5881000f", color: "#588100" }
                  }
                >
                  {p.tag}
                </span>
              </div>

              <div className="mb-5">
                <span className="text-3xl font-black text-gray-950">{p.price}</span>
                <span className="text-sm text-gray-400 ml-1">{p.period}</span>
                {p.note && <span className="text-xs text-gray-400 ml-1">{p.note}</span>}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle
                      size={13}
                      className="shrink-0"
                      style={{ color: p.highlight ? "#7f00b2" : "#588100" }}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/precios"
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={
                  p.highlight
                    ? { backgroundColor: "#7f00b2", color: "white" }
                    : { backgroundColor: "#f3f4f6", color: "#374151" }
                }
              >
                {p.highlight ? "Elegir plan" : "Ver detalles"}
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/precios"
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: "#7f00b2" }}
          >
            Ver comparación completa de planes <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── SRI Section ────────────────────────────────────────────── */

const sriPoints = [
  "Facturas electrónicas autorizadas por el SRI",
  "Notas de crédito y débito electrónicas",
  "Retenciones en la fuente e IVA",
  "Liquidaciones de compra",
  "XML firmado con tu certificado digital",
  "RIDE (representación impresa) automático",
  "Seguimiento de estados en tiempo real",
  "Ambiente de pruebas y producción",
  "ATS y anexo transaccional",
];

function SriSection() {
  return (
    <section
      className="py-24 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d1c0a 0%, #1a0d2e 100%)" }}
    >
      {/* Decorative */}
      <div
        className="pointer-events-none absolute -top-20 right-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-10"
        style={{ background: "radial-gradient(circle, #8db600, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-10 w-[300px] h-[300px] rounded-full blur-[80px] opacity-10"
        style={{ background: "radial-gradient(circle, #bc4ed8, transparent 70%)" }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div
              className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-6"
              style={{ backgroundColor: "#8db60018", color: "#8db600" }}
            >
              SRI Ecuador
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-5 leading-tight">
              Comprobantes electrónicos válidos.
              <br />
              <span style={{ color: "#8db600" }}>Sin complicaciones técnicas.</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">
              Conecta tu firma electrónica una sola vez. Facturom firma, envía al SRI y
              hace seguimiento automático de cada documento.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
              >
                Comenzar <ArrowRight size={15} />
              </Link>
              <Link
                href="/firma"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
              >
                Sobre la firma electrónica
              </Link>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">
              Documentos soportados
            </h3>
            <ul className="space-y-3">
              {sriPoints.map((p) => (
                <li key={p} className="flex items-center gap-3 text-sm text-gray-300">
                  <CheckCircle size={16} className="shrink-0" style={{ color: "#8db600" }} />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Trust ──────────────────────────────────────────────────── */

const trustCards = [
  {
    icon: Shield,
    title: "Construido para Ecuador",
    desc: "Diseñado para cumplir con los requisitos del SRI, RUC, establecimientos y puntos de emisión del mercado local.",
    color: "#588100",
  },
  {
    icon: FileText,
    title: "Control total de documentos",
    desc: "Cada comprobante queda registrado con su estado, XML y RIDE. Acceso a tu historial completo desde cualquier dispositivo.",
    color: "#7f00b2",
  },
  {
    icon: Package,
    title: "Inventario siempre actualizado",
    desc: "Cada venta descuenta stock automáticamente. Nunca pierdas el control de lo que tienes y lo que necesitas reponer.",
    color: "#588100",
  },
  {
    icon: BarChart3,
    title: "Reportes sin esfuerzo",
    desc: "Ventas por período, movimientos de caja, estado de inventario y documentos SRI. Toda la información organizada.",
    color: "#7f00b2",
  },
  {
    icon: Zap,
    title: "Operación simple",
    desc: "Interfaz clara, flujos directos. Tu equipo aprende rápido y opera sin fricciones desde el primer día.",
    color: "#588100",
  },
  {
    icon: Building2,
    title: "Pensado para negocios reales",
    desc: "No para grandes corporaciones. Para el negocio que opera día a día en Ecuador y necesita un sistema que responda.",
    color: "#7f00b2",
  },
];

function TrustSection() {
  return (
    <section className="bg-gray-50 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-950 mb-4">
            Por qué elegir Facturom
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto text-lg">
            No es solo un sistema. Es la base para que tu negocio opere con orden y control.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trustCards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="bg-white rounded-2xl p-7 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-300"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${c.color}10` }}
                >
                  <Icon size={19} style={{ color: c.color }} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">{c.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Final ──────────────────────────────────────────────── */

function CtaSection() {
  return (
    <section
      className="py-28 relative overflow-hidden"
      style={{ backgroundColor: "#080c06" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #588100, transparent)",
        }}
      />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
          Empieza a facturar hoy.
          <br />
          <span style={{ color: "#8db600" }}>Gratis los primeros 3 meses.</span>
        </h2>
        <p className="text-gray-400 text-lg mb-10 leading-relaxed">
          Sin tarjeta de crédito. Sin configuraciones complicadas.
          <br />
          Solo tu negocio funcionando desde el primer día.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="group flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold transition-all hover:opacity-90 hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #588100 0%, #8db600 100%)",
              boxShadow: "0 8px 32px #58810055",
              color: "white",
            }}
          >
            Crear cuenta gratis
            <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/precios"
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
          >
            Ver planes y precios
          </Link>
        </div>
      </div>
    </section>
  );
}
