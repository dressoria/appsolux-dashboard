import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle,
  CreditCard,
  FileText,
  Package,
  Receipt,
  Shield,
  ShoppingCart,
  TrendingUp,
  Users,
  Warehouse,
} from "lucide-react";

const modules = [
  {
    icon: FileText,
    title: "Facturación electrónica",
    description: "Facturas, notas, retenciones y documentos SRI listos para emitir desde un solo flujo.",
    href: "/funciones#facturacion-electronica",
  },
  {
    icon: ShoppingCart,
    title: "POS y ventas",
    description: "Cobra rápido, emite comprobantes al instante y mantén tus ventas conectadas con caja e inventario.",
    href: "/funciones#pos-ventas",
  },
  {
    icon: Users,
    title: "Clientes",
    description: "RUC, historial de compras, cuentas por cobrar y datos listos para facturar sin repetir trabajo.",
    href: "/funciones#clientes",
  },
  {
    icon: Package,
    title: "Inventario",
    description: "Catálogo, stock, movimientos y reposición con visibilidad clara de lo que tienes disponible.",
    href: "/funciones#inventario",
  },
  {
    icon: TrendingUp,
    title: "Compras",
    description: "Registra proveedores, compras y recepción de mercadería sin perder trazabilidad.",
    href: "/funciones#compras",
  },
  {
    icon: BarChart3,
    title: "Reportes",
    description: "Ventas, documentos SRI, caja y resultados organizados para tomar decisiones con criterio.",
    href: "/funciones#reportes",
  },
  {
    icon: Receipt,
    title: "SRI",
    description: "Estados de recepción y autorización, XML, RIDE y control documental en un mismo lugar.",
    href: "/funciones#sri",
  },
  {
    icon: Shield,
    title: "Firma electrónica",
    description: "Te guiamos para preparar y conectar tu firma electrónica según el flujo disponible.",
    href: "/firma",
  },
];

const plans = [
  {
    name: "Gratis",
    price: "$0",
    period: "/ 3 meses",
    summary: "Para empezar a operar y conocer Facturom.",
    features: ["20 documentos", "Plataforma web", "Clientes y productos"],
    cta: "Comenzar gratis",
    href: "/sign-up",
    featured: false,
  },
  {
    name: "Emprendedor",
    price: "$8.92",
    period: "+ IVA / año",
    summary: "Para negocios que ya emiten comprobantes con frecuencia.",
    features: ["100 documentos", "Recibos y proformas", "Soporte por WhatsApp"],
    cta: "Solicitar Emprendedor",
    href: "/contacto?plan=emprendedor",
    featured: false,
  },
  {
    name: "Pymes",
    price: "$26.78",
    period: "+ IVA / año",
    summary: "Para equipos en crecimiento que necesitan más control.",
    features: ["350 documentos", "Multiusuario", "Importa documentos"],
    cta: "Solicitar Pymes",
    href: "/contacto?plan=pymes",
    featured: true,
  },
  {
    name: "Corporativo",
    price: "$44.64",
    period: "+ IVA / año",
    summary: "Para operación más exigente y acompañamiento comercial.",
    features: ["700 documentos", "ATS", "Asesor personal"],
    cta: "Hablar con asesor",
    href: "/contacto?plan=corporativo",
    featured: false,
  },
];

