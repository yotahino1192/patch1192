// Isolated, loopback-only development harness. No route or production navigation entry.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
if (process.env.NODE_ENV === 'production' || process.env.PATCH_ENV === 'production') throw Error('Development preview only');
const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react()], server: { host: '127.0.0.1', port: 5217, strictPort: true } });
await server.listen();
console.log('My Lesson mock preview: http://127.0.0.1:5217/tests/fixtures/my-lesson.html');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
