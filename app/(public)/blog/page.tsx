import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog",
  description: "Próximamente: guías sobre facturación electrónica, SRI, inventario y gestión de negocios en Ecuador.",
};

export default function BlogPage() {
  return (
    <div>
      <section className="bg-white min-h-[70vh] flex items-center justify-center py-20">
        <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8"
            style={{ backgroundColor: "#4868FF10" }}
          >
            <BookOpen size={28} style={{ color: "#4868FF" }} />
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-950 mb-5 leading-tight">
            Guías y recursos próximamente
          </h1>

          <p className="text-lg text-gray-500 mb-4 leading-relaxed">
            Estamos preparando contenido sobre facturación electrónica, SRI, gestión de
            inventario y cómo organizar tu negocio en Ecuador.
          </p>

          <p className="text-gray-400 text-sm mb-10">
            Por ahora, si tienes preguntas concretas, escríbenos directamente.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contacto"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: "#4868FF" }}
            >
              Contactar <ArrowRight size={15} />
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
