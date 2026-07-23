import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";

const benefits = [
  "Factura, vende y controla tu negocio desde un solo lugar.",
  "Documentos SRI, POS, inventario y clientes conectados en Facturom.",
  "Historial comercial y documental organizado.",
  "Acceso desde cualquier navegador sin instalaciones complejas.",
];

export default function SignInPage() {
  return (
    <main className="flex min-h-screen">
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex lg:w-[44%] xl:w-2/5 xl:p-12"
        style={{ background: "linear-gradient(145deg, #0d1c0a 0%, #1a0d2e 60%, #0d1c0a 100%)" }}
      >
        <div
          className="pointer-events-none absolute top-0 right-0 h-[350px] w-[350px] rounded-full blur-[100px] opacity-20"
          style={{ background: "radial-gradient(circle, #8db600, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-[280px] w-[280px] rounded-full blur-[80px] opacity-15"
          style={{ background: "radial-gradient(circle, #bc4ed8, transparent 70%)" }}
        />

        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-white"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              F
            </div>
            <span className="text-base font-bold text-white">Facturom</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-gray-300">
            <ArrowLeft size={13} />
            Volver al inicio
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#8db600]">
              Bienvenido de vuelta
            </p>
            <h1 className="mb-4 text-3xl font-black leading-tight text-white xl:text-4xl">
              Factura, vende y controla
              <br />
              <span
                style={{
                  background: "linear-gradient(120deg, #8db600, #bc4ed8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                tu negocio desde un solo lugar.
              </span>
            </h1>
            <p className="text-sm leading-relaxed text-gray-400">
              Documentos SRI, POS, inventario y clientes conectados en Facturom.
            </p>
          </div>

          <ul className="space-y-3">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 text-sm text-gray-300">
                <CheckCircle size={15} className="mt-0.5 shrink-0 text-[#8db600]" />
                {benefit}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3 text-xs">
            <Link href="/precios" className="rounded-full border border-white/10 px-3 py-1.5 text-gray-300 transition-colors hover:border-white/20 hover:text-white">
              Ver planes
            </Link>
            <Link href="/contacto" className="rounded-full border border-white/10 px-3 py-1.5 text-gray-300 transition-colors hover:border-white/20 hover:text-white">
              Contactar soporte
            </Link>
          </div>
        </div>

        <div className="relative z-10">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-medium text-gray-600">facturom.com</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <p className="text-center text-xs text-gray-700">Facturación electrónica para Ecuador · Cumplimiento SRI</p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-gray-50 px-5 py-12 lg:w-[56%] xl:w-3/5">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <Link href="/" className="mb-2 flex items-center gap-2 lg:hidden">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-white"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              F
            </div>
            <span className="text-base font-bold text-gray-900">Facturom</span>
          </Link>

          <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-500 lg:hidden">
            <Link href="/precios">Ver planes</Link>
            <Link href="/contacto">Contactar soporte</Link>
          </div>

          <SignIn />
        </div>
      </div>
    </main>
  );
}
