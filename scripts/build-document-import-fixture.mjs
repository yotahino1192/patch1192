// Test-only build, independent of Clerk/API configuration. No AI transport is installed.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = process.cwd();
await build({ configFile: false, root, publicDir: 'public', plugins: [{ name: 'test-exports', enforce: 'pre', transform(code, id) {
  if (id.endsWith('/app/page.tsx')) return code + '\nexport { Shell, Generate };';
  if (process.env.QA_BASELINE === '1' && id === resolve(root, 'lib/document-import.ts')) return execFileSync('git', ['show', '5768c6b:lib/document-import.ts'], { encoding: 'utf8' });
} }, react()], define: { 'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY': '""' }, build: { outDir: process.env.QA_OUT_DIR || 'outputs/import-qa/bundle', emptyOutDir: true, target: 'safari17', rollupOptions: { input: [resolve(root, 'tests/fixtures/document-import.html'), resolve(root, 'tests/fixtures/document-import-flow.html')] } } });
