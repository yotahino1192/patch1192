import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  // Read only mobile configuration. Never expose the root server .env.
  const env = loadEnv(mode, root, "PATCH_");
  const clerkKey = process.env.PATCH_CLERK_PUBLISHABLE_KEY || env.PATCH_CLERK_PUBLISHABLE_KEY || "";
  if (mode !== "development" && !/^pk_(test|live)_/.test(clerkKey)) throw new Error("Set PATCH_CLERK_PUBLISHABLE_KEY for the mobile authentication build.");
  const backend = process.env.PATCH_API_URL || env.PATCH_API_URL || (mode === "development" ? "http://localhost:3001" : "");
  if (!backend) throw new Error("Set PATCH_API_URL to your HTTPS backend origin for a production mobile build.");
  const url = new URL(backend);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("PATCH_API_URL must be an HTTP(S) origin, without a path or credentials.");
  }
  if (mode !== "development" && url.protocol !== "https:") {
    throw new Error("Production mobile builds require an HTTPS backend.");
  }
  return {
    root,
    envDir: root,
    publicDir: fileURLToPath(new URL("../public", import.meta.url)),
    plugins: [react(), {
      name: "patch-build-metadata",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "patch-build.json", source: JSON.stringify({ mode, apiOrigin: url.origin }) });
      },
    }],
    define: { __PATCH_API_URL__: JSON.stringify(url.origin), __PATCH_CLERK_PUBLISHABLE_KEY__: JSON.stringify(clerkKey), "process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": JSON.stringify(clerkKey) },
    build: {
      outDir: "../dist/mobile",
      emptyOutDir: true,
      target: "safari17",
      sourcemap: false,
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: { "/api": { target: url.origin, changeOrigin: false } },
    },
  };
});
