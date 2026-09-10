import test from 'node:test';
import assert from 'node:assert/strict';
import { isLongTermDue, memoryMilestones } from '../lib/long-term-review.ts';
const now = new Date('2026-09-07T09:00:00Z');
const card = {status:'定着中',intervalDays:60,dueAt:now.toISOString()};
test('long-term review starts exactly at the due time after graduation', () => {
  assert.equal(isLongTermDue(card,now),true);
  assert.equal(isLongTermDue({...card,dueAt:'2026-09-07T09:00:01Z'},now),false);
  assert.equal(isLongTermDue({...card,intervalDays:30},now),false);
  for (const status of ['未学習','苦手','削除済み','アーカイブ']) assert.equal(isLongTermDue({...card,status},now),false);
  assert.equal(isLongTermDue({...card,intervalDays:120},now),true);
});

test('memory milestones distinguish the final review step and only count complete nonempty active sets', () => {
  const sets = [
    { cards: [{ ...card, intervalDays: 14 }, { ...card, intervalDays: 30 }, { ...card, intervalDays: 60 }, { ...card, intervalDays: 120 }, { ...card, status: '苦手', intervalDays: 0 }] },
    { cards: [{ ...card }, { ...card, status: '削除済み', intervalDays: 0 }] },
    { cards: [{ ...card, status: 'アーカイブ' }] },
    { cards: [] },
    { cards: [{ ...card }, { ...card, status: '未学習', intervalDays: 0 }] },
  ];
  assert.deepEqual(memoryMilestones(sets), { longTerm: 4, nearLongTerm: 1, completedSets: 1 });
  sets[1].cards.push({ ...card, status: '未学習', intervalDays: 0 });
  assert.equal(memoryMilestones(sets).completedSets, 0);
  assert.deepEqual(memoryMilestones([]), { longTerm: 0, nearLongTerm: 0, completedSets: 0 });
});
