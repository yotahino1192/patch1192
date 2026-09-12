import { command, env } from './infra/cli.mjs';
import { validateServer } from '../lib/env/server.ts';
import { sealArtifact } from './infra/artifact.mjs';
await command(async () => { const c = validateServer(env()); await sealArtifact('.next/static', c, { kind: 'web', mode: 'production' }); console.log('WEB_ARTIFACT_SEALED'); });
