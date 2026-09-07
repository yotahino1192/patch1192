import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/*": ["./drizzle/*.sql"] },
  serverExternalPackages: ["@libsql/client"],
};
export default nextConfig;
