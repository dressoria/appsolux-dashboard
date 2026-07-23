import Link from "next/link";

const footerLinks = {
  producto: [
    { label: "Funciones", href: "/funciones" },
    { label: "Precios", href: "/precios" },
    { label: "Firma electrónica", href: "/firma" },
    { label: "Blog", href: "/blog" },
  ],
  soporte: [
    { label: "Contacto", href: "/contacto" },
    { label: "Iniciar sesión", href: "/sign-in" },
    { label: "Crear cuenta", href: "/sign-up" },
  ],
  legal: [
    { label: "Términos de uso", href: "/terminos" },
    { label: "Privacidad", href: "/privacidad" },
  ],
};

export function PublicFooter() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <span className="text-xl font-bold text-white" style={{ color: "#4868FF" }}>
              Facturom
            </span>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              Facturación electrónica y gestión simple para negocios en Ecuador.
            </p>
            <p className="mt-4 text-xs text-gray-600">
              Operado por Bionvers SAS
            </p>
          </div>

          {/* Producto */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
              Producto
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.producto.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Soporte */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
              Acceso
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.soporte.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
              Legal
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.legal.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} Facturom. Todos los derechos reservados.
          </p>
          <p className="text-xs text-gray-700">
            Construido para Ecuador
          </p>
        </div>
      </div>
    </footer>
  );
}
