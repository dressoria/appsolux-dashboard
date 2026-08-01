import Link from "next/link";
import { FacturomBrand } from "@/components/public/facturom-brand";

const columns = {
  producto: [
    { label: "Funciones", href: "/funciones" },
    { label: "Precios", href: "/precios" },
    { label: "Firma electrónica", href: "/firma" },
    { label: "Blog", href: "/blog" },
  ],
  acceso: [
    { label: "Entrar", href: "/sign-in" },
    { label: "Crear cuenta", href: "/sign-up" },
    { label: "Contacto", href: "/contacto" },
  ],
  ayuda: [
    { label: "Solicitar plan", href: "/contacto" },
    { label: "Comparar planes", href: "/precios" },
    { label: "Guías y recursos", href: "/blog" },
  ],
};

export function PublicFooter() {
  return (
    <footer className="bg-facturom-primary-dark text-gray-200">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6">
        <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link href="/" className="mb-4 inline-flex items-center">
              <FacturomBrand
                variant="white"
                imageClassName="h-10 w-auto"
                textClassName="text-[1.35rem]"
              />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-gray-500">
              Facturación electrónica, POS, inventario, clientes y gestión comercial para negocios en Ecuador.
            </p>
            <div className="mt-5 flex gap-3">
              <span className="rounded-full border border-gray-700 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                SRI Ecuador
              </span>
              <span className="rounded-full border border-gray-700 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                facturom.com
              </span>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-600">Producto</h4>
            <ul className="space-y-2.5">
              {columns.producto.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-500 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-600">Acceso</h4>
            <ul className="space-y-2.5">
              {columns.acceso.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-500 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-600">Ayuda</h4>
            <ul className="space-y-2.5">
              {columns.ayuda.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-500 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-800/60 pt-8 sm:flex-row">
          <p className="text-xs text-gray-200">© {new Date().getFullYear()} Facturom. Todos los derechos reservados.</p>
          <p className="text-xs text-gray-200">Ecuador · Cumplimiento SRI</p>
        </div>
      </div>
    </footer>
  );
}
