import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  ShoppingCart,
  Users,
  Package,
  Warehouse,
  BarChart3,
  Zap,
  Shield,
  CreditCard,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Building2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Funciones",
  description: "Facturación electrónica SRI, POS, inventario, compras, reportes y gestión empresarial en Facturom.",
};

const modulosCore = [
  {
    icon: FileText,
    title: "Facturación electrónica",
    color: "#588100",
    desc: "Emite todos los documentos autorizados por el SRI: facturas, notas de crédito y débito, retenciones y liquidaciones de compra. XML firmado y RIDE automático.",
    features: [
      "Facturas electrónicas autorizadas",
      "Notas de crédito y débito",
      "Retenciones en la fuente e IVA",
      "Liquidaciones de compra",
      "XML firmado con tu certificado digital",
      "RIDE en PDF automático",
      "Seguimiento de estados en tiempo real",
      "Ambiente de pruebas y producción",
    ],
  },
  {
    icon: ShoppingCart,
    title: "POS y ventas",
    color: "#7f00b2",
    desc: "Punto de venta rápido para registrar ventas, cobrar y emitir comprobante al cliente al instante. Funciona desde computadora, tablet o cualquier dispositivo web.",
    features: [
      "Venta rápida desde mostrador",
      "Múltiples formas de pago",
      "Comprobante electrónico al instante",
      "Historial de ventas",
      "Búsqueda de productos en tiempo real",
      "Notas de pedido y proformas",
    ],
  },
  {
    icon: Users,
    title: "Clientes",
    color: "#588100",
    desc: "Gestiona tu base de clientes con datos fiscales completos. Accede al historial de comprobantes, cuentas por cobrar y estado de cada cliente.",
    features: [
      "Registro con RUC o cédula validado",
      "Datos fiscales completos",
      "Historial de comprobantes",
      "Cuentas por cobrar",
      "Búsqueda y filtros rápidos",
      "Contacto directo por WhatsApp",
    ],
  },
  {
    icon: Package,
    title: "Productos e inventario",
    color: "#7f00b2",
    desc: "Administra tu catálogo con precios, costos, categorías y unidades de medida. El stock se actualiza automáticamente con cada venta.",
    features: [
      "Catálogo de productos y servicios",
      "Control de stock en tiempo real",
      "Categorías y unidades de medida",
      "Alertas de stock mínimo",
      "Movimientos y ajustes de inventario",
      "Kardex por producto",
    ],
  },
  {
    icon: TrendingUp,
    title: "Compras y proveedores",
    color: "#588100",
    desc: "Registra compras, recepciones y facturas de proveedores. Controla tus cuentas por pagar y el historial de cada proveedor.",
    features: [
      "Órdenes de compra",
      "Recepción de mercancía",
      "Facturas de proveedores",
      "Cuentas por pagar",
      "Historial por proveedor",
    ],
  },
  {
    icon: CreditCard,
    title: "Caja y bancos",
    color: "#7f00b2",
    desc: "Control de caja por turno, movimientos de efectivo, cuentas bancarias y conciliación. Cierre de caja con resumen detallado.",
    features: [
      "Apertura y cierre de caja",
      "Control de efectivo por turno",
      "Múltiples cuentas bancarias",
      "Ingresos y egresos",
      "Conciliación bancaria",
      "Resumen de caja diaria",
    ],
  },
  {
    icon: BarChart3,
    title: "Reportes",
    color: "#588100",
    desc: "Informes operativos y fiscales para tomar decisiones. Ventas, inventario, caja, clientes y documentos SRI en formatos claros.",
    features: [
      "Reporte de ventas por período",
      "Resumen de caja por turno",
      "Estado de inventario",
      "Documentos SRI emitidos",
      "ATS (anexo transaccional)",
      "Analítica de resultados",
    ],
  },
  {
    icon: Shield,
    title: "SRI y firma electrónica",
    color: "#7f00b2",
    desc: "Configura tu firma electrónica, establecimientos y puntos de emisión. Emite desde ambiente de pruebas o producción con validez legal.",
    features: [
      "Carga de certificado digital (.p12/.pfx)",
      "Configuración de establecimiento y RUC",
      "Ambiente de pruebas y producción",
      "Estados de autorización SRI",
      "Historial de documentos enviados",
      "Clave de acceso y número de autorización",
    ],
  },
];

