import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle,
  CreditCard,
  FileText,
  Package,
  Settings2,
  Shield,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  Warehouse,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Funciones",
  description: "Explora los módulos de Facturom: facturación electrónica, POS, inventario, clientes, compras, SRI y gestión empresarial.",
};

const sections = [
  {
    id: "facturacion-electronica",
    icon: FileText,
    title: "Facturación electrónica",
    description: "Emite comprobantes electrónicos y mantén el historial documental ordenado desde el mismo panel de trabajo.",
    benefits: [
      "Facturas, notas de crédito y débito",
      "Retenciones y liquidaciones de compra",
      "XML y RIDE por documento",
      "Consulta clara de estados de emisión",
    ],
    ctaLabel: "Ver planes",
    ctaHref: "/precios",
  },
  {
    id: "pos-ventas",
    icon: ShoppingCart,
    title: "POS y ventas",
    description: "Un flujo rápido para vender, cobrar y emitir el comprobante correcto sin depender de varias pantallas dispersas.",
    benefits: [
      "Cobro ágil desde mostrador",
      "Varias formas de pago",
      "Historial de ventas",
      "Venta conectada con caja e inventario",
    ],
    ctaLabel: "Crear cuenta",
    ctaHref: "/sign-up",
  },
  {
    id: "clientes",
    icon: Users,
    title: "Clientes",
    description: "Registra y reutiliza datos comerciales y fiscales para facturar con menos fricción y más contexto.",
    benefits: [
      "Ficha de cliente con RUC o cédula",
      "Historial de documentos",
      "Seguimiento de cuentas por cobrar",
      "Búsqueda rápida en ventas y facturación",
    ],
    ctaLabel: "Comenzar gratis",
    ctaHref: "/sign-up",
  },
  {
    id: "productos",
    icon: Package,
    title: "Productos",
    description: "Organiza tu catálogo con estructura suficiente para vender mejor y sostener el control operativo.",
    benefits: [
      "Productos y servicios en un solo catálogo",
      "Precios y costos organizados",
      "Categorías y unidades de medida",
      "Búsqueda rápida desde POS y ventas",
    ],
    ctaLabel: "Explorar precios",
    ctaHref: "/precios",
  },
  {
    id: "inventario",
    icon: Warehouse,
    title: "Inventario",
    description: "Controla stock, movimientos y disponibilidad para vender con más certeza y menos retrabajo.",
    benefits: [
      "Stock actualizado por venta",
      "Movimientos y ajustes",
      "Alertas de reposición",
      "Mejor visibilidad de existencias",
    ],
    ctaLabel: "Crear cuenta",
    ctaHref: "/sign-up",
  },
  {
    id: "compras",
    icon: TrendingUp,
    title: "Compras",
    description: "Mantén un flujo más ordenado desde la recepción de mercadería hasta el control de proveedores.",
    benefits: [
      "Registro de compras",
      "Recepción de productos",
      "Control por proveedor",
      "Seguimiento de cuentas por pagar",
    ],
    ctaLabel: "Hablar con asesor",
    ctaHref: "/contacto",
  },
  {
    id: "caja",
    icon: CreditCard,
    title: "Caja",
    description: "Sigue tus ingresos, egresos y cierres diarios sin depender de hojas externas para cuadrar operación.",
    benefits: [
      "Apertura y cierre de caja",
      "Movimientos de efectivo",
      "Resumen por turno o período",
      "Más claridad sobre cobros del día",
    ],
    ctaLabel: "Ver funciones comerciales",
    ctaHref: "/funciones#pos-ventas",
  },
  {
    id: "reportes",
    icon: BarChart3,
    title: "Reportes",
    description: "Consulta información útil para tomar decisiones sin perseguir datos entre módulos sueltos.",
    benefits: [
      "Ventas por período",
      "Documentos emitidos",
      "Resumen de caja",
      "Visibilidad de inventario",
    ],
    ctaLabel: "Ver precios",
    ctaHref: "/precios",
  },
  {
    id: "sri",
    icon: Shield,
    title: "SRI",
    description: "Configura el entorno documental de tu empresa y mantén seguimiento sobre el flujo electrónico que exige el SRI.",
    benefits: [
      "Ambiente de pruebas y producción",
      "Establecimientos y puntos de emisión",
      "Estados de recepción y autorización",
      "Historial de documentos SRI",
    ],
    ctaLabel: "Solicitar firma",
    ctaHref: "/firma",
  },
  {
    id: "gestion-empresarial",
    icon: Building2,
    title: "Gestión empresarial",
    description: "Cuando tu operación necesita más control, Facturom puede escalar hacia procesos más completos.",
    benefits: [
      "Más usuarios y áreas trabajando juntas",
      "Mejor orden en inventario y compras",
      "Mayor trazabilidad operativa",
      "Ruta comercial para planes más robustos",
    ],
    ctaLabel: "Hablar con asesor",
    ctaHref: "/contacto?plan=gestion-empresarial",
  },
  {
    id: "automatizacion",
    icon: Sparkles,
    title: "Automatización",
    description: "Reduce tareas repetitivas dentro del flujo comercial y documental con acciones mejor conectadas.",
    benefits: [
      "Menos captura duplicada",
      "Procesos más consistentes",
      "Documentos y datos más alineados",
      "Mejor seguimiento del trabajo operativo",
    ],
    ctaLabel: "Contactar equipo",
    ctaHref: "/contacto",
  },
];

