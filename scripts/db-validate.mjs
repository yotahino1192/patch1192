import { command, target } from './infra/cli.mjs';
import { loadMigrations, validateDatabase } from './infra/migrations.mjs';
await command(async () => { const { client } = target(); try {
    await validateDatabase(client, await loadMigrations());
    console.log('DATABASE_VALID');
}
finally {
    client.close();
} });
