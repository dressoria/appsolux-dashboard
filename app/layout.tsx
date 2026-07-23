import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Facturom | Facturación electrónica para Ecuador",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="es"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
