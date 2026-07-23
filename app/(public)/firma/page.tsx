import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  FileText,
  HelpCircle,
  Key,
  Lock,
  Shield,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Firma electrónica",
  description: "Conoce cómo preparar y conectar tu firma electrónica para emitir comprobantes SRI con Facturom.",
};

const steps = [
  {
    number: "01",
    icon: Key,
    title: "Obtén tu certificado",
    description: "Necesitas una firma electrónica vigente emitida por un proveedor autorizado en Ecuador.",
    note: "Facturom no promete vender el certificado; te guiamos para usarlo dentro del flujo de emisión.",
  },
  {
    number: "02",
    icon: Shield,
    title: "Prepara tu archivo y contraseña",
    description: "Ten a mano tu archivo .p12 o .pfx y la clave correcta para poder cargarlo en la plataforma.",
    note: "Esto evita errores comunes al momento de configurar el ambiente SRI.",
  },
  {
    number: "03",
    icon: FileText,
    title: "Configura datos de emisión",
    description: "Revisa RUC, establecimiento, punto de emisión y ambiente para que el flujo documental tenga coherencia con tu empresa.",
  },
  {
    number: "04",
    icon: Zap,
    title: "Conecta la firma y valida",
    description: "Te guiamos para preparar y conectar tu firma electrónica según el flujo disponible, empezando por pruebas si hace falta.",
  },
  {
    number: "05",
    icon: CheckCircle,
    title: "Emite con más confianza",
    description: "Una vez configurado el flujo, podrás usar la firma en la emisión electrónica y hacer seguimiento del estado de tus documentos.",
  },
];

const highlights = [
  "Uso de la firma en el flujo de emisión electrónica",
  "Compatibilidad con documentos SRI",
  "Carga de certificado con contraseña",
  "Soporte para ambiente de pruebas y producción",
  "Seguimiento de estados documentales",
  "RIDE y XML organizados por comprobante",
];

export default function FirmaPage() {
  return (
    <div>
      <section
        className="relative overflow-hidden py-24"
        style={{ background: "linear-gradient(145deg, #0d1c0a 0%, #1a0d2e 100%)" }}
      >
        <div
          className="pointer-events-none absolute top-0 right-0 h-[400px] w-[400px] rounded-full blur-[100px] opacity-15"
          style={{ background: "radial-gradient(circle, #8db600, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#8db60018] px-3 py-1.5 text-xs font-bold text-[#8db600]">
            <Shield size={12} />
            Firma electrónica para emisión SRI
          </div>
          <h1 className="mb-5 text-4xl font-black leading-tight text-white sm:text-5xl md:text-6xl">
            Conecta tu firma con un flujo
            <br />
            <span style={{ color: "#8db600" }}>más claro y más útil.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-400">
            Te guiamos para preparar y conectar tu firma electrónica según el flujo disponible, de modo que puedas usarla en la emisión de comprobantes electrónicos.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/contacto?servicio=firma-electronica"
              className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              Solicitar firma
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/precios"
              className="inline-flex items-center rounded-2xl border border-gray-700 px-7 py-3.5 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500"
            >
              Ver planes de facturación
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-5xl gap-12 px-4 sm:px-6 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="mb-4 text-2xl font-black text-gray-950">¿Qué resolvemos en esta etapa?</h2>
            <p className="mb-4 text-gray-500">
              Facturom ayuda a usar la firma electrónica dentro del proceso de emisión, no a reemplazar el rol del proveedor del certificado.
            </p>
            <p className="text-gray-500">
              El objetivo es que entiendas qué necesitas, cómo prepararlo y qué pasos seguir para que la firma funcione dentro del flujo de facturación electrónica.
            </p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-gray-50 p-8">
            <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-gray-700">Puntos clave</h3>
            <ul className="space-y-4">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle size={15} className="mt-0.5 shrink-0 text-[#588100]" />
                  <span className="text-sm text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-gray-50 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="mb-12 text-center text-2xl font-black text-gray-950">Cómo avanzar en 5 pasos</h2>
          <div className="space-y-6">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="flex gap-5 rounded-3xl border border-gray-100 bg-white p-7">
                  <div className="shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#58810012] text-xs font-black text-[#588100]">
                      {step.number}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Icon size={15} className="text-[#7f00b2]" />
                      <h3 className="text-base font-bold text-gray-900">{step.title}</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-500">{step.description}</p>
                    {step.note ? (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <HelpCircle size={13} className="mt-0.5 shrink-0 text-gray-400" />
                        <p className="text-xs text-gray-500">{step.note}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-white py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="mb-8 text-center text-2xl font-black text-gray-950">Qué cuidamos dentro del proceso</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { icon: Shield, text: "Preparación del flujo documental compatible con emisión SRI" },
              { icon: FileText, text: "Mejor contexto para XML, RIDE y estados por documento" },
              { icon: Key, text: "Uso del certificado con contraseña correcta" },
              { icon: Lock, text: "Tratamiento cuidadoso del certificado dentro del sistema" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.text} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <Icon size={15} className="mt-0.5 shrink-0 text-[#7f00b2]" />
                  <span className="text-sm text-gray-700">{item.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-gray-50 py-16 text-center">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <h2 className="mb-4 text-2xl font-black text-gray-950">¿Quieres que te orientemos con la firma?</h2>
          <p className="mb-8 text-gray-500">
            Si todavía no sabes qué certificado usar o cómo conectarlo al flujo de emisión, podemos guiarte desde contacto.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/contacto?servicio=firma-electronica"
              className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              Solicitar información de firma
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/precios"
              className="inline-flex items-center rounded-2xl border border-gray-200 bg-white px-7 py-3.5 text-sm font-semibold text-gray-700"
            >
              Ver planes
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
