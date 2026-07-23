import type { Metadata } from "next";
import Link from "next/link";
import { Shield, CheckCircle, ArrowRight, FileText, Key, Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Firma electrónica",
  description: "Conecta tu firma electrónica con Facturom y emite comprobantes autorizados por el SRI en Ecuador.",
};

const pasos = [
  {
    num: "01",
    title: "Obtén tu firma electrónica",
    desc: "Si aún no tienes firma electrónica, debes adquirirla con un proveedor autorizado por el MINTEL (Banco Central, Security Data, ANF AC, etc.). Puede ser para persona natural o jurídica.",
  },
  {
    num: "02",
    title: "Carga tu certificado en Facturom",
    desc: "En la configuración de SRI de tu cuenta, sube tu archivo .p12 o .pfx y la contraseña correspondiente. El certificado se almacena de forma segura.",
  },
  {
    num: "03",
    title: "Configura tu establecimiento",
    desc: "Registra tu RUC, razón social, dirección de establecimiento, punto de emisión y nombre comercial según tus datos en el SRI.",
  },
  {
    num: "04",
    title: "Elige ambiente de pruebas o producción",
    desc: "Puedes empezar en ambiente de pruebas para validar el proceso sin afectar tus documentos reales. Cuando estés listo, activa el ambiente de producción.",
  },
  {
    num: "05",
    title: "Emite tu primer comprobante",
    desc: "Desde el POS o el módulo de facturación, emite tu primera factura electrónica. Facturom firma, envía al SRI y regresa el estado de autorización automáticamente.",
  },
];

const beneficios = [
  { icon: Shield, text: "Firma digital con estándar XAdES-BES" },
  { icon: FileText, text: "XML autorizado y número de clave de acceso" },
  { icon: Key, text: "RIDE en PDF generado automáticamente" },
  { icon: Lock, text: "Certificado almacenado de forma segura" },
  { icon: CheckCircle, text: "Compatible con persona natural y jurídica" },
  { icon: CheckCircle, text: "Ambiente pruebas y producción SRI" },
];

export default function FirmaPage() {
  return (
    <div>
      {/* Header */}
      <section className="bg-gray-950 py-24 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6"
            style={{ backgroundColor: "#4868FF20", color: "#7b9eff" }}
          >
            <Shield size={12} /> SRI Ecuador
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
            Firma electrónica para comprobantes válidos ante el SRI
          </h1>
          <p className="text-lg text-gray-400 mb-8">
            Conecta tu certificado digital y emite facturas, retenciones y notas de crédito
            con validez legal. Facturom firma y envía al SRI por ti.
          </p>
          <Link
            href="/contacto"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: "#FFE847", color: "#1a1a2e" }}
          >
            Consultar disponibilidad <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-950 mb-12 text-center">
            Cómo conectar tu firma electrónica
          </h2>

          <div className="space-y-8">
            {pasos.map((paso) => (
              <div key={paso.num} className="flex gap-6 items-start">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ backgroundColor: "#4868FF12", color: "#4868FF" }}
                >
                  {paso.num}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1.5">{paso.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{paso.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios técnicos */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-950 mb-10 text-center">
            Lo que incluye la integración
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {beneficios.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.text}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100"
                >
                  <Icon size={16} style={{ color: "#4868FF" }} className="shrink-0" />
                  <span className="text-sm text-gray-700">{b.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Nota */}
      <section className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-gray-500 leading-relaxed mb-2">
            Facturom no vende certificados de firma electrónica directamente. La firma debes
            obtenerla con un proveedor autorizado (Banco Central del Ecuador, Security Data, ANF AC u otros).
          </p>
          <p className="text-sm text-gray-400">
            Una vez que tienes tu firma, la integración con Facturom es parte de la plataforma.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-16 text-center border-t border-gray-100">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-950 mb-4">¿Quieres saber más?</h2>
          <p className="text-gray-500 mb-8">
            Contáctanos y te orientamos sobre el proceso completo para usar firma electrónica con Facturom.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contacto"
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: "#4868FF" }}
            >
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
