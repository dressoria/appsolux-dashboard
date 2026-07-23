import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Mail, Clock, ArrowRight, Phone, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contacta al equipo de Facturom. Soporte por WhatsApp, correo y atención personalizada.",
};

const usos = [
  "Preguntas sobre planes y precios",
  "Soporte técnico de la plataforma",
  "Configuración de firma electrónica",
  "Solicitar demo o capacitación",
  "Información sobre planes Pymes y Corporativo",
  "Integraciones o necesidades especiales",
];

export default function ContactoPage() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
  const email = process.env.SUPPORT_EMAIL ?? "soporte@facturom.com";

  return (
    <div>
      {/* Header */}
      <section className="bg-white py-20 border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-black text-gray-950 mb-5 leading-tight">
            Estamos aquí para ayudarte.
          </h1>
          <p className="text-lg text-gray-500">
            Tienes preguntas sobre Facturom, planes, firma electrónica o necesitas soporte.
            Escríbenos por el canal que prefieras.
          </p>
        </div>
      </section>

      {/* Canales principales */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
            {/* WhatsApp */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col gap-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: "#25D36615" }}
              >
                <MessageCircle size={22} style={{ color: "#25D366" }} />
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900 mb-2">WhatsApp</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">
                  Respuesta rápida para dudas sobre la plataforma, planes o soporte técnico.
                  Es el canal más rápido para obtener ayuda.
                </p>
                {whatsapp ? (
                  <a
                    href={`https://wa.me/${whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ backgroundColor: "#25D366", color: "white" }}
                  >
                    <MessageCircle size={15} /> Escribir por WhatsApp
                  </a>
                ) : (
                  <div
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: "#f3f4f6", color: "#9ca3af" }}
                  >
                    <Phone size={14} /> Disponible pronto
                  </div>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col gap-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: "#58810012" }}
              >
                <Mail size={22} style={{ color: "#588100" }} />
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900 mb-2">Correo electrónico</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">
                  Para consultas detalladas, reportes de problemas, solicitudes de planes empresariales o integraciones especiales.
                </p>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                  style={{ backgroundColor: "#58810012", color: "#588100" }}
                >
                  <Mail size={14} /> {email}
                </a>
              </div>
            </div>
          </div>

          {/* Horario */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-start gap-4">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#7f00b210" }}
            >
              <Clock size={20} style={{ color: "#7f00b2" }} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 mb-1">Horario de atención</h3>
              <p className="text-sm text-gray-500">
                Lunes a viernes en horario de oficina (Ecuador, GMT-5). Los mensajes fuera de
                horario se responden el siguiente día hábil.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Para qué contactarnos */}
      <section className="bg-white py-20 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black text-gray-950 mb-10 text-center">¿Cuándo contactarnos?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {usos.map((u) => (
              <div key={u} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <CheckCircle size={15} className="shrink-0" style={{ color: "#588100" }} />
                <span className="text-sm text-gray-700">{u}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-20 text-center"
        style={{ background: "linear-gradient(135deg, #0d1c0a, #1a0d2e)" }}
      >
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black text-white mb-4">
            ¿Prefieres explorar primero?
          </h2>
          <p className="text-gray-400 mb-8">
            Puedes empezar gratis y contactarnos cuando tengas preguntas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              Empezar gratis <ArrowRight size={15} />
            </Link>
            <Link
              href="/precios"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-semibold border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
            >
              Ver precios
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