export default function FuncionesPage() {
  return (
    <div className="bg-white">
      <section className="border-b border-gray-100 bg-white py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="mb-5 text-4xl font-black leading-tight text-gray-950 sm:text-5xl">
            Funciones con rutas claras,
            <br />
            <span
              style={{
                background: "linear-gradient(120deg, var(--facturom-primary), var(--facturom-primary-soft))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              no solo tarjetas bonitas.
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-500">
            Recorre cada módulo y decide si necesitas empezar gratis, comparar planes, consultar firma o hablar con un asesor.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--facturom-primary), var(--facturom-primary-soft))" }}
            >
              Comenzar gratis
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/precios"
              className="inline-flex items-center rounded-2xl border border-gray-200 bg-gray-100 px-7 py-3.5 text-sm font-semibold text-gray-700"
            >
              Ver planes
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-gray-100 bg-gray-50 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-3 px-4 sm:px-6">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/funciones#${section.id}`}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-facturom-primary hover:text-facturom-primary"
            >
              {section.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <article
                key={section.id}
                id={section.id}
                className="scroll-mt-24 rounded-3xl border border-gray-100 bg-gray-50 p-8"
              >
                <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
                  <div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-facturom-primary/10">
                      <Icon size={22} className="text-facturom-primary" />
                    </div>
                    <h2 className="mb-3 text-2xl font-black text-gray-950">{section.title}</h2>
                    <p className="mb-5 max-w-2xl text-sm leading-relaxed text-gray-500">{section.description}</p>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {section.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle size={14} className="mt-0.5 shrink-0 text-facturom-primary" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-3xl border border-white bg-white p-6">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                      Acción sugerida
                    </p>
                    <p className="mb-6 text-sm leading-relaxed text-gray-500">
                      Si este módulo resuelve lo que estás buscando, sigue por la ruta que más se ajusta a tu intención actual.
                    </p>
                    <Link
                      href={section.ctaHref}
                      className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white"
                      style={{ background: "linear-gradient(135deg, var(--facturom-primary), var(--facturom-primary-soft))" }}
                    >
                      {section.ctaLabel}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="border-t border-gray-100 py-20"
        style={{ background: "linear-gradient(135deg, var(--facturom-primary-dark), var(--facturom-primary))" }}
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <Settings2 size={20} className="text-white" />
          </div>
          <h2 className="mb-4 text-3xl font-black text-white">¿Quieres ver cómo encajan estos módulos en tu negocio?</h2>
          <p className="mb-8 text-gray-400">
            Puedes empezar con una cuenta nueva o escribirnos si ya necesitas un plan orientado a tu operación.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--facturom-primary), var(--facturom-primary-soft))" }}
            >
              Crear cuenta
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/contacto?plan=gestion-empresarial"
              className="inline-flex items-center rounded-2xl border border-gray-700 px-7 py-3.5 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-500"
            >
              Hablar con asesor
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
