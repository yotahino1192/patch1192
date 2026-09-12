import { command, target } from './infra/cli.mjs';
import { migrate } from './infra/migrations.mjs';
import { execFileSync } from 'node:child_process';
await command(async () => { const { client, options } = target({ write: true }); try {
    await migrate(client, { baseline: options.has('--baseline'), releaseSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() });
    console.log('MIGRATION_OK');
}
finally {
    client.close();
} });
