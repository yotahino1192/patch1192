import { command, target } from './infra/cli.mjs';
import { backup, backupKey } from './infra/backup.mjs';
import { execFileSync } from 'node:child_process';
await command(async () => { const { client, config, options } = target(); try {
    const directory = options.get('--out');
    if (!directory)
        throw new Error('BACKUP_OUTPUT_REQUIRED');
    await backup(client, { directory, key: backupKey(process.env.PATCH_BACKUP_KEY), keyId: process.env.PATCH_BACKUP_KEY_ID || 'v1', dbIdentifier: config.databaseId, releaseSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() });
    console.log('BACKUP_OK');
}
finally {
    client.close();
} });
