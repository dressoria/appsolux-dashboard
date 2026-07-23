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
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/96 backdrop-blur-md border-b border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[62px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
            style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
          >
            F
          </div>
          <span className="text-[17px] font-bold tracking-tight text-gray-900 group-hover:text-[#588100] transition-colors">
            Facturom
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-gray-600 hover:text-[#588100] transition-colors font-medium"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors px-3 py-1.5"
          >
            Entrar
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-bold px-5 py-2 rounded-lg text-white transition-all hover:opacity-90 hover:shadow-md"
            style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
          >
            Comenzar gratis
          </Link>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <Link href="/sign-in" className="text-sm font-semibold text-gray-700 px-3 py-1.5">
            Entrar
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Menú"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-5 shadow-lg">
          <nav className="flex flex-col gap-0 pt-2">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm text-gray-700 hover:text-[#588100] py-3 border-b border-gray-50 transition-colors font-medium"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/sign-up"
            onClick={() => setOpen(false)}
            className="mt-4 flex justify-center text-sm font-bold px-5 py-3 rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
          >
            Comenzar gratis
          </Link>
        </div>
      )}
    </header>
  );
}
