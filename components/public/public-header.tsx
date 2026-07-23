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
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-gray-100/80 bg-white/96 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur-md">
      <div className="mx-auto flex h-[62px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-white"
            style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
          >
            F
          </div>
          <span className="text-[17px] font-bold tracking-tight text-gray-900 transition-colors group-hover:text-[#588100]">
            Facturom
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-[#588100]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:text-gray-900">
            Entrar
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg px-5 py-2 text-sm font-bold text-white transition-all hover:opacity-90 hover:shadow-md"
            style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
          >
            Comenzar gratis
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Link href="/login" className="px-3 py-1.5 text-sm font-semibold text-gray-700">
            Entrar
          </Link>
          <button
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="Menú"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-gray-100 bg-white px-4 pb-5 shadow-lg md:hidden">
          <nav className="flex flex-col pt-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-gray-50 py-3 text-sm font-medium text-gray-700 transition-colors hover:text-[#588100]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/sign-up"
            onClick={() => setOpen(false)}
            className="mt-4 flex justify-center rounded-xl px-5 py-3 text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
          >
            Comenzar gratis
          </Link>
        </div>
      ) : null}
    </header>
  );
}
