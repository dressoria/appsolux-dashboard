import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfkit uses __dirname to locate .afm font metrics files at runtime.
  // Without this, Turbopack/webpack inlines the module and __dirname becomes
  // a virtual build-time path (/ROOT/...) that does not exist in the container.
  serverExternalPackages: ["pdfkit"],
  // pdfkit reads font metric files via fs.readFileSync at runtime.
  // @vercel/nft cannot trace dynamic fs paths, so we force-include the data dir
  // so it lands in .next/standalone/node_modules/pdfkit/js/data/ at deploy time.
  outputFileTracingIncludes: {
    "/api/basic/sales/[saleId]/download-receipt": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/sri/documents/[documentId]/download-ride": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
