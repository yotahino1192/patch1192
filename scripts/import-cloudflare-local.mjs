import { createClient } from '@libsql/client';
import { access, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const target = resolve('.data/loop.db');
try { await access(target); throw new Error('移行先の .data/loop.db は既に存在します。上書きはしません。'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const directory = resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const candidates = process.argv[2] ? [resolve(process.argv[2])] : (await readdir(directory)).filter((name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite').map((name) => resolve(directory, name));
if (candidates.length !== 1) throw new Error('元のSQLiteファイルを1つ指定してください: npm run db:import-local -- /path/to/database.sqlite');
const source = createClient({ url: pathToFileURL(candidates[0]).href });
try {
  const tables = await source.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='cards'");
  if (!tables.rows.length) throw new Error('このデータベースには学習カードがありません。');
  await mkdir(resolve('.data'), { recursive: true });
  await source.execute({ sql: 'VACUUM INTO ?', args: [target] });
  console.log('ローカルの教材・学習記録を .data/loop.db にコピーしました。元のデータは残しています。');
} finally { source.close(); }
