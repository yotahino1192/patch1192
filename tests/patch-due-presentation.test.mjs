import test from 'node:test';
import assert from 'node:assert/strict';
import { patchDuePresentation } from '../lib/patch-due-presentation.ts';
const now = Date.parse('2026-09-21T01:00:00Z');
const snapshot = { generatedAt: now, expiresAt: now + 3600000, dayEnd: now + 3600000, timezone: 'Asia/Tokyo', dueCardIds: ['a','b'] };
const card = dueAt => ({ id:'a', dueAt });
test('Due labels use server snapshot timezone, including future-today cards', () => {
 assert.equal(patchDuePresentation([card('2026-09-20T16:00:00Z')],snapshot,now),'today');
 assert.equal(patchDuePresentation([card('2026-09-21T10:00:00Z')],snapshot,now),'today');
 assert.equal(patchDuePresentation([card('2026-09-20T14:00:00Z'),{id:'b',dueAt:'2026-09-21T00:00:00Z'}],snapshot,now),'overdue');
});
test('Uncertain, stale and non-authoritative dates retain generic labels', () => {
 for (const cards of [[card('invalid')],[card('2026-09-23T00:00:00Z')],[{id:'unknown',dueAt:'2026-09-20T00:00:00Z'}]]) assert.equal(patchDuePresentation(cards,snapshot,now),'ready');
 assert.equal(patchDuePresentation([card('2026-09-20T00:00:00Z')],snapshot,now+3600000),'ready');
 assert.equal(patchDuePresentation([card('2026-09-20T00:00:00Z')],undefined,now),'ready');
});
