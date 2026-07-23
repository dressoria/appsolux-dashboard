import type { Metadata } from "next";
import Link from "next/link";
import { Shield, CheckCircle, ArrowRight, Key, FileText, Lock, Zap, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Firma electrónica",
  description: "Conecta tu firma electrónica con Facturom y emite comprobantes válidos ante el SRI en Ecuador.",
};

const pasos = [
  {
    num: "01",
    icon: Key,
    title: "Obtén tu firma electrónica",
    desc: "Adquiere tu certificado de firma digital con un proveedor autorizado por el MINTEL: Banco Central del Ecuador, Security Data, ANF AC, u otro proveedor vigente. Puede ser para persona natural o jurídica.",
    note: "Este paso lo haces fuera de Facturom, con el proveedor de tu elección.",
  },
  {
    num: "02",
    icon: Shield,
    title: "Carga tu certificado en Facturom",
    desc: "Desde la sección SRI de tu cuenta, sube tu archivo .p12 o .pfx junto con la contraseña del certificado. Facturom lo almacena cifrado y nunca es accesible desde el frontend.",
    note: "El certificado solo se usa para firmar documentos. Nunca se comparte con terceros.",
  },
  {
    num: "03",
    icon: FileText,
    title: "Configura tu establecimiento",
    desc: "Registra tu RUC, razón social, dirección del establecimiento y punto de emisión exactamente como aparecen en el SRI. Puedes tener múltiples establecimientos según tu plan.",
  },
  {
    num: "04",
    icon: Zap,
    title: "Elige ambiente de pruebas o producción",
    desc: "Empieza en ambiente de pruebas para validar el flujo completo sin afectar tus documentos reales. Cuando estés listo, activa el ambiente de producción en un clic.",
  },
  {
    num: "05",
    icon: CheckCircle,
    title: "Emite tu primer comprobante autorizado",
    desc: "Desde el POS o el módulo de facturación, emite tu primera factura electrónica. Facturom firma el XML, lo envía al SRI y recibe la autorización automáticamente. El RIDE queda disponible al instante.",
  },
];

const tecnico = [
  { icon: Shield, text: "Firma digital con estándar XAdES-BES requerido por el SRI" },
  { icon: FileText, text: "XML autorizado con clave de acceso y número de autorización" },
  { icon: Key, text: "RIDE en PDF generado automáticamente" },
  { icon: Lock, text: "Certificado almacenado con cifrado en reposo" },
  { icon: CheckCircle, text: "Compatible con persona natural y jurídica" },
  { icon: Zap, text: "Ambiente de pruebas certificado (CELCER) y producción" },
  { icon: Shield, text: "Seguimiento de estado: autorizado, en proceso, rechazado" },
  { icon: FileText, text: "Reenvío automático ante errores transitorios del SRI" },
];

const proveedores = [
  { name: "Banco Central del Ecuador", url: "#" },
  { name: "Security Data", url: "#" },
  { name: "ANF AC Ecuador", url: "#" },
  { name: "Otros proveedores MINTEL", url: "#" },
];

export default function FirmaPage() {
  return (
    <div>
      {/* Hero */}
      <section
        className="py-24 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0d1c0a 0%, #1a0d2e 100%)" }}
      >
        <div
          className="pointer-events-none absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-15"
          style={{ background: "radial-gradient(circle, #8db600, transparent 70%)" }}
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-6"
            style={{ backgroundColor: "#8db60018", color: "#8db600" }}
          >
            <Shield size={12} /> SRI Ecuador — Documentos con validez legal
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-5 leading-tight">
            Firma electrónica
            <br />
            <span style={{ color: "#8db600" }}>para comprobantes válidos.</span>
          </h1>
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Conecta tu certificado digital una sola vez. Facturom firma, envía al SRI y
            hace seguimiento de cada documento de forma automática.
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
              href="/contacto"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-semibold border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
            >
              Consultar
            </Link>
          </div>
        </div>
      </section>

      {/* Qué es */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-black text-gray-950 mb-4">¿Qué es la firma electrónica?</h2>
              <p className="text-gray-500 leading-relaxed mb-4">
                La firma electrónica es un certificado digital que permite identificar de forma
                inequívoca al emisor de un documento. En Ecuador, el SRI exige que todos los
                comprobantes electrónicos estén firmados con un certificado válido.
              </p>
              <p className="text-gray-500 leading-relaxed">
                Con tu firma electrónica, Facturom puede generar el XML, firmarlo digitalmente
                con el estándar XAdES-BES y enviarlo al SRI para su autorización. El proceso
                es completamente automático desde que emites el documento.
              </p>
            </div>
            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-5 uppercase tracking-wider">
                ¿Para quién aplica?
              </h3>
              <ul className="space-y-4">
                {[
                  { title: "Persona natural obligada a llevar contabilidad", desc: "Debe emitir comprobantes electrónicos." },
                  { title: "Persona natural no obligada", desc: "Puede emitir electrónicamente de forma voluntaria." },
                  { title: "Sociedad o empresa", desc: "Obligada a emitir comprobantes electrónicos." },
                  { title: "Régimen RIMPE", desc: "Negocios populares y emprendedores según resolución vigente." },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <CheckCircle size={15} className="mt-0.5 shrink-0" style={{ color: "#588100" }} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pasos */}
      <section className="bg-gray-50 py-20 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black text-gray-950 mb-12 text-center">
            Cómo conectar tu firma en 5 pasos
          </h2>
          <div className="space-y-6">
            {pasos.map((paso) => {
              const Icon = paso.icon;
              return (
                <div
                  key={paso.num}
                  className="bg-white rounded-2xl p-7 border border-gray-100 flex gap-6 items-start"
                >
                  <div className="shrink-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black"
                      style={{ backgroundColor: "#58810012", color: "#588100" }}
                    >
                      {paso.num}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={15} style={{ color: "#7f00b2" }} />
                      <h3 className="text-base font-bold text-gray-900">{paso.title}</h3>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{paso.desc}</p>
                    {paso.note && (
                      <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <HelpCircle size={13} className="mt-0.5 shrink-0 text-gray-400" />
                        <p className="text-xs text-gray-500">{paso.note}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Técnico */}
      <section className="bg-white py-20 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black text-gray-950 mb-10 text-center">Especificaciones técnicas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tecnico.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.text} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <Icon size={15} style={{ color: "#7f00b2" }} className="mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-700">{t.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Proveedores */}
      <section className="bg-gray-50 py-16 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">
            Proveedores autorizados de firma electrónica en Ecuador
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {proveedores.map((p) => (
              <span
                key={p.name}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-white border border-gray-200 text-gray-600"
              >
                {p.name}
              </span>
            ))}
          </div>
          <p className="mt-5 text-xs text-gray-400">
            Facturom no vende certificados de firma electrónica. Debes adquirirlos directamente con el proveedor.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-16 border-t border-gray-100 text-center">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black text-gray-950 mb-4">¿Tienes tu firma y quieres empezar?</h2>
          <p className="text-gray-500 mb-8">
            Crea tu cuenta, carga tu certificado y emite tu primera factura electrónica en minutos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              Comenzar gratis <ArrowRight size={15} />
            </Link>
            <Link
              href="/contacto"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-semibold text-gray-700 bg-gray-100"
            >
              Contactar
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
