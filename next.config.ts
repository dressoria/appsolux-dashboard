import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfkit uses __dirname to locate .afm font metrics files at runtime.
  // Without this, Turbopack/webpack inlines the module and __dirname becomes
  // a virtual build-time path (/ROOT/...) that does not exist in the container.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
