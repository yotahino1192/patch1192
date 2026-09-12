import { createHash } from 'node:crypto';
export const hash = value => createHash('sha256').update(value).digest('hex');
export class SchemaNotReady extends Error {
    constructor() { super('SCHEMA_NOT_READY'); this.code = 'SCHEMA_NOT_READY'; this.status = 503; }
}
const internal = name => name.startsWith('sqlite_') || ['_loop_migrations', '_patch_migrations', '_patch_migration_lock', '_patch_migration_runs'].includes(name);
const quote = name => '"' + name.replaceAll('"', '""') + '"';
export async function schema(client) {
    const objects = (await client.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name")).rows.filter(r => !internal(String(r.name)) && !internal(String(r.tbl_name)));
    const result = [];
    for (const r of objects) {
        // PRAGMA metadata avoids harmless CREATE/ALTER formatting differences on remote SQLite.
        if (r.type === 'table') {
            const cols = (await client.execute(`PRAGMA table_xinfo(${quote(String(r.name))})`)).rows;
            const fks = (await client.execute(`PRAGMA foreign_key_list(${quote(String(r.name))})`)).rows;
            result.push({ type: r.type, name: r.name, columns: cols.map(x => Object.fromEntries(Object.entries(x))), foreignKeys: fks.map(x => Object.fromEntries(Object.entries(x))), sql: String(r.sql).replace(/\s+/g, ' ').trim() });
        }
        else
            result.push({ type: r.type, name: r.name, sql: String(r.sql).replace(/\s+/g, ' ').trim() });
    }
    return result;
}
export async function validateOwnership(c) {
    const hasAi = (await c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_requests'")).rows.length;
    if (hasAi && (await c.execute('SELECT 1 FROM ai_requests a LEFT JOIN users u ON u.id=a.user_id WHERE u.id IS NULL LIMIT 1')).rows.length) throw new Error('OWNERSHIP_INVALID');
    const tables = ['sources', 'folders', 'card_sets', 'cards', 'review_logs', 'chat_messages', 'daily_review_plans', 'user_profiles'];
    for (const t of tables)
        if ((await c.execute(`SELECT 1 FROM ${quote(t)} x LEFT JOIN users u ON u.id=x.user_id WHERE u.id IS NULL LIMIT 1`)).rows.length)
            throw new Error('OWNERSHIP_INVALID');
    const links = [['card_sets', 'sources', 'source_id'], ['card_sets', 'folders', 'folder_id'], ['cards', 'card_sets', 'set_id'], ['review_logs', 'cards', 'card_id'], ['chat_messages', 'cards', 'card_id'], ['chat_messages', 'card_sets', 'set_id'], ['folders', 'folders', 'parent_id'], ['user_profiles', 'card_sets', 'initial_set_id']];
    for (const [child, parent, column] of links)
        if ((await c.execute(`SELECT 1 FROM ${quote(child)} x LEFT JOIN ${quote(parent)} p ON p.id=x.${quote(column)} AND p.user_id=x.user_id WHERE x.${quote(column)} IS NOT NULL AND p.id IS NULL LIMIT 1`)).rows.length)
            throw new Error('OWNERSHIP_INVALID');
    for (const [table, column] of [['daily_review_plans', 'card_ids'], ['user_profiles', 'initial_card_ids']]) {
        if ((await c.execute(`SELECT 1 FROM ${table} WHERE json_valid(${column})=0 LIMIT 1`)).rows.length)
            throw new Error('OWNERSHIP_INVALID');
        if ((await c.execute(`SELECT 1 FROM ${table} x,json_each(x.${column}) j LEFT JOIN cards c ON c.id=j.value AND c.user_id=x.user_id WHERE c.id IS NULL LIMIT 1`)).rows.length)
            throw new Error('OWNERSHIP_INVALID');
    }
    if ((await c.execute('SELECT 1 FROM chat_messages m JOIN cards c ON c.id=m.card_id WHERE m.set_id IS NOT NULL AND m.set_id<>c.set_id LIMIT 1')).rows.length)
        throw new Error('OWNERSHIP_INVALID');
}
