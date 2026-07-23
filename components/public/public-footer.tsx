import Link from "next/link";

const links = {
  producto: [
    { label: "Funciones", href: "/funciones" },
    { label: "Precios", href: "/precios" },
    { label: "Firma electrónica", href: "/firma" },
    { label: "Blog", href: "/blog" },
  ],
  acceso: [
    { label: "Iniciar sesión", href: "/sign-in" },
    { label: "Crear cuenta", href: "/sign-up" },
    { label: "Contacto", href: "/contacto" },
  ],
  legal: [
    { label: "Términos de uso", href: "/terminos" },
    { label: "Privacidad", href: "/privacidad" },
  ],
};

export function PublicFooter() {
  return (
    <footer className="bg-[#0d0f12] text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">
          {/* Brand col */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
                style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
              >
                F
              </div>
              <span className="text-base font-bold text-white">Facturom</span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-500 max-w-xs">
              Facturación electrónica, POS, inventario y gestión empresarial para negocios en Ecuador.
            </p>
            <div className="flex gap-3 mt-5">
              <span className="px-2.5 py-1 text-[11px] font-medium rounded-full border border-gray-700 text-gray-500">
                SRI Ecuador
              </span>
              <span className="px-2.5 py-1 text-[11px] font-medium rounded-full border border-gray-700 text-gray-500">
                Firma electrónica
              </span>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-4">
              Producto
            </h4>
            <ul className="space-y-2.5">
              {links.producto.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-500 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-4">
              Acceso
            </h4>
            <ul className="space-y-2.5">
              {links.acceso.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-500 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-4">
              Legal
            </h4>
            <ul className="space-y-2.5">
              {links.legal.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-500 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800/60 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-700">
            © {new Date().getFullYear()} Facturom. Todos los derechos reservados.
          </p>
          <p className="text-xs text-gray-800">
            Ecuador · Cumplimiento SRI
          </p>
        </div>
      </div>
    </footer>
  );
}
