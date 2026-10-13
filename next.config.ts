import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/sri-tax/**": ["./lib/core/sri-tax/resources/at.xsd"],
  },
};

export default nextConfig;
