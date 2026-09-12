import { readFileSync } from 'node:fs';
import { validatePublic, type ReleasePolicy } from '../lib/env/public';
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  // Read only mobile configuration. Never expose the root server .env.
  const env = loadEnv(mode, root, "PATCH_");
  const input = { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('PATCH_'))) };
  if (!input.PATCH_ENV && mode === 'development') input.PATCH_ENV = 'development';
  if (mode !== 'development' && input.PATCH_ENV === 'development') throw new Error('Production compilation requires staging or production PATCH_ENV');
  const policy = JSON.parse(readFileSync(fileURLToPath(new URL('../config/release-policy.json', import.meta.url)), 'utf8')) as ReleasePolicy;
  const config = validatePublic(input, policy, true);
  const clerkKey = config.publishableKey;
  const url = new URL(config.apiOrigin);
  return {
    root,
    envDir: root,
    publicDir: fileURLToPath(new URL("../public", import.meta.url)),
    plugins: [react(), {
      name: "patch-build-metadata",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "patch-build.json", source: JSON.stringify({ mode, patchEnv: config.env, apiOrigin: url.origin, clerkHost: config.clerkHost, clerkIssuer: config.clerkIssuer, publishableKey: clerkKey }) });
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
