import { command, env } from './infra/cli.mjs';
import { readPolicy } from '../lib/env/server.ts';
import { checkRelease } from './infra/release.mjs';
await command(async () => { await checkRelease(env(), readPolicy()); console.log('RELEASE_OFFLINE_CHECKS_OK: remote validation, backup rehearsal and protected promotion still required'); });
