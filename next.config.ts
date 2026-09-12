import { validateServer } from './lib/env/server';
import type { NextConfig } from "next";
validateServer(process.env);
const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: { "/*": ["./config/release-policy.json", "./config/schema-manifest.json"] },
  serverExternalPackages: ["@libsql/client"],
};
export default nextConfig;
