import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, Clock, Mail, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contacta al equipo de Facturom por WhatsApp o correo para planes, firma electrónica y soporte comercial.",
};

type ContactoPageProps = {
  searchParams?: Promise<{
    plan?: string;
    servicio?: string;
  }>;
};

const usageCases = [
  "Preguntas sobre planes y precios",
  "Acompañamiento comercial para Pymes o Corporativo",
  "Información sobre firma electrónica",
  "Soporte previo a la compra",
  "Consultas sobre operación, documentos o flujo SRI",
  "Necesidades de mayor volumen o gestión empresarial",
];

const intentMap = {
  emprendedor: {
    label: "Plan Emprendedor",
    message: "Hola, quiero información sobre el Plan Emprendedor de Facturom.",
  },
  pymes: {
    label: "Plan Pymes",
    message: "Hola, quiero información sobre el Plan Pymes de Facturom.",
  },
  corporativo: {
    label: "Plan Corporativo",
    message: "Hola, quiero información sobre el Plan Corporativo de Facturom.",
  },
  "alto-volumen": {
    label: "una opción de alto volumen",
    message: "Hola, quiero información sobre una opción de alto volumen en Facturom.",
  },
  "gestion-empresarial": {
    label: "Gestión Empresarial",
    message: "Hola, quiero información sobre la opción de Gestión Empresarial de Facturom.",
  },
  "firma-electronica": {
    label: "Firma electrónica",
    message: "Hola, quiero información sobre firma electrónica en Facturom.",
  },
} as const;

export default async function ContactoPage({ searchParams }: ContactoPageProps) {
  const params = (await searchParams) ?? {};
  const plan = params.plan;
  const service = params.servicio;
  const selectedIntent =
    (plan ? intentMap[plan as keyof typeof intentMap] : undefined) ??
    (service ? intentMap[service as keyof typeof intentMap] : undefined);

  const whatsappNumber =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ??
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ??
    "593988523538";
  const email =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ??
    process.env.SUPPORT_EMAIL ??
    "soporte@facturom.com";
  const whatsappMessage = selectedIntent?.message ?? "Hola, quiero información sobre Facturom.";
  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div>
      <section className="border-b border-gray-100 bg-white py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          {selectedIntent ? (
            <div
              className="mb-6 inline-flex rounded-full border px-4 py-1.5 text-xs font-semibold"
              style={{ borderColor: "#58810020", backgroundColor: "#5881000a", color: "#588100" }}
            >
              Estás consultando por {selectedIntent.label}
            </div>
          ) : null}
          <h1 className="mb-5 text-4xl font-black leading-tight text-gray-950 sm:text-5xl">
            Estamos listos para ayudarte.
          </h1>
          <p className="text-lg text-gray-500">
            Escríbenos por WhatsApp o correo si quieres resolver dudas sobre planes, firma electrónica o flujo comercial.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-5 rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D36615]">
                <MessageCircle size={22} style={{ color: "#25D366" }} />
              </div>
              <div>
                <h2 className="mb-2 text-base font-black text-gray-900">WhatsApp</h2>
                <p className="mb-5 text-sm leading-relaxed text-gray-500">
                  El canal más rápido para dudas sobre planes, soporte previo y orientación comercial.
                </p>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: "#25D366" }}
                >
                  <MessageCircle size={15} />
                  Hablar por WhatsApp
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-5 rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#58810012]">
                <Mail size={22} className="text-[#588100]" />
              </div>
              <div>
                <h2 className="mb-2 text-base font-black text-gray-900">Correo electrónico</h2>
                <p className="mb-5 text-sm leading-relaxed text-gray-500">
                  Útil para consultas detalladas, acompañamiento comercial, firma electrónica o necesidades especiales.
                </p>
                <a
                  href={`mailto:${email}?subject=${encodeURIComponent("Consulta sobre Facturom")}`}
                  className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-[#588100]"
                  style={{ backgroundColor: "#58810012" }}
                >
                  <Mail size={14} />
                  {email}
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#58810012]">
                <Clock size={20} className="text-[#588100]" />
              </div>
              <div>
                <h3 className="mb-1 text-base font-black text-gray-900">Horario de atención</h3>
                <p className="text-sm text-gray-500">
                  Lunes a viernes en horario de oficina de Ecuador (GMT-5). Si escribes fuera de ese horario, respondemos en el siguiente día hábil.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-white py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="mb-10 text-center text-2xl font-black text-gray-950">¿Para qué puedes contactarnos?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {usageCases.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <CheckCircle size={15} className="shrink-0 text-[#588100]" />
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="py-20 text-center"
        style={{ background: "linear-gradient(135deg, #0d0f12, #12230a)" }}
      >
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <h2 className="mb-4 text-2xl font-black text-white">¿Prefieres explorar primero?</h2>
          <p className="mb-8 text-gray-400">
            También puedes revisar planes o comenzar una cuenta nueva antes de contactarnos.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/precios"
              className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              Ver planes
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center rounded-2xl border border-gray-700 px-7 py-3.5 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
