import { command } from './infra/cli.mjs';
import { scanRepository, scanClientGraph } from './infra/scan.mjs';
await command(async () => { await scanRepository(); await scanClientGraph(); console.log('SECRET_SCAN_OK'); });