const modulosEmpresarial = [
  {
    icon: Warehouse,
    title: "Bodegas",
    desc: "Múltiples bodegas, transferencias entre locales, conteo físico y valorización de inventario.",
    features: ["Múltiples bodegas", "Transferencias entre bodegas", "Conteo físico", "Valorización", "Kardex por bodega"],
  },
  {
    icon: Zap,
    title: "Cargas masivas",
    desc: "Importa clientes, productos y documentos desde archivos Excel para una carga inicial ágil.",
    features: ["Importar clientes", "Importar productos", "Plantillas Excel", "Validación previa"],
  },
  {
    icon: Building2,
    title: "Contabilidad básica",
    desc: "Plan de cuentas, asientos contables, libro mayor y estados financieros básicos.",
    features: ["Plan de cuentas", "Asientos contables", "Libro mayor", "Estado de resultados", "Balance general"],
  },
  {
    icon: BarChart3,
    title: "Reportes avanzados",
    desc: "ATS, analítica de resultados, reportes personalizados y exportación de datos.",
    features: ["ATS completo", "Analítica avanzada", "Exportación de datos", "Reportes por período"],
  },
];

export default function FuncionesPage() {
  return (
    <div>
      {/* Header */}
      <section className="bg-white py-20 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-black text-gray-950 mb-5 leading-tight">
            Todo lo que tu negocio necesita
            <br />
            <span
              style={{
                background: "linear-gradient(120deg, #588100, #7f00b2)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              en un solo sistema.
            </span>
          </h1>
          <p className="text-lg text-gray-500 mb-8">
            Módulos integrados que trabajan juntos. Factura, vende, compra, controla y reporta sin saltar entre aplicaciones.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
          >
            Comenzar gratis <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Módulos principales */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black text-gray-950 mb-10 text-center">Módulos incluidos en todos los planes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {modulosCore.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.title}
                  className="bg-white rounded-2xl p-7 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-4 mb-5">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${m.color}10` }}
                    >
                      <Icon size={21} style={{ color: m.color }} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-gray-900 mb-1">{m.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {m.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                        <CheckCircle size={12} className="mt-0.5 shrink-0" style={{ color: m.color }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Módulos Gestión Empresarial */}
      <section className="bg-white py-20 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span
              className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-4"
              style={{ backgroundColor: "#7f00b215", color: "#7f00b2" }}
            >
              Gestión Empresarial
            </span>
            <h2 className="text-2xl font-black text-gray-950 mb-3">Módulos avanzados para más control</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Disponibles en planes Pymes y Corporativo. Para negocios con mayor volumen y complejidad operativa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {modulosEmpresarial.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.title}
                  className="rounded-2xl p-7 border flex gap-5"
                  style={{ borderColor: "#7f00b215", backgroundColor: "#7f00b205" }}
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#7f00b212" }}
                  >
                    <Icon size={21} style={{ color: "#7f00b2" }} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900 mb-1.5">{m.title}</h3>
                    <p className="text-sm text-gray-500 mb-3 leading-relaxed">{m.desc}</p>
                    <ul className="space-y-1.5">
                      {m.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                          <CheckCircle size={12} className="shrink-0" style={{ color: "#7f00b2" }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-20 text-center"
        style={{ background: "linear-gradient(135deg, #0d1c0a, #1a0d2e)" }}
      >
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black text-white mb-4">¿Listo para empezar?</h2>
          <p className="text-gray-400 mb-8">3 meses gratis. Sin tarjeta de crédito.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #588100, #8db600)" }}
            >
              Crear cuenta gratis <ArrowRight size={15} />
            </Link>
            <Link
              href="/precios"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-semibold border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
            >
              Ver precios
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
