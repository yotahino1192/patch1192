import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: { "/*": ["./drizzle/*.sql"] },
  serverExternalPackages: ["@libsql/client"],
};
export default nextConfig;
