import { SignUp } from "@clerk/nextjs";
import { Building2 } from "lucide-react";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 flex-col justify-between bg-slate-900 p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-base font-semibold text-white">Suite empresarial</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight text-white">
            Empieza a operar<br />tu negocio hoy
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Crea tu cuenta y configura inventario, ventas, facturacion electronica y canales de atencion.
          </p>
        </div>

        <p className="text-xs text-slate-600">
          Plataforma empresarial &copy; {new Date().getFullYear()}
        </p>
      </div>

      <div className="flex w-full lg:w-1/2 xl:w-3/5 items-center justify-center px-6 py-12">
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="lg:hidden flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900">Suite empresarial</span>
          </div>

          <SignUp />
        </div>
      </div>
    </main>
  );
}
