import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Tag } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guías y recursos sobre facturación electrónica, SRI, inventario y operación comercial en Ecuador.",
};

const guides = [
  {
    id: "guia-facturacion-electronica",
    category: "Guía",
    color: "var(--facturom-primary)",
    title: "Cómo empezar con facturación electrónica en Ecuador",
    excerpt: "Qué preparar antes de emitir, qué datos revisar y cómo ordenar tu operación desde el primer día.",
    readingTime: "5 min",
    body: "Antes de emitir, conviene tener claros tus datos fiscales, tu flujo de clientes y productos, y la forma en que vas a operar ventas y documentos. Empezar con orden reduce errores cuando pasas de la prueba a la emisión real.",
  },
  {
    id: "guia-sri",
    category: "Guía",
    color: "var(--facturom-primary-soft)",
    title: "Qué revisar del flujo SRI antes de emitir",
    excerpt: "Ambiente, establecimiento, punto de emisión y seguimiento documental: lo esencial para no perder contexto.",
    readingTime: "4 min",
    body: "El flujo SRI no es solo enviar un XML. También importa revisar ambiente, secuencia, puntos de emisión y el seguimiento del estado del documento. Tener ese contexto visible ayuda a operar con menos incertidumbre.",
  },
  {
    id: "guia-inventario",
    category: "Guía",
    color: "var(--facturom-primary)",
    title: "Control de inventario para vender con más claridad",
    excerpt: "Stock actualizado, movimientos y catálogo bien estructurado para evitar ventas desordenadas.",
    readingTime: "5 min",
    body: "Cuando inventario y ventas no conversan, empiezan los errores de stock, precios y reposición. Un catálogo bien armado y movimientos consistentes te ahorran ajustes dolorosos al final del mes.",
  },
  {
    id: "guia-clientes",
    category: "Guía",
    color: "var(--facturom-primary-soft)",
    title: "Cómo organizar clientes y documentos sin duplicar trabajo",
    excerpt: "Reutiliza información comercial y fiscal para facturar más rápido y sostener el seguimiento de cobros.",
    readingTime: "4 min",
    body: "Registrar bien a tus clientes desde el inicio facilita facturación, cobranza e historial comercial. También reduce retrabajo cuando necesitas repetir ventas o revisar documentos emitidos.",
  },
  {
    id: "guia-compras",
    category: "Guía",
    color: "var(--facturom-primary)",
    title: "Compras y proveedores: un flujo mínimo que sí ordena la operación",
    excerpt: "Qué registrar y cómo conectar compras con inventario y control interno.",
    readingTime: "5 min",
    body: "Aunque tu negocio sea pequeño, separar compra, recepción y control por proveedor ayuda a entender costos, disponibilidad y compromisos pendientes. Ese orden se vuelve clave cuando creces.",
  },
  {
    id: "guia-pos",
    category: "Guía",
    color: "var(--facturom-primary-soft)",
    title: "Qué debe tener tu POS para vender sin fricción",
    excerpt: "Velocidad de cobro, búsqueda de productos, medios de pago y conexión con caja e inventario.",
    readingTime: "4 min",
    body: "Un POS útil no solo cobra rápido: también debe ayudarte a mantener orden en stock, caja y documentos. Mientras menos pasos separados tengas, más estable se vuelve la operación diaria.",
  },
];

export default function BlogPage() {
  return (
    <div>
      <section className="border-b border-gray-100 bg-white py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="mb-5 text-4xl font-black leading-tight text-gray-950 sm:text-5xl">
            Guías útiles para entender
            <br />
            <span
              style={{
                background: "linear-gradient(120deg, var(--facturom-primary), var(--facturom-primary-soft))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              cómo operar mejor.
            </span>
          </h1>
          <p className="text-lg text-gray-500">
            Recursos breves sobre facturación electrónica, SRI, inventario, clientes, compras y POS.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {guides.map((guide) => (
              <article key={guide.id} className="group rounded-3xl border border-gray-100 bg-white p-7 transition-all hover:border-gray-200 hover:shadow-md">
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-facturom-primary/10 px-2.5 py-1 text-[11px] font-bold text-facturom-primary">
                    {guide.category}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock size={11} />
                    {guide.readingTime}
                  </div>
                </div>
                <h2 className="mb-3 text-base font-black leading-snug text-gray-900 transition-colors group-hover:text-facturom-primary">
                  {guide.title}
                </h2>
                <p className="mb-5 text-sm leading-relaxed text-gray-500">{guide.excerpt}</p>
                <Link href={`/blog#${guide.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-facturom-primary">
                  Leer guía
                  <ArrowRight size={13} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-white py-20">
        <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
          {guides.map((guide) => (
            <article key={guide.id} id={guide.id} className="scroll-mt-24 rounded-3xl border border-gray-100 bg-gray-50 p-8">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-facturom-primary/10 px-2.5 py-1 text-[11px] font-bold text-facturom-primary">
                  <Tag size={11} className="mr-1 inline" />
                  {guide.category}
                </span>
                <span className="text-xs text-gray-400">{guide.readingTime} de lectura</span>
              </div>
              <h3 className="mb-4 text-2xl font-black text-gray-950">{guide.title}</h3>
              <p className="mb-6 text-sm leading-relaxed text-gray-600">{guide.body}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/funciones"
                  className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, var(--facturom-primary), var(--facturom-primary-soft))" }}
                >
                  Ver funciones relacionadas
                  <ArrowRight size={14} />
                </Link>
                <Link
                  href="/contacto"
                  className="inline-flex items-center rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                >
                  Hablar con un asesor
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