const trustCards = [
  {
    icon: Shield,
    title: "Construido para Ecuador",
    description: "Pensado para facturación SRI, establecimientos, puntos de emisión y control documental local.",
  },
  {
    icon: FileText,
    title: "Pensado para facturación SRI",
    description: "Documentos electrónicos, XML, RIDE y seguimiento de estados organizados dentro del mismo sistema.",
  },
  {
    icon: Users,
    title: "Control de productos y clientes",
    description: "Tu operación comercial no queda aislada: clientes, productos y ventas trabajan conectados.",
  },
  {
    icon: BarChart3,
    title: "Documentos y reportes organizados",
    description: "Historial claro de ventas, inventario, caja y actividad SRI para revisar tu negocio con orden.",
  },
  {
    icon: Building2,
    title: "Escalable a gestión empresarial",
    description: "Puedes avanzar desde facturación básica hacia inventario, compras y control más completo.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.tenant?.id ? "/workspace" : "/onboarding");
  }

  return (
    <>
      <PublicHeader />
      <main className="pt-[62px]">
        <HeroSection />
        <ModulesSection />
        <PlansSection />
        <SriSection />
        <TrustSection />
        <FinalCtaSection />
      </main>
      <PublicFooter />
    </>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-[560px] w-[560px] rounded-full blur-[120px] opacity-10"
        style={{ background: "radial-gradient(circle, #8db600, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute top-10 right-0 h-[420px] w-[420px] rounded-full blur-[110px] opacity-10"
        style={{ background: "radial-gradient(circle, #bc4ed8, transparent 70%)" }}
      />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-12 px-4 pb-20 pt-24 sm:px-6 md:pb-24 md:pt-32 lg:flex-row lg:items-center">
        <div className="max-w-3xl">
          <span
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold"
            style={{
              borderColor: "#58810030",
              backgroundColor: "#5881000a",
              color: "#588100",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#8db600]" />
            Facturación electrónica y gestión comercial para Ecuador
          </span>
          <h1 className="mb-6 text-5xl font-black leading-[1.04] tracking-tight text-gray-950 sm:text-6xl md:text-7xl">
            Factura, vende y
            <br />
            controla tu negocio
            <br />
            <span
              style={{
                background: "linear-gradient(120deg, #588100 0%, #8db600 45%, #7f00b2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              desde un solo lugar.
            </span>
          </h1>
          <p className="mb-10 max-w-2xl text-lg leading-relaxed text-gray-500 sm:text-xl">
            Documentos SRI, POS, inventario, clientes, compras y reportes conectados en una
            plataforma diseñada para la operación diaria de negocios reales.
          </p>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-base font-bold text-white shadow-xl transition-all hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #588100 0%, #8db600 100%)",
                boxShadow: "0 8px 32px #58810045",
              }}
            >
              Comenzar gratis
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/precios"
              className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-gray-100 px-8 py-4 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-200"
            >
              Ver planes
            </Link>
          </div>
          <Link href="/funciones" className="inline-flex items-center gap-2 text-sm font-semibold text-[#588100]">
            Explorar funciones
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            "Facturación SRI con XML y RIDE",
            "POS listo para vender",
            "Productos, stock y clientes conectados",
            "Reportes para operar con orden",
          ].map((item) => (
            <div key={item} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <CheckCircle size={18} className="mb-3 text-[#588100]" />
              <p className="text-sm font-semibold text-gray-800">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModulesSection() {
  return (
    <section className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-black text-gray-950 sm:text-4xl">
            Módulos conectados para trabajar con menos fricción
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-500">
            Cada área apunta a una acción real: explorar funciones, revisar SRI, entender la firma
            electrónica o avanzar al plan adecuado.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.title}
                href={module.href}
                className="group rounded-3xl border border-gray-100 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-lg"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#58810010]">
                  <Icon size={20} className="text-[#588100]" />
                </div>
                <h3 className="mb-2 text-base font-black text-gray-900">{module.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-gray-500">{module.description}</p>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#7f00b2]">
                  Ir a esta sección
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PlansSection() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-black text-gray-950 sm:text-4xl">
            Planes claros para cada etapa de tu negocio
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-500">
            Elige entre empezar gratis o hablar con nosotros para el plan que mejor se ajusta a tu operación.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="flex flex-col rounded-3xl border bg-white p-6"
              style={{
                borderColor: plan.featured ? "#7f00b2" : "#e5e7eb",
                boxShadow: plan.featured ? "0 0 0 1px #7f00b220, 0 16px 40px #7f00b212" : undefined,
              }}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-gray-950">{plan.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{plan.summary}</p>
                </div>
                {plan.featured ? (
                  <span className="rounded-full bg-[#7f00b212] px-2.5 py-1 text-[11px] font-bold text-[#7f00b2]">
                    Recomendado
                  </span>
                ) : null}
              </div>
              <div className="mb-5">
                <span className="text-4xl font-black text-gray-950">{plan.price}</span>
                <span className="ml-2 text-sm text-gray-400">{plan.period}</span>
              </div>
              <ul className="mb-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle size={14} className="mt-0.5 shrink-0 text-[#588100]" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all"
                style={
                  plan.featured
                    ? {
                        background: "linear-gradient(135deg, #7f00b2 0%, #bc4ed8 100%)",
                        color: "white",
                      }
                    : {
                        backgroundColor: "#f3f4f6",
                        color: "#374151",
                      }
                }
              >
                {plan.cta}
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/precios" className="inline-flex items-center gap-2 text-sm font-semibold text-[#7f00b2]">
            Comparar todos los planes
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function SriSection() {
  return (
    <section
      className="relative overflow-hidden py-24"
      style={{ background: "linear-gradient(135deg, #0d1c0a 0%, #1a0d2e 100%)" }}
    >
      <div
        className="pointer-events-none absolute -top-20 right-0 h-[380px] w-[380px] rounded-full blur-[100px] opacity-10"
        style={{ background: "radial-gradient(circle, #8db600, transparent 70%)" }}
      />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="mb-5 inline-flex rounded-full bg-[#8db60018] px-3 py-1 text-xs font-bold text-[#8db600]">
            SRI Ecuador
          </span>
          <h2 className="mb-5 text-3xl font-black leading-tight text-white sm:text-4xl">
            Emite documentos válidos y mantén seguimiento real del flujo SRI
          </h2>
          <p className="mb-8 text-lg leading-relaxed text-gray-400">
            Facturom concentra la operación documental y te guía en la preparación de la firma
            electrónica para emitir con más claridad y menos pasos manuales.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/funciones#sri"
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              Ver funciones SRI
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/firma"
              className="inline-flex items-center justify-center rounded-2xl border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500"
            >
              Solicitar firma electrónica
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <ul className="space-y-3">
            {[
              "Facturas, notas, retenciones y liquidaciones",
              "Estados de envío y autorización organizados",
              "XML y RIDE disponibles por documento",
              "Ambiente de pruebas y producción",
              "Control de establecimientos y puntos de emisión",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-gray-300">
                <CheckCircle size={16} className="mt-0.5 shrink-0 text-[#8db600]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-black text-gray-950 sm:text-4xl">Una web comercial que sí te orienta</h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-500">
            Sin promesas infladas ni números inventados: lo importante es que cada ruta te ayude a entender si Facturom encaja contigo.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
          {trustCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-3xl border border-gray-100 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#7f00b210]">
                  <Icon size={18} className="text-[#7f00b2]" />
                </div>
                <h3 className="mb-2 text-sm font-black text-gray-900">{card.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{card.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden py-24" style={{ backgroundColor: "#080c06" }}>
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(ellipse 70% 55% at 50% 0%, #588100, transparent)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="mb-5 text-4xl font-black leading-tight text-white sm:text-5xl">
          Empieza con una prueba gratis
          <br />
          y luego decide con más información.
        </h2>
        <p className="mb-10 text-lg leading-relaxed text-gray-400">
          Si ya sabes que necesitas acompañamiento comercial, también puedes hablar con un asesor desde ahora.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #588100 0%, #8db600 100%)",
              boxShadow: "0 8px 32px #58810055",
            }}
          >
            Crear cuenta
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/contacto"
            className="inline-flex items-center rounded-2xl border border-gray-700 px-8 py-4 text-base font-semibold text-gray-300 transition-colors hover:border-gray-500"
          >
            Hablar con asesor
          </Link>
        </div>
      </div>
    </section>
  );
}
