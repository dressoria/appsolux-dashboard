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
  ArrowRight,
  CheckCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Funciones",
  description: "Descubre todo lo que puedes hacer con Facturom: facturación electrónica SRI, POS, inventario, clientes, caja y más.",
};

const modulos = [
  {
    icon: FileText,
    title: "Facturación electrónica",
    desc: "Emite facturas, notas de crédito, retenciones y liquidaciones de compra autorizadas por el SRI. XML firmado y RIDE automático.",
    features: ["Facturas autorizadas", "Notas de crédito y débito", "Retenciones en la fuente e IVA", "Liquidaciones de compra", "XML y RIDE automático"],
    color: "#4868FF",
  },
  {
    icon: ShoppingCart,
    title: "POS y ventas",
    desc: "Punto de venta rápido para cobrar, registrar ventas y emitir comprobante al cliente al instante.",
    features: ["Venta rápida desde mostrador", "Múltiples formas de pago", "Comprobante al instante", "Historial de ventas", "Cobros y facturas ligados"],
    color: "#4868FF",
  },
  {
    icon: Users,
    title: "Clientes",
    desc: "Registro completo de clientes con RUC/cédula, datos fiscales, historial de compras y cuentas por cobrar.",
    features: ["Registro con RUC/cédula", "Datos fiscales validados", "Historial de comprobantes", "Cuentas por cobrar", "Búsqueda rápida"],
    color: "#4868FF",
  },
  {
    icon: Package,
    title: "Productos e inventario",
    desc: "Gestiona tu catálogo completo con precios, stock, categorías, unidades y movimientos de inventario.",
    features: ["Catálogo de productos", "Control de stock en tiempo real", "Categorías y unidades", "Alertas de stock bajo", "Movimientos y ajustes"],
    color: "#4868FF",
  },
  {
    icon: Warehouse,
    title: "Bodegas",
    desc: "Administra múltiples bodegas, transferencias entre locales y conteo físico de inventario.",
    features: ["Múltiples bodegas", "Transferencias entre bodegas", "Conteo físico", "Valorización de inventario", "Kardex por bodega"],
    color: "#FFBC47",
    badge: "Gestión Empresarial",
  },
  {
    icon: Zap,
    title: "Cargas masivas",
    desc: "Importa clientes, productos y documentos en masa desde archivos Excel para agilizar la carga inicial.",
    features: ["Importar clientes masivamente", "Importar productos", "Plantillas Excel listas", "Validación antes de importar"],
    color: "#FFBC47",
    badge: "Gestión Empresarial",
  },
  {
    icon: BarChart3,
    title: "Reportes",
    desc: "Informes de ventas, inventario, clientes, caja y SRI para entender tu negocio con claridad.",
    features: ["Reporte de ventas por período", "Resumen de caja", "Estado de inventario", "Documentos SRI emitidos", "ATS (anexo transaccional)"],
    color: "#4868FF",
  },
  {
    icon: Shield,
    title: "SRI y firma electrónica",
    desc: "Conecta tu firma digital, configura tu establecimiento y emite desde ambiente de pruebas o producción.",
    features: ["Certificado de firma electrónica", "Ambiente pruebas y producción", "RUC y establecimiento", "Estados de autorización", "Historial de documentos SRI"],
    color: "#4868FF",
  },
];

export default function FuncionesPage() {
  return (
    <div>
      {/* Header */}
      <section className="bg-white py-20 text-center border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-950 mb-5 leading-tight">
            Todo lo que necesitas para operar tu negocio
          </h1>
          <p className="text-lg text-gray-500 mb-8">
            Módulos diseñados para trabajar juntos. Sin saltar entre sistemas ni complicarte con integraciones.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: "#4868FF" }}
          >
            Comenzar gratis <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Módulos */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modulos.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.title}
                  className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm"
                >
                  <div className="flex items-start gap-4 mb-5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${m.color}12` }}
                    >
                      <Icon size={20} style={{ color: m.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-base font-bold text-gray-900">{m.title}</h2>
                        {m.badge && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#FFBC4718", color: "#92400e" }}
                          >
                            {m.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{m.desc}</p>
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {m.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                        <CheckCircle size={14} className="shrink-0" style={{ color: m.color }} />
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

      {/* CTA */}
      <section className="bg-white py-20 text-center border-t border-gray-100">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-950 mb-4">¿Listo para empezar?</h2>
          <p className="text-gray-500 mb-8">
            Crea tu cuenta y empieza a usar Facturom. Sin tarjeta de crédito requerida.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: "#4868FF" }}
            >
              Crear cuenta
            </Link>
            <Link
              href="/precios"
              className="px-6 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100"
            >
              Ver precios
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
