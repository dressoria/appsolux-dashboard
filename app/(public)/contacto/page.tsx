import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Mail, Clock, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contacta al equipo de Facturom. Soporte por WhatsApp y correo electrónico.",
};

export default function ContactoPage() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
  const email = process.env.SUPPORT_EMAIL ?? "soporte@facturom.com";

  return (
    <div>
      {/* Header */}
      <section className="bg-white py-20 text-center border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-950 mb-4 leading-tight">
            Estamos para ayudarte
          </h1>
          <p className="text-lg text-gray-500">
            Si tienes preguntas sobre la plataforma, planes o firma electrónica, escríbenos.
          </p>
        </div>
      </section>

      {/* Canales */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* WhatsApp */}
            <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm flex flex-col gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "#25D36618" }}
              >
                <MessageCircle size={20} style={{ color: "#25D366" }} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 mb-1">WhatsApp</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Respuesta rápida para dudas sobre la plataforma, precios o soporte técnico.
                </p>
                {whatsapp ? (
                  <a
                    href={`https://wa.me/${whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg"
                    style={{ backgroundColor: "#25D36614", color: "#1a7a3f" }}
                  >
                    <MessageCircle size={14} /> Escribir por WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">
                    Número disponible próximamente
                  </span>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm flex flex-col gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "#4868FF12" }}
              >
                <Mail size={20} style={{ color: "#4868FF" }} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 mb-1">Correo electrónico</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Para consultas detalladas, reportes o solicitudes de planes empresariales.
                </p>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg"
                  style={{ backgroundColor: "#4868FF12", color: "#4868FF" }}
                >
                  <Mail size={14} /> {email}
                </a>
              </div>
            </div>
          </div>

          {/* Horario */}
          <div className="mt-5 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#FFBC4714" }}
            >
              <Clock size={20} style={{ color: "#FFBC47" }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Horario de soporte</h2>
              <p className="text-sm text-gray-500">
                Lunes a viernes en horario de oficina. Los mensajes fuera de horario se
                responden el siguiente día hábil.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-16 text-center border-t border-gray-100">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-950 mb-4">¿Prefieres explorar primero?</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/funciones"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: "#4868FF" }}
            >
              Ver funciones <ArrowRight size={15} />
            </Link>
            <Link
              href="/precios"
              className="px-6 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100"
            >
              Ver precios
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
