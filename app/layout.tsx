import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Facturom",
    template: "%s | Facturom",
  },
  description:
    "Emite comprobantes electrónicos, vende desde POS y gestiona productos, clientes, inventario y documentos en una sola plataforma.",
  openGraph: {
    title: "Facturom | Facturación electrónica para Ecuador",
    description:
      "Emite comprobantes electrónicos, vende desde POS y gestiona tu negocio desde una sola plataforma.",
    url: "https://facturom.com",
    siteName: "Facturom",
    locale: "es_EC",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Facturom",
    description: "Facturación electrónica simple para negocios en Ecuador.",
  },
  icons: {
    icon: { url: "/brand/facturom-icon.png", type: "image/png", sizes: "512x512" },
    shortcut: "/brand/facturom-icon.png",
    apple: "/brand/facturom-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="es" className="h-full antialiased">
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
