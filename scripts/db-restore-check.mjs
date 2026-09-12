import { command, env, options } from './infra/cli.mjs';
import { restoreCheck, backupKey } from './infra/backup.mjs';
await command(async () => { env(); const path = options().get('--backup'); if (!path)
    throw new Error('BACKUP_PATH_REQUIRED'); await restoreCheck(path, backupKey(process.env.PATCH_BACKUP_KEY)); console.log('RESTORE_VALID'); });
