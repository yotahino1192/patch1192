import test from 'node:test';
import assert from 'node:assert/strict';
import { isLongTermDue } from '../lib/long-term-review.ts';
const now = new Date('2026-09-07T09:00:00Z');
const card = {status:'定着中',intervalDays:60,dueAt:now.toISOString()};
test('long-term review starts exactly at the due time after graduation', () => {
  assert.equal(isLongTermDue(card,now),true);
  assert.equal(isLongTermDue({...card,dueAt:'2026-09-07T09:00:01Z'},now),false);
  assert.equal(isLongTermDue({...card,intervalDays:30},now),false);
  for (const status of ['未学習','苦手','削除済み','アーカイブ']) assert.equal(isLongTermDue({...card,status},now),false);
  assert.equal(isLongTermDue({...card,intervalDays:120},now),true);
});
