import { cp, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/pdfjs/', root), { recursive: true });
await cp(new URL('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', root), new URL('public/pdfjs/pdf.worker.min.mjs', root));
await cp(new URL('node_modules/pdfjs-dist/cmaps/', root), new URL('public/pdfjs/cmaps/', root), { recursive: true });
