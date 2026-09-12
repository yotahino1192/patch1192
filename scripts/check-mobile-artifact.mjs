import { command, options } from './infra/cli.mjs';
import { readPolicy } from '../lib/env/server.ts';
import { validateArtifact } from './infra/artifact.mjs';
await command(async () => { await validateArtifact(options().get('--bundle') || 'dist/mobile', readPolicy(), 'production', { kind: 'mobile' }); console.log('MOBILE_RELEASE_VALID'); });
