import { command } from './infra/cli.mjs';
import { readFile } from 'node:fs/promises';
import { prepareCapacitorStubs } from './infra/ios-release.mjs';
import { sealArtifact } from './infra/artifact.mjs';
await command(async () => { const m = JSON.parse(await readFile('dist/mobile/patch-build.json', 'utf8')); await prepareCapacitorStubs('dist/mobile'); await sealArtifact('dist/mobile', { env: m.patchEnv, apiOrigin: m.apiOrigin, clerkHost: m.clerkHost, clerkIssuer: m.clerkIssuer, publishableKey: m.publishableKey }, { kind: 'mobile', mode: m.mode }); console.log('MOBILE_ARTIFACT_SEALED'); });
