import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Tag } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guías sobre facturación electrónica, SRI, inventario y gestión de negocios en Ecuador.",
};

const articulos = [
  {
    slug: "#",
    categoria: "SRI Ecuador",
    categoriaColor: "#588100",
    titulo: "¿Qué documentos electrónicos acepta el SRI en Ecuador?",
    resumen:
      "El SRI establece tipos de comprobantes electrónicos con requisitos específicos. Conoce cuáles aplican a tu negocio: facturas, notas de crédito, retenciones y más.",
    lectura: "5 min",
    estado: "proximamente",
  },
  {
    slug: "#",
    categoria: "Firma electrónica",
    categoriaColor: "#7f00b2",
    titulo: "Cómo conectar tu firma electrónica con tu sistema de facturación",
    resumen:
      "Guía paso a paso para cargar tu certificado digital, configurar tu establecimiento y empezar a emitir facturas válidas en ambiente de producción.",
    lectura: "7 min",
    estado: "proximamente",
  },
  {
    slug: "#",
    categoria: "Inventario",
    categoriaColor: "#588100",
    titulo: "Control de inventario: buenas prácticas para negocios en Ecuador",
    resumen:
      "Qué es un kardex, cómo hacer un conteo físico, cuándo hacer ajustes y cómo mantener tu stock actualizado sin perder tiempo.",
    lectura: "6 min",
    estado: "proximamente",
  },
  {
    slug: "#",
    categoria: "Facturación",
    categoriaColor: "#7f00b2",
    titulo: "Diferencias entre factura, nota de venta y recibo en Ecuador",
    resumen:
      "No todos los comprobantes son iguales. Aprende cuándo usar cada tipo de documento, cuáles requieren firma electrónica y qué implican para tu contabilidad.",
    lectura: "4 min",
    estado: "proximamente",
  },
  {
    slug: "#",
    categoria: "Gestión",
    categoriaColor: "#588100",
    titulo: "Cómo organizar el área de compras y proveedores de tu negocio",
    resumen:
      "Órdenes de compra, recepción de mercancía, facturas de proveedor y cuentas por pagar. Un flujo claro evita errores y mejora tu flujo de caja.",
    lectura: "5 min",
    estado: "proximamente",
  },
  {
    slug: "#",
    categoria: "POS",
    categoriaColor: "#7f00b2",
    titulo: "Punto de venta (POS): qué necesitas para empezar a vender rápido",
    resumen:
      "Configura tu POS, agrega productos, define formas de pago y emite tu primer comprobante en menos de 10 minutos.",
    lectura: "4 min",
    estado: "proximamente",
  },
];

export default function BlogPage() {
  return (
    <div>
      {/* Header */}
      <section className="bg-white py-20 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-black text-gray-950 mb-5 leading-tight">
            Guías y recursos para
            <br />
            <span
              style={{
                background: "linear-gradient(120deg, #588100, #7f00b2)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              tu negocio en Ecuador.
            </span>
          </h1>
          <p className="text-lg text-gray-500">
            Contenido sobre facturación electrónica, SRI, inventario, ventas y gestión empresarial.
            Escrito para negocios reales, no para auditores.
          </p>
        </div>
      </section>

      {/* Artículos */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Banner próximamente */}
          <div
            className="rounded-2xl p-5 border mb-10 flex items-center gap-4"
            style={{ borderColor: "#7f00b220", backgroundColor: "#7f00b208" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#7f00b215" }}
            >
              <Tag size={16} style={{ color: "#7f00b2" }} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Contenido en preparación</p>
              <p className="text-xs text-gray-500">
                Estamos preparando estos artículos. Podrás leerlos pronto. Si tienes una pregunta urgente, <Link href="/contacto" className="underline" style={{ color: "#7f00b2" }}>escríbenos</Link>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {articulos.map((a) => (
              <article
                key={a.titulo}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-md transition-all group"
              >
                <div className="p-7">
                  {/* Categoria + lectura */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: `${a.categoriaColor}12`,
                        color: a.categoriaColor,
                      }}
                    >
                      {a.categoria}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock size={11} />
                      {a.lectura} de lectura
                    </div>
                  </div>

                  {/* Título */}
                  <h2 className="text-base font-black text-gray-900 mb-3 leading-snug group-hover:text-[#588100] transition-colors">
                    {a.titulo}
                  </h2>

                  {/* Resumen */}
                  <p className="text-sm text-gray-500 leading-relaxed mb-5">{a.resumen}</p>

                  {/* Link (deshabilitado hasta publicación) */}
                  <div
                    className="inline-flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: a.categoriaColor }}
                  >
                    Próximamente <ArrowRight size={12} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter placeholder */}
      <section className="bg-white py-16 border-t border-gray-100 text-center">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black text-gray-950 mb-4">
            ¿Quieres recibir estas guías cuando estén listas?
          </h2>
          <p className="text-gray-500 mb-8">
            Por ahora puedes contactarnos directamente si tienes preguntas sobre facturación o gestión de tu negocio.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contacto"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              Contactarnos <ArrowRight size={15} />
            </Link>
            <Link
              href="/funciones"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-semibold text-gray-700 bg-gray-100"
            >
              Ver funciones
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
