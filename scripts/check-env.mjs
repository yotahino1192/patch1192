import { command, env } from './infra/cli.mjs';
import { validateServer } from '../lib/env/server.ts';
await command(async () => { validateServer(env()); console.log('ENV_VALID'); });
