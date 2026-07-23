"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Funciones", href: "/funciones" },
  { label: "Precios", href: "/precios" },
  { label: "Firma electrónica", href: "/firma" },
  { label: "Blog", href: "/blog" },
  { label: "Contacto", href: "/contacto" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <span
            className="text-xl font-bold tracking-tight"
            style={{ color: "#4868FF" }}
          >
            Facturom
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#4868FF" }}
          >
            Regístrate
          </Link>
        </div>

        {/* Mobile: show Entrar + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-gray-700"
          >
            Entrar
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-2 text-gray-600 hover:text-gray-900"
            aria-label="Menú"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4">
          <nav className="flex flex-col gap-1 pt-2">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm text-gray-700 hover:text-gray-900 py-2.5 border-b border-gray-50 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/sign-up"
            onClick={() => setOpen(false)}
            className="mt-3 flex justify-center text-sm font-semibold px-4 py-2.5 rounded-lg text-white"
            style={{ backgroundColor: "#4868FF" }}
          >
            Regístrate gratis
          </Link>
        </div>
      )}
    </header>
  );
}
