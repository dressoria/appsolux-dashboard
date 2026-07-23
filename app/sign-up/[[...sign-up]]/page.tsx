import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { CheckCircle, ArrowLeft } from "lucide-react";

const perks = [
  "Primeros 3 meses gratis, sin tarjeta de crédito",
  "Facturación electrónica SRI activa desde el día 1",
  "POS, inventario y clientes listos para usar",
  "Firma electrónica fácil de configurar",
  "Soporte por WhatsApp incluido",
];

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen">
      {/* Brand panel */}
      <div
        className="hidden lg:flex lg:w-[44%] xl:w-2/5 flex-col justify-between p-10 xl:p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #1a0d2e 0%, #0d1c0a 60%, #1a0d2e 100%)" }}
      >
        {/* Decorative orbs */}
        <div
          className="pointer-events-none absolute top-0 left-0 w-[350px] h-[350px] rounded-full blur-[100px] opacity-20"
          style={{ background: "radial-gradient(circle, #bc4ed8, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full blur-[80px] opacity-15"
          style={{ background: "radial-gradient(circle, #8db600, transparent 70%)" }}
        />

        {/* Top: logo + back link */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              F
            </div>
            <span className="text-base font-bold text-white">Facturom</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft size={13} /> Volver
          </Link>
        </div>

        {/* Middle: headline + perks */}
        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-xs font-semibold text-[#bc4ed8] uppercase tracking-widest mb-3">
              Empieza gratis hoy
            </p>
            <h1 className="text-3xl xl:text-4xl font-black text-white leading-tight mb-4">
              Tu negocio merece
              <br />
              <span
                style={{
                  background: "linear-gradient(120deg, #bc4ed8, #8db600)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                un mejor sistema.
              </span>
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Configura tu empresa, carga tu firma electrónica y emite tu primera
              factura en minutos.
            </p>
          </div>

          <ul className="space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-gray-300">
                <CheckCircle size={15} className="mt-0.5 shrink-0" style={{ color: "#8db600" }} />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-gray-600 font-medium">facturom.com</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <p className="text-xs text-gray-700 text-center">
            Facturación electrónica para Ecuador · Cumplimiento SRI
          </p>
        </div>
      </div>

      {/* Clerk panel */}
      <div className="flex w-full lg:w-[56%] xl:w-3/5 items-center justify-center px-5 py-12 bg-gray-50">
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              F
            </div>
            <span className="text-base font-bold text-gray-900">Facturom</span>
          </Link>

          <SignUp />
        </div>
      </div>
    </main>
  );
}
